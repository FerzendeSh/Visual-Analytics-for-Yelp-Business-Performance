"""
Two-Phase Competitor Clustering Script (v2)

Phase 1: Geographic clustering (group businesses by metro area)
  - Uses high geo_weight to create regional groups
  - Businesses near city boundaries stay together
  
Phase 2: Semantic sub-clustering within each region
  - Uses ONLY semantic features (embeddings + categories + sentiment)
  - NO geography - pure business-type clustering
  - HDBSCAN finds natural competitor groups dynamically

Output:
  - Hierarchical cluster IDs: region_id.subcluster_id (e.g., "7.3" = region 7, competitor group 3)
  - Noise points preserved (businesses with no direct competitors)

Usage:
    python -m scripts.09_cluster_competitors_v2
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from collections import Counter
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from umap import UMAP
import hdbscan

# =============================================================================
# CONFIGURATION
# =============================================================================

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent / "notebooks"
EMBEDDINGS_PATH = BASE_DIR / "business_review_embeddings.parquet"
SENTIMENT_PATH = BASE_DIR / "business_sentiment_aggregated.parquet"
BUSINESSES_PATH = BASE_DIR / "businesses_enriched.parquet"
OUTPUT_DIR = Path(__file__).resolve().parent / "clustering_output"

# Phase 1: Geographic clustering parameters
GEO_WEIGHT_PHASE1 = 50.0  # High weight to group by metro area
UMAP_N_NEIGHBORS_P1 = 30
UMAP_N_COMPONENTS_P1 = 20  # Lower dims for geographic clustering
HDBSCAN_MIN_CLUSTER_SIZE_P1 = 50  # Larger min size for regions
HDBSCAN_MIN_SAMPLES_P1 = 10
MAX_REGION_DIAMETER_MILES = 50  # Split regions larger than this

# Phase 2: Semantic sub-clustering parameters (NO geography!)
UMAP_N_NEIGHBORS_P2 = 15  # Smaller for finer local structure
UMAP_N_COMPONENTS_P2 = 30
HDBSCAN_MIN_CLUSTER_SIZE_P2 = 5   # Smaller - find niche competitor groups
HDBSCAN_MIN_SAMPLES_P2 = 3
MIN_REGION_SIZE_FOR_SUBCLUSTERING = 15  # Don't subcluster tiny regions

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def haversine_miles(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in miles"""
    R = 3959  # Earth's radius in miles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def cluster_geographic_stats(cluster_df):
    """Calculate geographic spread stats for a cluster"""
    lats = cluster_df['latitude'].values
    lons = cluster_df['longitude'].values
    
    center_lat = lats.mean()
    center_lon = lons.mean()
    
    # Max distance between sampled points (diameter estimate)
    max_dist = 0
    if len(lats) > 1:
        sample_size = min(100, len(lats))
        sample_idx = np.random.choice(len(lats), sample_size, replace=False)
        for i in sample_idx:
            for j in sample_idx:
                if i < j:
                    d = haversine_miles(lats[i], lons[i], lats[j], lons[j])
                    max_dist = max(max_dist, d)
    
    return {
        'center_lat': center_lat,
        'center_lon': center_lon,
        'diameter_miles': max_dist
    }


def extract_category_features(categories_series, top_n=50):
    """One-hot encode top categories"""
    category_counts = Counter()
    for cats in categories_series.dropna():
        if isinstance(cats, str):
            for cat in cats.split(','):
                category_counts[cat.strip()] += 1
    
    top_categories = [cat for cat, _ in category_counts.most_common(top_n)]
    cat_features = pd.DataFrame(index=categories_series.index)
    for cat in top_categories:
        col_name = f'cat_{cat.replace(" ", "_").replace("&", "and")[:30]}'
        cat_features[col_name] = categories_series.apply(
            lambda x: 1 if isinstance(x, str) and cat in x else 0
        )
    return cat_features.values, top_categories


# =============================================================================
# PHASE 1: GEOGRAPHIC CLUSTERING
# =============================================================================

