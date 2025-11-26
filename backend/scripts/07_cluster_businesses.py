"""
Production clustering pipeline for businesses at city and neighborhood levels.

This script:
1. Loads enriched business data and review embeddings
2. Applies optimal clustering configurations based on empirical experiments
3. Generates clusters at both city and neighborhood levels
4. Uses LLM to generate semantic labels for each cluster
5. Stores results in the database

Usage:
    python -m scripts.clustering.cluster_businesses --level city
    python -m scripts.clustering.cluster_businesses --level neighborhood
    python -m scripts.clustering.cluster_businesses --level both
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

# Clustering imports
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from sklearn.preprocessing import StandardScaler
import hdbscan
from umap import UMAP

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from configs.database import get_db
from models.business import Business
from models.cluster import ClusterRun, Cluster, BusinessCluster, ClusterLevel, ClusterMethod

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# OPTIMAL CONFIGURATIONS FROM EXPERIMENTS
# ============================================================================

CITY_CLUSTERING_CONFIG = {
    'LARGE': {  # >= 408 businesses
        'threshold': 408,
        'method': 'hdbscan',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 15, 'n_components': 100, 'min_dist': 0.0},
        'cluster_params': {'min_cluster_size': 15, 'min_samples': 5, 'metric': 'euclidean'}
    },
    'MEDIUM': {  # 212-407 businesses
        'threshold': 212,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 10, 'n_components': 50, 'min_dist': 0.0},
        'cluster_params': {'n_clusters': 10}
    },
    'SMALL': {  # 25-211 businesses
        'threshold': 25,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 10, 'n_components': 20, 'min_dist': 0.1},
        'cluster_params': {'n_clusters': 5}
    },
    'TINY': {  # < 25 businesses
        'threshold': 0,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': None,  # Skip dimred
        'cluster_params': {'n_clusters': 3}
    }
}

NEIGHBORHOOD_CLUSTERING_CONFIG = {
    'LARGE': {  # >= 96 businesses
        'threshold': 96,
        'method': 'hdbscan',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 5, 'n_components': 20, 'min_dist': 0.0},
        'cluster_params': {'min_cluster_size': 5, 'min_samples': 3, 'metric': 'euclidean'}
    },
    'MEDIUM': {  # 57-95 businesses
        'threshold': 57,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 5, 'n_components': 20, 'min_dist': 0.0},
        'cluster_params': {'n_clusters': 8}
    },
    'SMALL': {  # 19-56 businesses
        'threshold': 19,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': 'umap',
        'dimred_params': {'n_neighbors': 5, 'n_components': 10, 'min_dist': 0.1},
        'cluster_params': {'n_clusters': 4}
    },
    'TINY': {  # 10-18 businesses
        'threshold': 10,
        'method': 'kmeans',
        'features': 'embedding_mean_only',
        'dimred': None,
        'cluster_params': {'n_clusters': 2}
    },
    'MICRO': {  # < 10 businesses
        'threshold': 0,
        'method': 'rule_based',
        'features': 'embedding_mean_only',
        'dimred': None,
        'cluster_params': {}
    }
}


# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

def extract_business_features(businesses_df: pd.DataFrame) -> np.ndarray:
    """
    Extract numerical business features.
    Returns standardized feature matrix.
    """
    numerical_cols = [
        'latitude', 'longitude', 'stars', 'review_count', 'photo_count'
    ]

    # Filter to existing columns
    available_cols = [col for col in numerical_cols if col in businesses_df.columns]

    if not available_cols:
        logger.warning("No numerical features available")
        return np.zeros((len(businesses_df), 1))

    features = businesses_df[available_cols].fillna(0).values

    # Standardize
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    return features_scaled


def load_review_embeddings(
    business_ids: List[str],
    embeddings_cache_path: Path
) -> Dict[str, np.ndarray]:
    """
    Load pre-computed review embeddings for given businesses.
    Returns dict mapping business_id -> embedding_mean vector.
    """
    if not embeddings_cache_path.exists():
        logger.error(f"Embeddings cache not found: {embeddings_cache_path}")
        return {}

    logger.info(f"Loading embeddings from {embeddings_cache_path}")
    embeddings_df = pd.read_parquet(embeddings_cache_path)

    # Filter to requested business IDs
    embeddings_df = embeddings_df[embeddings_df['business_id'].isin(business_ids)]

    # Create mapping
    embeddings_dict = {}
    for _, row in embeddings_df.iterrows():
        embeddings_dict[row['business_id']] = row['embedding_mean']

    logger.info(f"Loaded embeddings for {len(embeddings_dict)} businesses")
    return embeddings_dict


def prepare_features(
    businesses_df: pd.DataFrame,
    embeddings_dict: Dict[str, np.ndarray],
    feature_variant: str = 'embedding_mean_only'
) -> Tuple[np.ndarray, List[str]]:
    """
    Prepare feature matrix based on variant.
    Returns (features, business_ids_aligned).
    """
    business_ids = businesses_df['business_id'].tolist()

    if feature_variant == 'embedding_mean_only':
        # Use only embeddings
        embeddings = []
        aligned_ids = []

        for bid in business_ids:
            if bid in embeddings_dict:
                embeddings.append(embeddings_dict[bid])
                aligned_ids.append(bid)

        if not embeddings:
            logger.error("No embeddings found for any business")
            return np.array([]), []

        features = np.vstack(embeddings)

    elif feature_variant == 'business_only':
        # Use only business features
        features = extract_business_features(businesses_df)
        aligned_ids = business_ids

    elif feature_variant == 'business_plus_embedding_mean':
        # Combine both
        business_features = extract_business_features(businesses_df)

        embeddings = []
        aligned_ids = []
        aligned_business_features = []

        for i, bid in enumerate(business_ids):
            if bid in embeddings_dict:
                embeddings.append(embeddings_dict[bid])
                aligned_ids.append(bid)
                aligned_business_features.append(business_features[i])

        if not embeddings:
            logger.error("No embeddings found")
            return np.array([]), []

        embeddings_array = np.vstack(embeddings)
        business_features_array = np.vstack(aligned_business_features)

        features = np.hstack([business_features_array, embeddings_array])

    else:
        raise ValueError(f"Unknown feature variant: {feature_variant}")

    logger.info(f"Prepared features: shape={features.shape}, variant={feature_variant}")
    return features, aligned_ids


# ============================================================================
# DIMENSIONALITY REDUCTION
# ============================================================================

def apply_dimensionality_reduction(
    features: np.ndarray,
    method: Optional[str],
    params: Optional[Dict]
) -> np.ndarray:
    """Apply dimensionality reduction."""
    if method is None or method == 'raw':
        return features

    # Adjust params for small datasets
    n_samples = features.shape[0]
    params = params.copy() if params else {}

    if method == 'pca':
        n_components = params.get('n_components', 50)
        n_components = min(n_components, n_samples - 1, features.shape[1])

        reducer = PCA(n_components=n_components, random_state=42)
        reduced = reducer.fit_transform(features)

        logger.info(f"PCA: {features.shape[1]} -> {reduced.shape[1]} dims")
        return reduced

    elif method == 'umap':
        n_neighbors = min(params.get('n_neighbors', 15), n_samples - 1)
        n_components = min(
            params.get('n_components', 50),
            n_samples - 1,
            features.shape[1]
        )
        min_dist = params.get('min_dist', 0.1)

        reducer = UMAP(
            n_neighbors=n_neighbors,
            n_components=n_components,
            min_dist=min_dist,
            metric='euclidean',
            random_state=42,
            verbose=False
        )
        reduced = reducer.fit_transform(features)

        logger.info(f"UMAP: {features.shape[1]} -> {reduced.shape[1]} dims")
        return reduced

    else:
        logger.warning(f"Unknown dimred method: {method}, using raw features")
        return features


# ============================================================================
# CLUSTERING
# ============================================================================

def perform_clustering(
    features: np.ndarray,
    method: str,
    params: Dict
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Perform clustering and return labels + metadata.
    Returns (labels, metadata_dict).
    """
    n_samples = features.shape[0]
    metadata = {'method': method, 'params': params}

    if method == 'hdbscan':
        clusterer = hdbscan.HDBSCAN(**params)
        labels = clusterer.fit_predict(features)

        metadata['n_clusters'] = len(set(labels)) - (1 if -1 in labels else 0)
        metadata['noise_ratio'] = (labels == -1).sum() / len(labels)
        metadata['probabilities'] = clusterer.probabilities_.tolist()
        metadata['outlier_scores'] = clusterer.outlier_scores_.tolist()

    elif method == 'kmeans':
        n_clusters = min(params.get('n_clusters', 5), n_samples - 1)
        clusterer = KMeans(n_clusters=n_clusters, n_init=50, random_state=42)
        labels = clusterer.fit_predict(features)

        metadata['n_clusters'] = n_clusters
        metadata['inertia'] = float(clusterer.inertia_)
        metadata['probabilities'] = None
        metadata['outlier_scores'] = None

    elif method == 'gmm':
        n_components = min(params.get('n_components', 5), n_samples - 1)
        clusterer = GaussianMixture(
            n_components=n_components,
            covariance_type=params.get('covariance_type', 'full'),
            random_state=42
        )
        labels = clusterer.fit_predict(features)
        probabilities = clusterer.predict_proba(features)

        metadata['n_clusters'] = n_components
        metadata['bic'] = float(clusterer.bic(features))
        metadata['aic'] = float(clusterer.aic(features))
        metadata['probabilities'] = probabilities.max(axis=1).tolist()
        metadata['outlier_scores'] = None

    elif method == 'agglomerative':
        n_clusters = min(params.get('n_clusters', 5), n_samples - 1)
        clusterer = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage=params.get('linkage', 'ward')
        )
        labels = clusterer.fit_predict(features)

        metadata['n_clusters'] = n_clusters
        metadata['probabilities'] = None
        metadata['outlier_scores'] = None

    elif method == 'rule_based':
        logger.info("Using rule-based clustering (category-based grouping)")
        labels = np.zeros(n_samples, dtype=int)
        metadata['n_clusters'] = 1
        metadata['probabilities'] = None
        metadata['outlier_scores'] = None

    else:
        raise ValueError(f"Unknown clustering method: {method}")

    logger.info(f"Clustering complete: method={method}, n_clusters={metadata['n_clusters']}")
    return labels, metadata


