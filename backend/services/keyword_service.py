from typing import List, Dict, Any, Optional
from pathlib import Path
import numpy as np
import pandas as pd
import spacy
from collections import Counter, defaultdict


class EmbeddingStore:
    def __init__(self, embeddings_path: Path, metadata_path: Path):
        self._embeddings_path = embeddings_path
        self._metadata_path = metadata_path
        self._embeddings: Optional[np.ndarray] = None
        self._review_id_to_idx: Optional[Dict[str, int]] = None

    def _load(self):
        if self._embeddings is None:
            self._embeddings = np.load(self._embeddings_path, mmap_mode='r')
            metadata = pd.read_parquet(self._metadata_path)
            self._review_id_to_idx = {
                rid: idx for idx, rid in enumerate(metadata['review_id'].values)
            }

    def get_embeddings(self, review_ids: List[str]) -> np.ndarray:
        self._load()
        indices = [self._review_id_to_idx.get(rid) for rid in review_ids]
        valid_indices = [i for i in indices if i is not None]
        return np.array(self._embeddings[valid_indices]) if valid_indices else np.array([])

    def get_embedding_dim(self) -> int:
        self._load()
        return self._embeddings.shape[1]


class KeywordService:
    def __init__(self, embedding_store: EmbeddingStore):
        self._embedding_store = embedding_store

        model_name = "en_core_web_sm"
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            from spacy.cli import download
            download(model_name)
            self.nlp = spacy.load(model_name)

        self._hard_blocklist = {
            "everything", "nothing", "anything", "something", "thing", "item", "stuff",
            "lot", "bit", "part", "way", "kind", "type", "sort", "rest", "half", "side",
            "piece", "portion", "aspect", "detail", "one", "review", "example",
            "reason", "question", "answer", "fact", "idea", "moment", "wavelength",
            "star", "stars", "door", "dash", "app", "application", "business",
            "company", "corporate", "management", "today", "yesterday",
            "customer", "patron", "guest", "person", "people", "everyone", "anybody",
        }

        self._generic_roots = {
            "food", "service", "place", "experience", "restaurant", "establishment",
            "location", "spot", "dinner", "lunch", "breakfast", "meal",
            "atmosphere", "ambience", "vibe", "setting", "environment",
            "staff", "employee", "worker", "manager", "waiter", "waitress", "server",
            "taste", "flavor", "price", "cost", "quality", "time", "minute", "hour"
        }

        self._weak_roots = {
            "piece", "slice", "portion", "half", "side", "part", "cup", "bowl", "plate",
            "order", "serving", "kind", "type", "style", "dish"
        }

    def _get_embeddings(self, reviews: List[Dict[str, Any]]) -> np.ndarray:
        review_ids = [r.get('review_id') for r in reviews if r.get('review_id')]
        return self._embedding_store.get_embeddings(review_ids)

    def analyze_period_issues(
        self,
        reviews: List[Dict[str, Any]],
        business_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not reviews:
            return []

        current_hard_blocklist = self._hard_blocklist.copy()

        if business_name:
            clean_name = business_name.lower().replace("'", "")
            for part in clean_name.split():
                if len(part) > 2:
                    current_hard_blocklist.add(part)
            current_hard_blocklist.add(clean_name)
            current_hard_blocklist.add(business_name.lower())

        texts = [r.get('text', '') for r in reviews]
        if not texts:
            return []

        candidates = []
        docs = self.nlp.pipe(texts, batch_size=50)

        for review_idx, doc in enumerate(docs):
            for chunk in doc.noun_chunks:
                text_lower = chunk.text.lower().strip()
                root_lemma = chunk.root.lemma_.lower().strip()

                if root_lemma in current_hard_blocklist:
                    if root_lemma not in self._weak_roots:
                        continue

                if root_lemma in self._generic_roots:
                    has_adjective = any(t.pos_ == "ADJ" for t in chunk)
                    has_compound = any(t.dep_ == "compound" for t in chunk if t != chunk.root)
                    if not has_adjective and not has_compound:
                        continue

                if chunk.root.pos_ == "PRON":
                    continue

                grouping_key = root_lemma

                if root_lemma in self._weak_roots:
                    real_nouns = [
                        t.lemma_.lower() for t in chunk
                        if t.pos_ in ["NOUN", "PROPN"]
                        and t.lemma_.lower() not in current_hard_blocklist
                    ]
                    if real_nouns:
                        grouping_key = real_nouns[-1]
                    else:
                        continue

                if grouping_key in current_hard_blocklist or len(grouping_key) < 3:
                    continue

                display_text = text_lower
                for prefix in ["the ", "a ", "an ", "my ", "our ", "this ", "that "]:
                    if display_text.startswith(prefix):
                        display_text = display_text[len(prefix):]

                candidates.append({
                    'key': grouping_key,
                    'text': display_text,
                    'review_idx': review_idx
                })

        if not candidates:
            return self._return_fallback(reviews)

        grouped = defaultdict(lambda: {'count': 0, 'texts': [], 'review_indices': set()})

        for item in candidates:
            k = item['key']
            grouped[k]['count'] += 1
            grouped[k]['texts'].append(item['text'])
            grouped[k]['review_indices'].add(item['review_idx'])

        final_results = []

        for key, data in grouped.items():
            relevant_reviews = [reviews[i] for i in data['review_indices']]

            r_sentiments = [r.get('sentiment_score_prob_diff', 0) for r in relevant_reviews]
            r_stars = [r.get('stars', 0) for r in relevant_reviews]
            avg_sent = float(np.mean(r_sentiments)) if r_sentiments else 0.0
            avg_star = float(np.mean(r_stars)) if r_stars else 0.0

            phrase_counts = Counter(data['texts'])
            top_phrase = phrase_counts.most_common(1)[0][0]
            display_name = top_phrase.title()

            severity = abs(avg_sent) if avg_sent < -0.1 else 0
            impact_score = data['count'] * (1 + (severity * 2))

            sample_text = max([r.get('text', '') for r in relevant_reviews], key=len)
            sample_text = sample_text[:500] + "..." if len(sample_text) > 500 else sample_text

            final_results.append({
                'keyword': display_name,
                'count': data['count'],
                'impact_score': impact_score,
                'avg_sentiment': round(avg_sent, 3),
                'avg_stars': round(avg_star, 2),
                'sample_review': sample_text
            })

        final_results.sort(key=lambda x: x['impact_score'], reverse=True)

        formatted_output = []
        for i, item in enumerate(final_results[:20]):
            formatted_output.append({
                'cluster_id': i + 1,
                'size': item['count'],
                'keywords': [(item['keyword'], float(item['count']))],
                'avg_sentiment': item['avg_sentiment'],
                'avg_stars': item['avg_stars'],
                'sample_review': item['sample_review']
            })

        return formatted_output

    def _return_fallback(self, reviews):
        avg_star = np.mean([r.get('stars', 0) for r in reviews]) if reviews else 0
        return [{
            'cluster_id': 0,
            'size': len(reviews),
            'keywords': [("General Feedback", 1.0)],
            'avg_sentiment': 0.0,
            'avg_stars': round(float(avg_star), 2),
            'sample_review': reviews[0].get('text', '')[:500] if reviews else ""
        }]

    def analyze_period(
        self,
        reviews: List[Dict[str, Any]],
        business_name: Optional[str] = None
    ) -> Dict[str, Any]:
        negative_reviews = []
        positive_reviews = []

        for r in reviews:
            score = r.get('sentiment_score_prob_diff', 0)
            label = r.get('sentiment_label', '').lower() if r.get('sentiment_label') else ''

            if label == 'negative':
                negative_reviews.append(r)
            elif label == 'positive':
                positive_reviews.append(r)
            elif score < -0.05:
                negative_reviews.append(r)
            elif score > 0.05:
                positive_reviews.append(r)
            else:
                if score < 0:
                    negative_reviews.append(r)
                else:
                    positive_reviews.append(r)

        negative_clusters = self.analyze_period_issues(negative_reviews, business_name)
        positive_clusters = self.analyze_period_issues(positive_reviews, business_name)

        return {
            'complaints': negative_clusters,
            'praises': positive_clusters,
            'total_reviews': len(reviews),
            'negative_count': len(negative_reviews),
            'positive_count': len(positive_reviews)
        }