def prepare_geographic_features(df):
    """Prepare features emphasizing geography for Phase 1"""
    print("  Preparing geographic-focused features...")
    
    # Embeddings (light weight)
    emb_mean = np.vstack(df['embedding_mean'].values)
    emb_scaled = StandardScaler().fit_transform(emb_mean)
    
    # Coordinates (HEAVY weight for geographic clustering)
    coords = df[['latitude', 'longitude']].fillna(df[['latitude', 'longitude']].median()).values
    coords_scaled = StandardScaler().fit_transform(coords)
    coords_weighted = coords_scaled * GEO_WEIGHT_PHASE1
    
    # Combine (geo dominates)
    features = np.hstack([emb_scaled, coords_weighted])
    print(f"  Phase 1 feature matrix: {features.shape}")
    
    return features


def run_geographic_clustering(df):
    """Phase 1: Cluster by geographic region"""
    print("\n" + "="*70)
    print("PHASE 1: GEOGRAPHIC CLUSTERING (Metro Area Detection)")
    print("="*70)
    
    features = prepare_geographic_features(df)
    
    # UMAP reduction
    print("\n  Running UMAP (geographic focus)...")
    reducer = UMAP(
        n_neighbors=UMAP_N_NEIGHBORS_P1,
        n_components=UMAP_N_COMPONENTS_P1,
        min_dist=0.1,
        random_state=42,
        verbose=False
    )
    features_reduced = reducer.fit_transform(features)
    
    # HDBSCAN clustering
    print("  Running HDBSCAN...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE_P1,
        min_samples=HDBSCAN_MIN_SAMPLES_P1,
        cluster_selection_epsilon=0.3,
        metric='euclidean',
        cluster_selection_method='eom'
    )
    region_labels = clusterer.fit_predict(features_reduced)
    
    n_regions = len(set(region_labels[region_labels >= 0]))
    noise_count = (region_labels == -1).sum()
    print(f"  Initial regions: {n_regions}")
    print(f"  Geographic noise: {noise_count} businesses ({noise_count/len(df)*100:.1f}%)")
    
    # Post-process: split any region > MAX_REGION_DIAMETER_MILES
    region_labels = split_large_regions(df, region_labels)
    
    return region_labels


def split_large_regions(df, labels):
    """Split regions that are too geographically spread"""
    new_labels = labels.copy()
    next_region_id = labels.max() + 1
    
    for region_id in sorted(set(labels[labels >= 0])):
        mask = labels == region_id
        region_df = df[mask]
        
        if len(region_df) < 20:
            continue
            
        stats = cluster_geographic_stats(region_df)
        
        if stats['diameter_miles'] > MAX_REGION_DIAMETER_MILES:
            print(f"  Splitting region {region_id}: {stats['diameter_miles']:.0f} mi diameter, {len(region_df)} businesses")
            
            # K-means split based on coordinates
            coords = region_df[['latitude', 'longitude']].values
            k = max(2, int(np.ceil(stats['diameter_miles'] / (MAX_REGION_DIAMETER_MILES * 0.7))))
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            sub_labels = kmeans.fit_predict(coords)
            
            indices = df.index[mask].values
            for sub_id in range(1, k):
                sub_mask = sub_labels == sub_id
                new_labels[indices[sub_mask]] = next_region_id
                next_region_id += 1
    
    final_regions = len(set(new_labels[new_labels >= 0]))
    print(f"  Final regions after splitting: {final_regions}")
    
    return new_labels


# =============================================================================
# PHASE 2: SEMANTIC SUB-CLUSTERING (NO GEOGRAPHY!)
# =============================================================================