def compute_cluster_quality_metrics(
    features: np.ndarray,
    labels: np.ndarray
) -> Dict[str, float]:
    """Compute clustering quality metrics."""
    metrics = {}

    # Filter out noise points
    valid_mask = labels >= 0
    valid_features = features[valid_mask]
    valid_labels = labels[valid_mask]

    n_clusters = len(set(valid_labels))

    if n_clusters < 2 or len(valid_labels) < 10:
        return {
            'silhouette': -1.0,
            'davies_bouldin': float('inf'),
            'calinski_harabasz': 0.0,
            'composite_score': 0.0
        }

    try:
        metrics['silhouette'] = float(silhouette_score(valid_features, valid_labels))
    except:
        metrics['silhouette'] = -1.0

    try:
        metrics['davies_bouldin'] = float(davies_bouldin_score(valid_features, valid_labels))
    except:
        metrics['davies_bouldin'] = float('inf')

    try:
        metrics['calinski_harabasz'] = float(calinski_harabasz_score(valid_features, valid_labels))
    except:
        metrics['calinski_harabasz'] = 0.0

    # Composite score
    silhouette_norm = (metrics['silhouette'] + 1) / 2
    db_norm = max(0, 1 - metrics['davies_bouldin'] / 10)
    ch_norm = min(1, metrics['calinski_harabasz'] / 1000)

    noise_ratio = (~valid_mask).sum() / len(labels)
    noise_penalty = 1 - noise_ratio

    metrics['composite_score'] = float(
        0.30 * silhouette_norm +
        0.25 * db_norm +
        0.25 * ch_norm +
        0.20 * noise_penalty
    )

    return metrics


