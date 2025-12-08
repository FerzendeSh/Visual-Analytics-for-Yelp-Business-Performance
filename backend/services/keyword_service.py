from typing import List, Dict, Any, Optional, Set
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

        self._hard_blocklist = frozenset({
            "everything", "nothing", "anything", "something", "thing", "item", "stuff",
            "lot", "bit", "part", "way", "kind", "type", "sort", "rest", "half", "side",
            "piece", "portion", "aspect", "detail", "one", "review", "example",
            "reason", "question", "answer", "fact", "idea", "moment", "wavelength",
            "star", "stars", "door", "dash", "app", "application", "business",
            "company", "corporate", "management", "today", "yesterday",
            "customer", "patron", "guest", "person", "people", "everyone", "anybody",
            "order", "menu", "top", "ent", "min", "birthday", "occasion",
            "experience", "overall", "visit", "went", "got", "made", "came","husband", 
            "wife", "friend", "family", "group", "party", "daughter", "son", "job", "home"
        })

        self._generic_roots = frozenset({
            "food", "service", "place", "experience", "restaurant", "establishment",
            "location", "spot", "dinner", "lunch", "breakfast", "meal",
            "atmosphere", "ambience", "vibe", "setting", "environment",
            "staff", "employee", "worker", "manager", "waiter", "waitress", "server",
            "taste", "flavor", "price", "cost", "quality", "time", "minute", "hour"
        })

        self._weak_roots = frozenset({
            "piece", "slice", "portion", "half", "side", "part", "cup", "bowl", "plate",
            "order", "serving", "kind", "type", "style", "dish"
        })


        # Common prefixes as tuple for faster iteration
        self._prefixes_to_strip = ("the ", "a ", "an ", "my ", "our ", "this ", "that ")

    def _get_embeddings(self, reviews: List[Dict[str, Any]]) -> np.ndarray:
        review_ids = [r.get('review_id') for r in reviews if r.get('review_id')]
        return self._embedding_store.get_embeddings(review_ids)

    def _build_dynamic_blocklist(
        self, 
        business_name: Optional[str] = None, 
        city: Optional[str] = None
    ) -> Set[str]:
        """Build dynamic blocklist with business name and city."""
        # Convert to set for efficient union operations
        blocklist = set(self._hard_blocklist)
        
        if business_name:
            clean_name = business_name.lower().replace("'", "").replace("'", "")
            # Add full name
            blocklist.add(clean_name)
            blocklist.add(business_name.lower())
            
            # Add individual words (min 3 chars)
            for part in clean_name.split():
                if len(part) > 2:
                    blocklist.add(part)
            
            # Add common variations without apostrophes
            # e.g., "Maggiano's" -> also block "maggianos"
            no_apostrophe = business_name.lower().replace("'", "").replace("'", "")
            if no_apostrophe != clean_name:
                blocklist.add(no_apostrophe)
                for part in no_apostrophe.split():
                    if len(part) > 2:
                        blocklist.add(part)
        
        if city:
            clean_city = city.lower().replace("'", "")
            blocklist.add(clean_city)
            blocklist.update(part for part in clean_city.split() if len(part) > 2)
        
        return blocklist

    def _classify_review_sentiment(self, review: Dict[str, Any]) -> str:
        """
        Classify review as positive or negative using both sentiment score and star rating.
        Star rating validation helps catch sarcastic reviews and misclassifications.
        
        Args:
            review: Dictionary containing sentiment_score_prob_diff, sentiment_label, and stars
            
        Returns:
            'negative' or 'positive'
        """
        score = review.get('sentiment_score_prob_diff', 0)
        label = review.get('sentiment_label', '').lower() if review.get('sentiment_label') else ''
        stars = review.get('stars', None)
        
        # If we have a pre-computed label, use it as initial classification
        if label in ['negative', 'positive']:
            initial_sentiment = label
        elif score < -0.05:
            initial_sentiment = 'negative'
        elif score > 0.05:
            initial_sentiment = 'positive'
        else:
            # Borderline case, lean based on score
            initial_sentiment = 'negative' if score < 0 else 'positive'
        
        # Validate with star rating if available
        if stars is not None:
            # Strong mismatch detection: trust the star rating over sentiment analysis
            # This catches sarcastic reviews like "Great food!" with 1 star
            if stars <= 2.0 and initial_sentiment == 'positive':
                # Low stars but positive sentiment detected -> likely sarcasm
                return 'negative'
            elif stars >= 4.0 and initial_sentiment == 'negative':
                # High stars but negative sentiment detected -> likely misclassification
                return 'positive'
            
            # For borderline cases (score between -0.05 and 0.05), let star rating decide
            if abs(score) <= 0.05:
                if stars <= 2.5:
                    return 'negative'
                elif stars >= 3.5:
                    return 'positive'
        
        return initial_sentiment

    def _calculate_top_k(self, num_reviews: int) -> int:
        """
        Dynamically calculate how many top keywords to return based on review count.
        More reviews = more keywords to capture diverse issues/praises.
        
        Args:
            num_reviews: Total number of reviews being analyzed
            
        Returns:
            Number of top keywords to return (between 3 and 50)
        """
        if num_reviews < 10:
            return 3
        elif num_reviews < 50:
            return 10
        elif num_reviews < 100:
            return 15
        elif num_reviews < 500:
            return 20
        elif num_reviews < 1000:
            return 30
        elif num_reviews < 5000:
            return 40
        else:
            return 50
    
    def _calculate_min_mentions(self, num_reviews: int) -> int:
        """
        Calculate minimum number of mentions required for a keyword to be included.
        Prevents noise from single mentions in small datasets.
        
        Args:
            num_reviews: Total number of reviews being analyzed
            
        Returns:
            Minimum mention count threshold (always 2 to ensure patterns across reviews)
        """
        # Always require at least 2 reviews to show a pattern
        # Single-review keywords are likely noise or one-off complaints
        return 2

    def _extract_candidates_from_doc(
        self, 
        doc, 
        review_idx: int, 
        blocklist: Set[str]
    ) -> List[Dict[str, Any]]:
        """Extract candidate phrases from a single spaCy doc."""
        candidates = []
        
        for chunk in doc.noun_chunks:
            root_lemma = chunk.root.lemma_.lower().strip()

            # Fast rejection checks first
            if chunk.root.pos_ == "PRON":
                continue
                
            if root_lemma in blocklist and root_lemma not in self._weak_roots:
                continue

            # Check generic roots
            if root_lemma in self._generic_roots:
                has_modifier = any(
                    t.pos_ == "ADJ" or (t.dep_ == "compound" and t != chunk.root)
                    for t in chunk
                )
                if not has_modifier:
                    continue

            grouping_key = root_lemma

            # Handle weak roots
            if root_lemma in self._weak_roots:
                real_nouns = [
                    t.lemma_.lower() for t in chunk
                    if t.pos_ in ["NOUN", "PROPN"]
                    and t.lemma_.lower() not in blocklist
                ]
                if real_nouns:
                    grouping_key = real_nouns[-1]
                else:
                    continue

            if grouping_key in blocklist or len(grouping_key) < 3:
                continue

            # Strip prefixes
            display_text = chunk.text.lower().strip()
            for prefix in self._prefixes_to_strip:
                if display_text.startswith(prefix):
                    display_text = display_text[len(prefix):]
                    break

            candidates.append({
                'key': grouping_key,
                'text': display_text,
                'review_idx': review_idx
            })
        
        return candidates

    def analyze_period_issues(
        self,
        reviews: List[Dict[str, Any]],
        business_name: Optional[str] = None,
        city: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze reviews to extract keyword clusters.
        
        Args:
            reviews: List of review dictionaries
            business_name: Business name to filter from keywords
            city: City name to filter from keywords
            
        Returns:
            List of keyword clusters
        """
        if not reviews:
            return []

        # Build blocklist once
        current_blocklist = self._build_dynamic_blocklist(business_name, city)
        
        # Calculate dynamic top-k and minimum mentions based on review count
        top_k = self._calculate_top_k(len(reviews))
        min_mentions = self._calculate_min_mentions(len(reviews))

        # Pre-extract texts for batch processing
        texts = [r.get('text', '') for r in reviews]
        if not texts:
            return []

        # Batch process with spaCy for better performance
        candidates = []
        # Increase batch size for better throughput with large datasets
        batch_size = min(100, max(50, len(texts) // 10))
        
        for review_idx, doc in enumerate(self.nlp.pipe(texts, batch_size=batch_size, n_process=1)):
            candidates.extend(
                self._extract_candidates_from_doc(doc, review_idx, current_blocklist)
            )

        if not candidates:
            return self._return_fallback(reviews)

        # Group candidates efficiently
        # Use sets to track unique reviews per keyword (count once per review)
        grouped = defaultdict(lambda: {'review_indices': set(), 'texts': []})
        
        for item in candidates:
            k = item['key']
            # Only add if this review hasn't been counted for this keyword yet
            if item['review_idx'] not in grouped[k]['review_indices']:
                grouped[k]['texts'].append(item['text'])
            grouped[k]['review_indices'].add(item['review_idx'])

        # Pre-compute review data for faster lookups
        review_sentiments = np.array([r.get('sentiment_score_prob_diff', 0) for r in reviews])
        review_stars = np.array([r.get('stars', 0) for r in reviews])
        review_texts = [r.get('text', '') for r in reviews]

        final_results = []

        for key, data in grouped.items():
            # Count = number of unique reviews mentioning this keyword
            mention_count = len(data['review_indices'])
            
            # Filter based on minimum mentions across different reviews
            if mention_count < min_mentions:
                continue
            
            # Use numpy indexing for faster aggregation
            indices = list(data['review_indices'])
            
            avg_sent = float(np.mean(review_sentiments[indices]))
            avg_star = float(np.mean(review_stars[indices]))

            # Get top phrase efficiently
            phrase_counts = Counter(data['texts'])
            top_phrase = phrase_counts.most_common(1)[0][0]
            display_name = top_phrase.title()

            severity = abs(avg_sent) if avg_sent < -0.1 else 0
            impact_score = mention_count * (1 + (severity * 2))

            # Get all review texts from the cluster (limit to prevent massive payloads)
            sample_texts = [review_texts[i] for i in indices]
            # Limit to 50 reviews per keyword to keep payload reasonable
            sample_texts = sample_texts[:50]

            final_results.append({
                'keyword': display_name,
                'count': mention_count,
                'impact_score': impact_score,
                'avg_sentiment': round(avg_sent, 3),
                'avg_stars': round(avg_star, 2),
                'sample_review': sample_texts[0] if sample_texts else '',  # Keep for backward compatibility
                'all_reviews': sample_texts  # New field with all reviews
            })

        # Sort once at the end
        final_results.sort(key=lambda x: x['impact_score'], reverse=True)

        # Format top-k results (dynamically determined)
        formatted_output = [
            {
                'cluster_id': i + 1,
                'size': item['count'],
                'keywords': [(item['keyword'], float(item['count']))],
                'avg_sentiment': item['avg_sentiment'],
                'avg_stars': item['avg_stars'],
                'sample_review': item['sample_review'],
                'all_reviews': item['all_reviews']  # Include all reviews
            }
            for i, item in enumerate(final_results[:top_k])
        ]

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
        business_name: Optional[str] = None,
        city: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze reviews for a period, splitting into positive and negative clusters.
        Uses both sentiment scores and star ratings for more accurate classification.
        
        Args:
            reviews: List of review dictionaries
            business_name: Business name to filter from keywords
            city: City name to filter from keywords  
            
        Returns:
            Dictionary with complaints, praises, and review counts
        """
        negative_reviews = []
        positive_reviews = []

        for r in reviews:
            classification = self._classify_review_sentiment(r)
            
            if classification == 'negative':
                negative_reviews.append(r)
            else:
                positive_reviews.append(r)

        negative_clusters = self.analyze_period_issues(negative_reviews, business_name, city)
        positive_clusters = self.analyze_period_issues(positive_reviews, business_name, city)

        return {
            'complaints': negative_clusters,
            'praises': positive_clusters,
            'total_reviews': len(reviews),
            'negative_count': len(negative_reviews),
            'positive_count': len(positive_reviews)
        }