def prepare_semantic_features(df, global_categories=None):
    """Prepare PURE semantic features for Phase 2 - NO GEOGRAPHY"""
    
    # Embeddings (main signal)
    emb_mean = np.vstack(df['embedding_mean'].values)
    emb_scaled = StandardScaler().fit_transform(emb_mean)
    
    # Categories (important for business type)
    if global_categories is not None:
        # Use global category list for consistency
        cat_features = np.zeros((len(df), len(global_categories)))
        for i, cats in enumerate(df['categories'].values):
            if isinstance(cats, str):
                for j, cat in enumerate(global_categories):
                    if cat in cats:
                        cat_features[i, j] = 1
    else:
        cat_features, _ = extract_category_features(df['categories'], top_n=50)
    
    cat_scaled = StandardScaler().fit_transform(cat_features)
    
    # Sentiment features
    sentiment_cols = ['avg_sentiment', 'sentiment_std', 'pct_positive', 'pct_negative']
    available_cols = [c for c in sentiment_cols if c in df.columns]
    if available_cols:
        sentiment_data = df[available_cols].fillna(df[available_cols].median()).values
        sentiment_scaled = StandardScaler().fit_transform(sentiment_data)
    else:
        sentiment_scaled = np.zeros((len(df), 1))
    
    # Combine: embeddings + categories + sentiment (NO COORDINATES!)
    features = np.hstack([emb_scaled, cat_scaled, sentiment_scaled])
    
    return features


