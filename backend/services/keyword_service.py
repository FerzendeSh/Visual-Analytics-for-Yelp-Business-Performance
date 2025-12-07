"""
Keyword extraction and clustering service for period issue analysis.
UPDATED: Strict Filtering + Business Name Exclusion + Linguistic Root Grouping.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import pandas as pd
import spacy
from collections import Counter, defaultdict

# Kept for compatibility
@dataclass
class IssueCluster:
    cluster_id: int
    size: int
    keywords: List[tuple[str, float]]
    avg_sentiment: float
    sample_review: str


class EmbeddingStore:
    """
    Memory-mapped embedding store for fast lookup of pre-computed review embeddings.
    """
    
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
        
        if not valid_indices:
            return np.array([])
        
        return np.array(self._embeddings[valid_indices])
    
    def get_embedding_dim(self) -> int:
        self._load()
        return self._embeddings.shape[1]


class KeywordService:
    """
    Service for analyzing period issues using Linguistic Root Grouping.
    Includes STRICT filtering for idioms, business noise, and optional business name blocking.
    """
    
    DEFAULT_N_CLUSTERS = 3
    
    def __init__(self, embedding_store: EmbeddingStore):
        self._embedding_store = embedding_store
        
        # Initialize Spacy
        model_name = "en_core_web_sm"
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            print(f"Model '{model_name}' not found. Downloading...")
            from spacy.cli import download
            download(model_name)
            self.nlp = spacy.load(model_name)

        # 1. STRICT BLOCKLIST
        # Generic words to always ignore.
        self._blocklist = {
            # Generic/Abstract (Noise)
            "everything", "nothing", "anything", "something", "thing", "item", "stuff",
            "lot", "bit", "part", "way", "kind", "type", "sort", "rest", "half", "side",
            "piece", "portion", "aspect", "detail", "one", "review", "example",
            "reason", "question", "answer", "fact", "idea", "moment", "wavelength",
            
            # Service/Time generics
            "time", "minute", "hour", "day", "night", "week", "today", "yesterday",
            "experience", "service", "place", "spot", "establishment", "location",
            
            # Domain Stopwords (Restaurant specific but generic)
            "restaurant", "food", "meal", "dinner", "lunch", "breakfast", "appetizer", "entree",
            "course", "dish", "option", "choice",
            
            # People
            "customer", "patron", "guest", "person", "people", "everyone", "anybody",
            "staff", "employee", "worker", "manager", "waiter", "waitress", "server",
            
            # Specific Noise observed in previous outputs
            "star", "stars", "door", "dash", "app", "application", "business", "event", "party",
            "company", "corporate", "management"
        }

        # Words that indicate a noun phrase is "weak" (e.g., "piece of chicken")
        self._weak_roots = {
            "piece", "slice", "portion", "half", "side", "part", "cup", "bowl", "plate",
            "order", "serving", "kind", "type", "style", "flavor", "taste", "dish"
        }

    def _get_embeddings(self, reviews: List[Dict[str, Any]]) -> np.ndarray:
        review_ids = [r.get('review_id') for r in reviews if r.get('review_id')]
        return self._embedding_store.get_embeddings(review_ids)

    def analyze_period_issues(
        self,
        reviews: List[Dict[str, Any]],
        n_clusters: int = DEFAULT_N_CLUSTERS,
        business_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extracts issues using Linguistic Root Aggregation.
        Accepts optional 'business_name' to dynamically filter out brand mentions.
        """
        if not reviews:
            return []

        # 1. Prepare Blocklist (Dynamic)
        # We copy the static list and add the provided business name parts to it
        current_blocklist = self._blocklist.copy()
        
        if business_name:
            # Normalize: "Maggiano's Little Italy" -> "maggiano", "maggianos", "little", "italy"
            clean_name = business_name.lower().replace("'", "")
            
            # Add full parts
            for part in clean_name.split():
                if len(part) > 2: # Don't block 'a' or 'the' if they are in the name
                    current_blocklist.add(part)
            
            # Add variations (e.g. plural)
            current_blocklist.add(clean_name)
            current_blocklist.add(business_name.lower())

        # 2. Extract texts
        texts = [r.get('text', '') for r in reviews]
        if not texts:
            return []

        # 3. Extract Noun Chunks & Normalize
        candidates = []
        docs = self.nlp.pipe(texts, batch_size=50)

        for review_idx, doc in enumerate(docs):
            for chunk in doc.noun_chunks:
                text_lower = chunk.text.lower().strip()
                root_lemma = chunk.root.lemma_.lower().strip()

                # A. Filter Basic Noise (Blocklist)
                if root_lemma in current_blocklist: 
                    # Only rescue if it's a weak root (e.g. "half")
                    if root_lemma not in self._weak_roots:
                        continue

                if chunk.root.pos_ == "PRON": continue
                
                # B. Root Resolution Strategy
                grouping_key = root_lemma
                
                if root_lemma in self._weak_roots:
                    # Look for a meaningful noun in the children
                    real_nouns = [
                        t.lemma_.lower() for t in chunk 
                        if t.pos_ in ["NOUN", "PROPN"] 
                        and t.lemma_.lower() not in current_blocklist
                    ]
                    if real_nouns:
                        grouping_key = real_nouns[-1] 
                    else:
                        continue 
                
                # C. Final Clean Up
                if grouping_key in current_blocklist or len(grouping_key) < 3:
                    continue

                # Clean display text (remove prefixes)
                display_text = text_lower
                for prefix in ["the ", "a ", "an ", "my ", "our ", "this ", "that "]:
                    if display_text.startswith(prefix):
                        display_text = display_text[len(prefix):]
                
                candidates.append({
                    'key': grouping_key,      # Bucket (e.g., "sauce")
                    'text': display_text,     # Display (e.g., "alfredo sauce")
                    'review_idx': review_idx
                })

        if not candidates:
            return self._return_fallback(reviews)

        # 4. Aggregate by Semantic Key
        grouped = defaultdict(lambda: {'count': 0, 'texts': [], 'review_indices': set()})
        
        for item in candidates:
            k = item['key']
            grouped[k]['count'] += 1
            grouped[k]['texts'].append(item['text'])
            grouped[k]['review_indices'].add(item['review_idx'])

        # 5. Score & Format
        final_results = []
        
        for key, data in grouped.items():
            relevant_reviews = [reviews[i] for i in data['review_indices']]
            
            # Stats
            r_sentiments = [r.get('sentiment_score_prob_diff', 0) for r in relevant_reviews]
            r_stars = [r.get('stars', 0) for r in relevant_reviews]
            avg_sent = float(np.mean(r_sentiments)) if r_sentiments else 0.0
            avg_star = float(np.mean(r_stars)) if r_stars else 0.0
            
            # Dynamic Naming (Most frequent phrase)
            phrase_counts = Counter(data['texts'])
            top_phrase = phrase_counts.most_common(1)[0][0]
            display_name = top_phrase.title()

            # Impact Score (Count boosted by Negative Severity)
            severity = abs(avg_sent) if avg_sent < -0.1 else 0
            impact_score = data['count'] * (1 + (severity * 2))

            # Sample text
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

        # 6. Sort by Impact Score & Slice Top 20
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
        """Returns a generic summary if no keywords found."""
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
        n_clusters: int = DEFAULT_N_CLUSTERS,
        business_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze reviews by splitting into negative/positive pools.
        Accepts optional 'business_name' for dynamic filtering.
        """
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
                if score < 0: negative_reviews.append(r)
                else: positive_reviews.append(r)

        print(f"[KeywordService] Processing {len(reviews)} reviews ({len(negative_reviews)} neg, {len(positive_reviews)} pos)")

        # Pass business_name down to the worker method
        negative_clusters = self.analyze_period_issues(negative_reviews, n_clusters, business_name=business_name)
        positive_clusters = self.analyze_period_issues(positive_reviews, n_clusters, business_name=business_name)

        return {
            'complaints': negative_clusters,
            'praises': positive_clusters,
            'total_reviews': len(reviews),
            'negative_count': len(negative_reviews),
            'positive_count': len(positive_reviews)
        }