# ============================================================================
# SIZE-BASED CONFIGURATION SELECTION
# ============================================================================

def get_config_for_size(
    n_businesses: int,
    level: str
) -> Tuple[str, Dict]:
    """
    Get optimal configuration based on entity size.
    Returns (size_category, config_dict).
    """
    configs = CITY_CLUSTERING_CONFIG if level == 'city' else NEIGHBORHOOD_CLUSTERING_CONFIG

    # Determine size category
    if level == 'city':
        if n_businesses >= configs['LARGE']['threshold']:
            return 'LARGE', configs['LARGE']
        elif n_businesses >= configs['MEDIUM']['threshold']:
            return 'MEDIUM', configs['MEDIUM']
        elif n_businesses >= configs['SMALL']['threshold']:
            return 'SMALL', configs['SMALL']
        else:
            return 'TINY', configs['TINY']

    else:  # neighborhood
        if n_businesses >= configs['LARGE']['threshold']:
            return 'LARGE', configs['LARGE']
        elif n_businesses >= configs['MEDIUM']['threshold']:
            return 'MEDIUM', configs['MEDIUM']
        elif n_businesses >= configs['SMALL']['threshold']:
            return 'SMALL', configs['SMALL']
        elif n_businesses >= configs['TINY']['threshold']:
            return 'TINY', configs['TINY']
        else:
            return 'MICRO', configs['MICRO']