def subcluster_region(region_df, region_id, global_categories):
    """Sub-cluster a single region by business type (semantic only)"""
    
    n_businesses = len(region_df)
    
    # Too small to subcluster meaningfully
    if n_businesses < MIN_REGION_SIZE_FOR_SUBCLUSTERING:
        # Assign all to subcluster 0
        return np.zeros(n_businesses, dtype=int)
    
    # Prepare semantic features (NO geography!)
    features = prepare_semantic_features(region_df, global_categories)
    
    # UMAP for semantic clustering
    n_neighbors = min(UMAP_N_NEIGHBORS_P2, n_businesses - 1)
    n_components = min(UMAP_N_COMPONENTS_P2, n_businesses - 2, features.shape[1] - 1)
    
    if n_components < 2 or n_neighbors < 2:
        return np.zeros(n_businesses, dtype=int)
    
    try:
        reducer = UMAP(
            n_neighbors=n_neighbors,
            n_components=n_components,
            min_dist=0.05,
            random_state=42,
            verbose=False
        )
        features_reduced = reducer.fit_transform(features)
    except Exception as e:
        print(f"    UMAP failed for region {region_id}: {e}")
        return np.zeros(n_businesses, dtype=int)
    
    # HDBSCAN for competitor group detection
    min_cluster = min(HDBSCAN_MIN_CLUSTER_SIZE_P2, max(3, n_businesses // 10))
    
    try:
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster,
            min_samples=HDBSCAN_MIN_SAMPLES_P2,
            cluster_selection_epsilon=0.0,  # Let HDBSCAN decide
            metric='euclidean',
            cluster_selection_method='eom'
        )
        sub_labels = clusterer.fit_predict(features_reduced)
    except Exception as e:
        print(f"    HDBSCAN failed for region {region_id}: {e}")
        return np.zeros(n_businesses, dtype=int)
    
    return sub_labels


def run_semantic_subclustering(df, region_labels):
    """Phase 2: Sub-cluster each region by business type"""
    print("\n" + "="*70)
    print("PHASE 2: SEMANTIC SUB-CLUSTERING (Business Type Detection)")
    print("="*70)
    
    # Get global category list for consistent encoding
    _, global_categories = extract_category_features(df['categories'], top_n=50)
    
    # Store final hierarchical labels
    final_labels = []  # List of (region_id, subcluster_id) tuples
    
    unique_regions = sorted(set(region_labels[region_labels >= 0]))
    print(f"\n  Processing {len(unique_regions)} regions...")
    
    total_subclusters = 0
    total_noise = 0
    
    for region_id in unique_regions:
        mask = region_labels == region_id
        region_df = df[mask].copy()
        region_df = region_df.reset_index(drop=True)
        
        # Sub-cluster this region
        sub_labels = subcluster_region(region_df, region_id, global_categories)
        
        n_subclusters = len(set(sub_labels[sub_labels >= 0]))
        n_noise = (sub_labels == -1).sum()
        
        # Get top cities for logging
        top_cities = region_df['city'].value_counts().head(3).index.tolist()
        cities_str = ", ".join(top_cities)
        
        print(f"  Region {region_id:2d} ({len(region_df):4d} biz, {cities_str}): "
              f"{n_subclusters} competitor groups, {n_noise} unique")
        
        total_subclusters += n_subclusters
        total_noise += n_noise
        
        # Store hierarchical labels
        for i, sub_label in enumerate(sub_labels):
            idx = df.index[mask][i]
            if sub_label >= 0:
                final_labels.append((idx, region_id, sub_label))
            else:
                final_labels.append((idx, region_id, -1))  # Noise within region
    
    # Handle global noise (not assigned to any region)
    global_noise_mask = region_labels == -1
    for idx in df.index[global_noise_mask]:
        final_labels.append((idx, -1, -1))  # Global noise
    
    print(f"\n  Total competitor groups: {total_subclusters}")
    print(f"  Unique businesses (no competitors): {total_noise + global_noise_mask.sum()}")
    
    return final_labels


# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

def create_hierarchical_cluster_id(region_id, subcluster_id):
    """Create a hierarchical cluster ID string"""
    if region_id == -1:
        return "NOISE"
    elif subcluster_id == -1:
        return f"R{region_id}_UNIQUE"
    else:
        return f"R{region_id}_C{subcluster_id}"


def export_clusters_for_labeling(df, final_labels, output_path):
    """Export cluster information to text file for LLM labeling"""
    print("\n" + "="*70)
    print("EXPORTING CLUSTERS FOR LLM LABELING")
    print("="*70)
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Build DataFrame with hierarchical labels
    label_df = pd.DataFrame(final_labels, columns=['idx', 'region_id', 'subcluster_id'])
    label_df = label_df.set_index('idx')
    
    df = df.copy()
    df['region_id'] = label_df['region_id']
    df['subcluster_id'] = label_df['subcluster_id']
    df['cluster_id'] = df.apply(
        lambda r: create_hierarchical_cluster_id(r['region_id'], r['subcluster_id']), 
        axis=1
    )
    
    # Group by hierarchical cluster
    cluster_groups = df[df['cluster_id'] != 'NOISE'].groupby('cluster_id')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # Header
        f.write("# BUSINESS COMPETITOR CLUSTERS FOR LABELING (v2 - Hierarchical)\n")
        f.write(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# Total businesses: {len(df):,}\n")
        
        n_regions = df['region_id'].nunique() - (1 if -1 in df['region_id'].values else 0)
        n_clusters = len(cluster_groups)
        n_noise = (df['cluster_id'] == 'NOISE').sum()
        n_unique = df['cluster_id'].str.contains('UNIQUE').sum()
        
        f.write(f"# Geographic regions: {n_regions}\n")
        f.write(f"# Competitor clusters: {n_clusters}\n")
        f.write(f"# Unique businesses (no direct competitors): {n_unique}\n")
        f.write(f"# Global noise: {n_noise}\n")
        f.write("#\n")
        f.write("# STRUCTURE: Each cluster is Region_Subcluster (e.g., R7_C3 = Region 7, Competitor Group 3)\n")
        f.write("# Businesses in the same cluster are DIRECT COMPETITORS (same area + same business type)\n")
        f.write("#\n")
        f.write("=" * 80 + "\n\n")
        
        # Export each cluster
        for cluster_id in sorted(cluster_groups.groups.keys()):
            if 'UNIQUE' in cluster_id:
                continue  # Skip unique businesses for labeling (no cluster to label)
                
            cluster_df = cluster_groups.get_group(cluster_id)
            
            # Geographic stats
            geo_stats = cluster_geographic_stats(cluster_df)
            
            # Category distribution
            all_categories = []
            for cats in cluster_df['categories'].dropna():
                if isinstance(cats, str):
                    all_categories.extend([c.strip() for c in cats.split(',')])
            top_categories = Counter(all_categories).most_common(10)
            
            # Location info
            city_counts = cluster_df['city'].value_counts().head(5)
            state_counts = cluster_df['state'].value_counts()
            
            # Business stats
            avg_stars = cluster_df['stars'].mean()
            avg_reviews = cluster_df['review_count'].mean()
            avg_sentiment = cluster_df['avg_sentiment'].mean() if 'avg_sentiment' in cluster_df else None
            
            # Sample businesses
            sample_businesses = cluster_df.nlargest(10, 'review_count')[
                ['name', 'city', 'state', 'categories', 'stars', 'review_count']
            ]
            
            # Write cluster info
            f.write(f"CLUSTER {cluster_id}\n")
            f.write("-" * 40 + "\n")
            f.write(f"Size: {len(cluster_df)} businesses\n")
            f.write(f"Geographic spread: {geo_stats['diameter_miles']:.1f} miles\n")
            f.write(f"Center: ({geo_stats['center_lat']:.4f}, {geo_stats['center_lon']:.4f})\n\n")
            
            f.write(f"LOCATION:\n")
            f.write(f"  States: {', '.join([f'{s} ({c})' for s, c in state_counts.items()])}\n")
            f.write(f"  Top cities: {', '.join([f'{city} ({cnt})' for city, cnt in city_counts.items()])}\n\n")
            
            f.write(f"BUSINESS METRICS:\n")
            f.write(f"  Avg rating: {avg_stars:.2f} stars\n")
            f.write(f"  Avg reviews: {avg_reviews:.0f}\n")
            if avg_sentiment is not None:
                f.write(f"  Avg sentiment: {avg_sentiment:.3f}\n")
            f.write("\n")
            
            f.write(f"TOP CATEGORIES:\n")
            for cat, count in top_categories:
                pct = count / len(cluster_df) * 100
                f.write(f"  - {cat}: {count} ({pct:.0f}%)\n")
            f.write("\n")
            
            f.write(f"SAMPLE BUSINESSES (top 10 by review count):\n")
            for _, biz in sample_businesses.iterrows():
                f.write(f"  • {biz['name']} ({biz['city']}, {biz['state']})\n")
                f.write(f"    {biz['stars']}★ | {biz['review_count']} reviews\n")
                cats = str(biz['categories'])
                cats = cats[:80] + "..." if len(cats) > 80 else cats
                f.write(f"    Categories: {cats}\n")
            f.write("\n")
            
            f.write(f"YOUR LABELS:\n")
            f.write(f"  Label: [FILL IN]\n")
            f.write(f"  Description: [FILL IN]\n")
            f.write(f"  Key characteristics: [FILL IN]\n\n")
            f.write("=" * 80 + "\n\n")
    
    print(f"  ✓ Exported to: {output_path}")
    return output_path


def export_cluster_data_json(df, final_labels, output_path):
    """Export cluster data as JSON for database import"""
    
    # Build DataFrame with hierarchical labels
    label_df = pd.DataFrame(final_labels, columns=['idx', 'region_id', 'subcluster_id'])
    label_df = label_df.set_index('idx')
    
    df = df.copy()
    df['region_id'] = label_df['region_id']
    df['subcluster_id'] = label_df['subcluster_id']
    df['cluster_id'] = df.apply(
        lambda r: create_hierarchical_cluster_id(r['region_id'], r['subcluster_id']), 
        axis=1
    )
    
    clusters_data = []
    
    # Group by hierarchical cluster
    for cluster_id in sorted(df['cluster_id'].unique()):
        if cluster_id == 'NOISE':
            continue
            
        cluster_df = df[df['cluster_id'] == cluster_id]
        geo_stats = cluster_geographic_stats(cluster_df)
        
        # Category distribution
        all_categories = []
        for cats in cluster_df['categories'].dropna():
            if isinstance(cats, str):
                all_categories.extend([c.strip() for c in cats.split(',')])
        top_categories = [{'category': cat, 'count': cnt} 
                         for cat, cnt in Counter(all_categories).most_common(10)]
        
        is_unique = 'UNIQUE' in cluster_id
        
        cluster_data = {
            'cluster_id': cluster_id,
            'region_id': int(cluster_df['region_id'].iloc[0]),
            'subcluster_id': int(cluster_df['subcluster_id'].iloc[0]) if not is_unique else None,
            'is_unique_business_cluster': is_unique,
            'size': len(cluster_df),
            'center_lat': geo_stats['center_lat'],
            'center_lon': geo_stats['center_lon'],
            'diameter_miles': geo_stats['diameter_miles'],
            'avg_stars': float(cluster_df['stars'].mean()),
            'avg_review_count': float(cluster_df['review_count'].mean()),
            'top_categories': top_categories,
            'states': cluster_df['state'].value_counts().to_dict(),
            'top_cities': cluster_df['city'].value_counts().head(5).to_dict(),
            'business_ids': cluster_df['business_id'].tolist()
        }
        clusters_data.append(cluster_data)
    
    # Also export noise businesses
    noise_df = df[df['cluster_id'] == 'NOISE']
    if len(noise_df) > 0:
        noise_data = {
            'cluster_id': 'NOISE',
            'region_id': -1,
            'subcluster_id': -1,
            'is_unique_business_cluster': True,
            'size': len(noise_df),
            'center_lat': None,
            'center_lon': None,
            'diameter_miles': None,
            'avg_stars': float(noise_df['stars'].mean()),
            'avg_review_count': float(noise_df['review_count'].mean()),
            'top_categories': [],
            'states': noise_df['state'].value_counts().to_dict(),
            'top_cities': noise_df['city'].value_counts().head(5).to_dict(),
            'business_ids': noise_df['business_id'].tolist()
        }
        clusters_data.append(noise_data)
    
    with open(output_path, 'w') as f:
        json.dump(clusters_data, f, indent=2)
    
    print(f"  ✓ Exported JSON to: {output_path}")
    
    # Summary stats
    real_clusters = [c for c in clusters_data if not c['is_unique_business_cluster']]
    unique_clusters = [c for c in clusters_data if c['is_unique_business_cluster'] and c['cluster_id'] != 'NOISE']
    
    print(f"\n  Summary:")
    print(f"    Competitor clusters: {len(real_clusters)}")
    print(f"    Unique business groups: {len(unique_clusters)}")
    print(f"    Total businesses in clusters: {sum(c['size'] for c in real_clusters)}")
    print(f"    Unique businesses (no competitors): {sum(c['size'] for c in unique_clusters)}")
    print(f"    Global noise: {len(noise_df)}")
    
    return clusters_data


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline():
    """Run the full two-phase clustering pipeline"""
    print("="*70)
    print("TWO-PHASE COMPETITOR CLUSTERING PIPELINE (v2)")
    print("="*70)
    
    # Load data
    print("\n[1/4] Loading data...")
    business_embeddings = pd.read_parquet(EMBEDDINGS_PATH)
    business_embeddings['embedding_mean'] = business_embeddings['embedding_mean'].apply(
        lambda x: np.array(x) if isinstance(x, list) else x
    )
    business_sentiment = pd.read_parquet(SENTIMENT_PATH)
    businesses = pd.read_parquet(BUSINESSES_PATH)
    
    df = businesses.merge(business_embeddings, on='business_id', how='inner')
    df = df.merge(business_sentiment, on='business_id', how='left')
    print(f"  Loaded {len(df):,} businesses")
    print(f"  States: {df['state'].nunique()}")
    print(f"  Cities: {df['city'].nunique()}")
    
    # Phase 1: Geographic clustering
    print("\n[2/4] Phase 1: Geographic Clustering...")
    region_labels = run_geographic_clustering(df)
    
    # Phase 2: Semantic sub-clustering
    print("\n[3/4] Phase 2: Semantic Sub-clustering...")
    final_labels = run_semantic_subclustering(df, region_labels)
    
    # Export
    print("\n[4/4] Exporting results...")
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    txt_path = OUTPUT_DIR / "clusters_for_labeling.txt"
    export_clusters_for_labeling(df, final_labels, txt_path)
    
    json_path = OUTPUT_DIR / "clusters_data.json"
    export_cluster_data_json(df, final_labels, json_path)
    
    # Done
    print("\n" + "="*70)
    print("DONE!")
    print("="*70)
    print(f"\nOutput files:")
    print(f"  1. {txt_path}")
    print(f"     → Give this to an LLM to generate labels")
    print(f"  2. {json_path}")
    print(f"     → Use this to import clusters into the database")
    
    return df, final_labels


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    df, final_labels = run_pipeline()
