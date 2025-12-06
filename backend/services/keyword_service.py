"""
Keyword extraction and clustering service for period issue analysis.
Uses pre-computed SentenceTransformer embeddings, KMeans clustering, and YAKE keyword extraction.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import pandas as pd
import yake
from sklearn.cluster import KMeans


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
    Loads embeddings lazily and uses memory mapping to avoid loading entire 3.8GB file.
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
    Service for analyzing period issues through review clustering and keyword extraction.
    Uses pre-computed embeddings from EmbeddingStore for fast lookup.
    """
    
    DEFAULT_N_CLUSTERS = 3
    MAX_KEYWORDS_PER_CLUSTER = 5
    MIN_REVIEWS_FOR_CLUSTERING = 3
    
    def __init__(self, embedding_store: EmbeddingStore):
        self._embedding_store = embedding_store
        self._yake_extractor = yake.KeywordExtractor(
            lan="en",
            n=3,
            dedupLim=0.7,
            dedupFunc='seqm',
            windowsSize=1,
            top=self.MAX_KEYWORDS_PER_CLUSTER
        )
    
    def _get_embeddings(self, reviews: List[Dict[str, Any]]) -> np.ndarray:
        review_ids = [r.get('review_id') for r in reviews if r.get('review_id')]
        return self._embedding_store.get_embeddings(review_ids)
    
    def _cluster_embeddings(self, embeddings: np.ndarray, n_clusters: int) -> np.ndarray:
        actual_clusters = min(n_clusters, len(embeddings))
        if actual_clusters < 2:
            return np.zeros(len(embeddings), dtype=int)
        
        kmeans = KMeans(
            n_clusters=actual_clusters,
            random_state=42,
            n_init=10,
            max_iter=300
        )
        return kmeans.fit_predict(embeddings)
    
    def _extract_keywords(self, texts: List[str]) -> List[tuple[str, float]]:
        if not texts:
            return []
        
        combined_text = " ".join(texts)
        
        try:
            keywords = self._yake_extractor.extract_keywords(combined_text)
            return [(kw, round(1 - score, 3)) for kw, score in keywords]
        except Exception:
            return []
    
    def _select_sample_review(self, reviews: List[Dict[str, Any]], embeddings: np.ndarray, cluster_mask: np.ndarray) -> str:
        cluster_embeddings = embeddings[cluster_mask]
        if len(cluster_embeddings) == 0:
            return ""
        
        centroid = cluster_embeddings.mean(axis=0)
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        closest_idx = np.argmin(distances)
        
        cluster_reviews = [r for i, r in enumerate(reviews) if cluster_mask[i]]
        if closest_idx < len(cluster_reviews):
            text = cluster_reviews[closest_idx].get('text', '')
            return text[:500] + '...' if len(text) > 500 else text
        return ""
    
    def analyze_period_issues(
        self,
        reviews: List[Dict[str, Any]],
        n_clusters: int = DEFAULT_N_CLUSTERS
    ) -> List[Dict[str, Any]]:
        if not reviews:
            return []
        
        if len(reviews) < self.MIN_REVIEWS_FOR_CLUSTERING:
            texts = [r.get('text', '') for r in reviews]
            keywords = self._extract_keywords(texts)
            avg_sentiment = np.mean([r.get('sentiment_score_prob_diff', 0) for r in reviews])
            
            return [{
                'cluster_id': 0,
                'size': len(reviews),
                'keywords': keywords,
                'avg_sentiment': round(float(avg_sentiment), 3),
                'sample_review': texts[0][:500] if texts else ""
            }]
        
        texts = [r.get('text', '') for r in reviews]
        sentiments = [r.get('sentiment_score_prob_diff', 0) for r in reviews]
        
        embeddings = self._get_embeddings(reviews)
        
        if len(embeddings) == 0:
            keywords = self._extract_keywords(texts)
            avg_sentiment = np.mean(sentiments)
            return [{
                'cluster_id': 0,
                'size': len(reviews),
                'keywords': keywords,
                'avg_sentiment': round(float(avg_sentiment), 3),
                'sample_review': texts[0][:500] if texts else "",
                'note': 'embeddings_not_found'
            }]
        
        cluster_labels = self._cluster_embeddings(embeddings, n_clusters)
        
        unique_clusters = np.unique(cluster_labels)
        results = []
        
        for cluster_id in unique_clusters:
            cluster_mask = cluster_labels == cluster_id
            cluster_texts = [t for i, t in enumerate(texts) if cluster_mask[i]]
            cluster_sentiments = [s for i, s in enumerate(sentiments) if cluster_mask[i]]
            
            keywords = self._extract_keywords(cluster_texts)
            avg_sentiment = np.mean(cluster_sentiments) if cluster_sentiments else 0.0
            sample_review = self._select_sample_review(reviews, embeddings, cluster_mask)
            
            results.append({
                'cluster_id': int(cluster_id),
                'size': int(cluster_mask.sum()),
                'keywords': keywords,
                'avg_sentiment': round(float(avg_sentiment), 3),
                'sample_review': sample_review
            })
        
        results.sort(key=lambda x: x['size'], reverse=True)
        
        return results
    
    def analyze_period(
        self,
        reviews: List[Dict[str, Any]],
        n_clusters: int = DEFAULT_N_CLUSTERS
    ) -> Dict[str, Any]:
        """
        Analyze reviews by splitting into negative/positive pools and clustering each.
        Returns top complaint themes and top praise themes.
        """
        negative_reviews = [r for r in reviews if r.get('sentiment_label') == 'negative']
        positive_reviews = [r for r in reviews if r.get('sentiment_label') == 'positive']
        
        negative_clusters = self.analyze_period_issues(negative_reviews, n_clusters)
        positive_clusters = self.analyze_period_issues(positive_reviews, n_clusters)
        
        return {
            'complaints': negative_clusters,
            'praises': positive_clusters,
            'total_reviews': len(reviews),
            'negative_count': len(negative_reviews),
            'positive_count': len(positive_reviews)
        }