# ============================================================================
# MAIN CLUSTERING PIPELINE
# ============================================================================

def cluster_entity(
    entity_name: str,
    businesses_df: pd.DataFrame,
    embeddings_dict: Dict[str, np.ndarray],
    level: str,
    db: Session,
    cluster_run: ClusterRun
) -> List[Cluster]:
    """
    Cluster businesses for a single city or neighborhood.
    Returns list of Cluster objects.
    """
    n_businesses = len(businesses_df)
    logger.info(f"\n{'='*80}")
    logger.info(f"Clustering: {entity_name} ({level}) - {n_businesses} businesses")
    logger.info(f"{'='*80}")

    # Skip if too few businesses
    if n_businesses < 2:
        logger.warning(f"Skipping {entity_name}: too few businesses ({n_businesses})")
        return []

    # Get optimal config
    size_category, config = get_config_for_size(n_businesses, level)
    logger.info(f"Size category: {size_category}")
    logger.info(f"Config: {json.dumps(config, indent=2)}")

    # Prepare features
    features, aligned_business_ids = prepare_features(
        businesses_df,
        embeddings_dict,
        config['features']
    )

    if len(aligned_business_ids) == 0:
        logger.error(f"No features prepared for {entity_name}")
        return []

    # Apply dimensionality reduction
    reduced_features = apply_dimensionality_reduction(
        features,
        config.get('dimred'),
        config.get('dimred_params')
    )

    # Perform clustering
    labels, cluster_metadata = perform_clustering(
        reduced_features,
        config['method'],
        config['cluster_params']
    )

    # Compute quality metrics
    quality_metrics = compute_cluster_quality_metrics(reduced_features, labels)
    logger.info(f"Quality metrics: {quality_metrics}")

    # Get city and neighborhood names
    if level == 'city':
        city_name = entity_name
        neighborhood_name = None
    else:
        city_name = businesses_df['city'].iloc[0]
        neighborhood_name = entity_name

    # Create Cluster objects for each unique label
    clusters = []
    unique_labels = sorted(set(labels))

    for cluster_label in unique_labels:
        mask = labels == cluster_label
        cluster_business_ids = [aligned_business_ids[i] for i in range(len(aligned_business_ids)) if mask[i]]
        cluster_businesses = businesses_df[businesses_df['business_id'].isin(cluster_business_ids)]

        # Compute cluster statistics
        cluster_size = len(cluster_business_ids)
        avg_stars = float(cluster_businesses['stars'].mean()) if 'stars' in cluster_businesses.columns else None
        avg_review_count = float(cluster_businesses['review_count'].mean()) if 'review_count' in cluster_businesses.columns else None

        # Compute centroid
        if 'latitude' in cluster_businesses.columns and 'longitude' in cluster_businesses.columns:
            centroid_lat = float(cluster_businesses['latitude'].mean())
            centroid_lon = float(cluster_businesses['longitude'].mean())
        else:
            centroid_lat = None
            centroid_lon = None

        # Extract top categories
        top_categories = extract_top_categories(cluster_businesses)

        # Create Cluster object
        cluster = Cluster(
            run_id=cluster_run.run_id,
            city=city_name,
            neighborhood=neighborhood_name,
            cluster_label=int(cluster_label),
            method=ClusterMethod(config['method']),
            method_params=config['cluster_params'],
            size=cluster_size,
            silhouette_score=quality_metrics.get('silhouette'),
            davies_bouldin_score=quality_metrics.get('davies_bouldin'),
            calinski_harabasz_score=quality_metrics.get('calinski_harabasz'),
            composite_score=quality_metrics.get('composite_score'),
            avg_stars=avg_stars,
            avg_review_count=avg_review_count,
            centroid_lat=centroid_lat,
            centroid_lon=centroid_lon,
            top_categories=top_categories,
            # AI labels will be added later
            ai_label=None,
            ai_description=None,
            ai_key_characteristics=None
        )

        clusters.append(cluster)

        # Create BusinessCluster assignments
        probabilities = cluster_metadata.get('probabilities')
        outlier_scores = cluster_metadata.get('outlier_scores')

        for i, business_id in enumerate(cluster_business_ids):
            idx = aligned_business_ids.index(business_id)

            business_cluster = BusinessCluster(
                business_id=business_id,
                cluster_id=None,
                cluster_probability=float(probabilities[idx]) if probabilities else None,
                outlier_score=float(outlier_scores[idx]) if outlier_scores else None,
                is_noise=1 if cluster_label == -1 else 0
            )

            cluster.business_clusters.append(business_cluster)

    logger.info(f"Created {len(clusters)} clusters for {entity_name}")
    return clusters


def extract_top_categories(businesses_df: pd.DataFrame, top_n: int = 5) -> List[Dict]:
    """Extract top N categories from businesses."""
    if 'categories' not in businesses_df.columns:
        return []

    category_counts = {}

    for categories_str in businesses_df['categories'].dropna():
        if not categories_str:
            continue

        categories = [cat.strip() for cat in str(categories_str).split(',')]
        for cat in categories:
            category_counts[cat] = category_counts.get(cat, 0) + 1

    # Sort and get top N
    sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]

    return [{'category': cat, 'count': count} for cat, count in sorted_categories]


def run_clustering_pipeline(
    level: str,
    embeddings_path: Path,
    db: Session
) -> ClusterRun:
    """
    Main pipeline to cluster all entities at specified level.
    """
    start_time = time.time()

    logger.info(f"\n{'#'*80}")
    logger.info(f"# STARTING CLUSTERING PIPELINE - Level: {level.upper()}")
    logger.info(f"{'#'*80}\n")

    # Load all businesses from database
    logger.info("Loading businesses from database...")
    stmt = select(Business)
    result = db.execute(stmt)
    businesses = result.scalars().all()

    businesses_df = pd.DataFrame([
        {
            'business_id': b.business_id,
            'name': b.name,
            'city': b.city,
            'state': b.state,
            'neighborhood': b.neighborhood,
            'latitude': b.latitude,
            'longitude': b.longitude,
            'stars': b.stars,
            'review_count': b.review_count,
            'photo_count': b.photo_count,
            'categories': b.categories
        }
        for b in businesses
    ])

    logger.info(f"Loaded {len(businesses_df)} businesses")

    # Load embeddings
    embeddings_dict = load_review_embeddings(
        businesses_df['business_id'].tolist(),
        embeddings_path
    )

    if not embeddings_dict:
        raise ValueError("No embeddings loaded!")

    # Create ClusterRun
    cluster_run = ClusterRun(
        level=ClusterLevel(level),
        feature_variant='embedding_mean_only',
        dimred_method='umap',
        dimred_params={'adaptive': True},
        total_entities_processed=0,
        total_clusters_created=0
    )
    db.add(cluster_run)
    db.flush()  # Get run_id

    logger.info(f"Created ClusterRun: run_id={cluster_run.run_id}")

    # Group by city or neighborhood
    if level == 'city':
        grouped = businesses_df.groupby('city')
    else:  # neighborhood
        # Filter to businesses with neighborhoods
        businesses_with_neighborhoods = businesses_df[businesses_df['neighborhood'].notna()]
        grouped = businesses_with_neighborhoods.groupby('neighborhood')

    logger.info(f"Processing {len(grouped)} entities...")

    all_clusters = []
    composite_scores = []

    for entity_name, entity_businesses in grouped:
        try:
            clusters = cluster_entity(
                entity_name,
                entity_businesses,
                embeddings_dict,
                level,
                db,
                cluster_run
            )

            all_clusters.extend(clusters)

            # Track composite scores
            for cluster in clusters:
                if cluster.composite_score is not None:
                    composite_scores.append(cluster.composite_score)

        except Exception as e:
            logger.error(f"Error clustering {entity_name}: {e}", exc_info=True)
            continue

    # Update run statistics
    cluster_run.total_entities_processed = len(grouped)
    cluster_run.total_clusters_created = len(all_clusters)
    cluster_run.avg_composite_score = float(np.mean(composite_scores)) if composite_scores else None
    cluster_run.execution_time_seconds = time.time() - start_time

    # Save all clusters
    logger.info(f"\nSaving {len(all_clusters)} clusters to database...")
    db.add_all(all_clusters)
    db.commit()

    logger.info(f"\n{'#'*80}")
    logger.info(f"# CLUSTERING COMPLETE")
    logger.info(f"# Level: {level}")
    logger.info(f"# Entities processed: {cluster_run.total_entities_processed}")
    logger.info(f"# Clusters created: {cluster_run.total_clusters_created}")
    logger.info(f"# Avg composite score: {cluster_run.avg_composite_score:.3f}")
    logger.info(f"# Execution time: {cluster_run.execution_time_seconds:.1f}s")
    logger.info(f"{'#'*80}\n")

    return cluster_run


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Cluster businesses at city or neighborhood level')
    parser.add_argument(
        '--level',
        type=str,
        required=True,
        choices=['city', 'neighborhood', 'both'],
        help='Clustering level: city, neighborhood, or both'
    )
    parser.add_argument(
        '--embeddings-path',
        type=str,
        default='scripts/clustering/business_review_embeddings.parquet',
        help='Path to business embeddings parquet file'
    )

    args = parser.parse_args()

    embeddings_path = Path(args.embeddings_path)
    if not embeddings_path.exists():
        logger.error(f"Embeddings file not found: {embeddings_path}")
        logger.error("Please run the embedding aggregation notebook first!")
        sys.exit(1)

    # Get database session
    db = next(get_db())

    try:
        if args.level in ['city', 'both']:
            logger.info("\n" + "="*80)
            logger.info("CLUSTERING CITIES")
            logger.info("="*80)
            run_clustering_pipeline('city', embeddings_path, db)

        if args.level in ['neighborhood', 'both']:
            logger.info("\n" + "="*80)
            logger.info("CLUSTERING NEIGHBORHOODS")
            logger.info("="*80)
            run_clustering_pipeline('neighborhood', embeddings_path, db)

        logger.info("\n✓ All clustering complete!")

    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    main()
