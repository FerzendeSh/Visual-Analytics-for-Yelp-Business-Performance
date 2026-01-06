"""
Global Competitor Clustering Script

Clusters all businesses using:
- Features: embeddings + lat/long (geo_weight=50) + categories + sentiment
- UMAP: n_neighbors=30, n_components=50
- HDBSCAN: min_cluster_size=15, min_samples=5, eps=0.3
- Post-processing: Split clusters > 40 miles diameter

Exports clusters to a text file for LLM labeling.

Usage:
    python -m scripts.09_cluster_competitors
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
from sklearn.metrics import silhouette_score
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

# Clustering parameters (from experiments)
GEO_WEIGHT = 50.0
UMAP_N_NEIGHBORS = 30
UMAP_N_COMPONENTS = 50
HDBSCAN_MIN_CLUSTER_SIZE = 15
HDBSCAN_MIN_SAMPLES = 5
HDBSCAN_EPS = 0.3
MAX_CLUSTER_DIAMETER_MILES = 40

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


def extract_category_features(categories_series, top_n=30):
    """One-hot encode top categories"""
    category_counts = Counter()
    for cats in categories_series.dropna():
        if isinstance(cats, str):
            for cat in cats.split(','):
                category_counts[cat.strip()] += 1
    
    top_categories = [cat for cat, _ in category_counts.most_common(top_n)]
    cat_features = pd.DataFrame(index=categories_series.index)
    for cat in top_categories:
        col_name = f'cat_{cat.replace(" ", "_").replace("&", "and")[:25]}'
        cat_features[col_name] = categories_series.apply(
            lambda x: 1 if isinstance(x, str) and cat in x else 0
        )
    return cat_features.values, top_categories


def prepare_features(df, geo_weight=GEO_WEIGHT):
    """Prepare feature matrix"""
    print("  Preparing features...")
    
    # Embeddings
    emb_mean = np.vstack(df['embedding_mean'].values)
    emb_scaled = StandardScaler().fit_transform(emb_mean)
    
    # Coordinates (weighted)
    coords = df[['latitude', 'longitude']].fillna(df[['latitude', 'longitude']].median()).values
    coords_scaled = StandardScaler().fit_transform(coords)
    coords_weighted = coords_scaled * geo_weight
    
    # Categories
    cat_features, _ = extract_category_features(df['categories'], top_n=30)
    
    # Sentiment
    sentiment_cols = ['avg_sentiment', 'sentiment_std', 'pct_positive', 'pct_negative']
    sentiment_scaled = StandardScaler().fit_transform(
        df[sentiment_cols].fillna(df[sentiment_cols].median()).values
    )
    
    # Combine
    features = np.hstack([emb_scaled, coords_weighted, cat_features, sentiment_scaled])
    print(f"  Feature matrix shape: {features.shape}")
    
    return features


def split_large_cluster_kmeans(cluster_df, target_diameter):
    """Split cluster using KMeans on coordinates"""
    coords = cluster_df[['latitude', 'longitude']].values
    
    current_stats = cluster_geographic_stats(cluster_df)
    current_diameter = current_stats['diameter_miles']
    
    k = max(2, int(np.ceil(current_diameter / target_diameter)))
    
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    sub_labels = kmeans.fit_predict(coords)
    
    return sub_labels


def post_process_clusters(df, labels, max_diameter):
    """Recursively split clusters until all are under max_diameter"""
    new_labels = labels.copy()
    next_cluster_id = labels.max() + 1
    
    iterations = 0
    max_iterations = 10
    
    while iterations < max_iterations:
        iterations += 1
        clusters_to_split = []
        
        for cluster_id in sorted(set(new_labels[new_labels >= 0])):
            cluster_mask = new_labels == cluster_id
            cluster_df = df[cluster_mask].copy()
            
            if len(cluster_df) < 10:
                continue
                
            stats = cluster_geographic_stats(cluster_df)
            if stats['diameter_miles'] > max_diameter:
                clusters_to_split.append((cluster_id, stats['diameter_miles'], cluster_mask))
        
        if not clusters_to_split:
            print(f"  ✓ All clusters under {max_diameter} miles after {iterations} iterations")
            break
            
        print(f"  Iteration {iterations}: splitting {len(clusters_to_split)} clusters")
        
        for cluster_id, diameter, cluster_mask in clusters_to_split:
            cluster_df = df[cluster_mask]
            sub_labels = split_large_cluster_kmeans(cluster_df, target_diameter=max_diameter * 0.8)
            
            unique_sub = sorted(set(sub_labels))
            cluster_indices = df.index[cluster_mask].values
            
            for i, sub_id in enumerate(unique_sub):
                sub_mask = sub_labels == sub_id
                if i > 0:
                    new_labels[cluster_indices[sub_mask]] = next_cluster_id
                    next_cluster_id += 1
    
    return new_labels


# =============================================================================
# MAIN CLUSTERING PIPELINE
# =============================================================================

def run_clustering():
    """Run the full clustering pipeline"""
    print("="*70)
    print("COMPETITOR CLUSTERING PIPELINE")
    print("="*70)
    
    # Load data
    print("\n[1/5] Loading data...")
    business_embeddings = pd.read_parquet(EMBEDDINGS_PATH)
    business_embeddings['embedding_mean'] = business_embeddings['embedding_mean'].apply(
        lambda x: np.array(x) if isinstance(x, list) else x
    )
    business_sentiment = pd.read_parquet(SENTIMENT_PATH)
    businesses = pd.read_parquet(BUSINESSES_PATH)
    
    df = businesses.merge(business_embeddings, on='business_id', how='inner')
    df = df.merge(business_sentiment, on='business_id', how='left')
    print(f"  Loaded {len(df):,} businesses")
    
    # Prepare features
    print("\n[2/5] Preparing features...")
    features = prepare_features(df, geo_weight=GEO_WEIGHT)
    
    # UMAP dimensionality reduction
    print("\n[3/5] Running UMAP...")
    reducer = UMAP(
        n_neighbors=UMAP_N_NEIGHBORS, 
        n_components=UMAP_N_COMPONENTS, 
        min_dist=0.1, 
        random_state=42,
        verbose=True
    )
    features_reduced = reducer.fit_transform(features)
    
    # Also get 2D coordinates for visualization
    print("  Computing 2D coordinates for visualization...")
    reducer_2d = UMAP(n_neighbors=30, n_components=2, min_dist=0.1, random_state=42)
    coords_2d = reducer_2d.fit_transform(features_reduced)
    df['umap_x'] = coords_2d[:, 0]
    df['umap_y'] = coords_2d[:, 1]
    
    # HDBSCAN clustering
    print("\n[4/5] Running HDBSCAN...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=HDBSCAN_MIN_SAMPLES,
        cluster_selection_epsilon=HDBSCAN_EPS,
        metric='euclidean',
        cluster_selection_method='eom'
    )
    labels = clusterer.fit_predict(features_reduced)
    
    n_initial = len(set(labels[labels >= 0]))
    noise_pct = (labels == -1).sum() / len(labels) * 100
    print(f"  Initial clusters: {n_initial}, Noise: {noise_pct:.1f}%")
    
    # Post-process to split large clusters
    print("\n[5/5] Post-processing (splitting large clusters)...")
    df['cluster'] = labels
    final_labels = post_process_clusters(df, labels, MAX_CLUSTER_DIAMETER_MILES)
    df['cluster'] = final_labels
    
    n_final = len(set(final_labels[final_labels >= 0]))
    print(f"  Final clusters: {n_final}")
    
    return df


def export_clusters_for_labeling(df, output_path):
    """Export cluster information to text file for LLM labeling"""
    print("\n" + "="*70)
    print("EXPORTING CLUSTERS FOR LLM LABELING")
    print("="*70)
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# BUSINESS COMPETITOR CLUSTERS FOR LABELING\n")
        f.write(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# Total businesses: {len(df):,}\n")
        f.write(f"# Total clusters: {df['cluster'].nunique() - (1 if -1 in df['cluster'].values else 0)}\n")
        f.write("#\n")
        f.write("# TASK: For each cluster, provide:\n")
        f.write("#   1. A short label (3-5 words) describing the cluster\n")
        f.write("#   2. A description (1-2 sentences) of what makes these businesses similar\n")
        f.write("#   3. Key characteristics that define this competitive group\n")
        f.write("#\n")
        f.write("=" * 80 + "\n\n")
        
        for cluster_id in sorted(df[df['cluster'] >= 0]['cluster'].unique()):
            cluster_df = df[df['cluster'] == cluster_id]
            
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
            
            # Price range distribution
            price_dist = "N/A"
            if 'attributes' in cluster_df.columns:
                prices = []
                for attr in cluster_df['attributes'].dropna():
                    if isinstance(attr, dict) and 'RestaurantsPriceRange2' in attr:
                        try:
                            prices.append(int(attr['RestaurantsPriceRange2']))
                        except:
                            pass
                if prices:
                    price_dist = f"${' to $' * (int(np.mean(prices))-1)}{'$' * int(np.mean(prices))} (avg)"
            
            # Sample businesses
            sample_businesses = cluster_df.nlargest(10, 'review_count')[['name', 'city', 'state', 'categories', 'stars', 'review_count']]
            
            # Write cluster info
            f.write(f"CLUSTER {cluster_id}\n")
            f.write("-" * 40 + "\n")
            f.write(f"Size: {len(cluster_df)} businesses\n")
            f.write(f"Geographic spread: {geo_stats['diameter_miles']:.1f} miles\n")
            f.write(f"Center: ({geo_stats['center_lat']:.4f}, {geo_stats['center_lon']:.4f})\n")
            f.write(f"\n")
            
            f.write(f"LOCATION:\n")
            f.write(f"  States: {', '.join([f'{s} ({c})' for s, c in state_counts.items()])}\n")
            f.write(f"  Top cities: {', '.join([f'{city} ({cnt})' for city, cnt in city_counts.items()])}\n")
            f.write(f"\n")
            
            f.write(f"BUSINESS METRICS:\n")
            f.write(f"  Avg rating: {avg_stars:.2f} stars\n")
            f.write(f"  Avg reviews: {avg_reviews:.0f}\n")
            if avg_sentiment is not None:
                f.write(f"  Avg sentiment: {avg_sentiment:.3f}\n")
            f.write(f"  Price range: {price_dist}\n")
            f.write(f"\n")
            
            f.write(f"TOP CATEGORIES:\n")
            for cat, count in top_categories:
                pct = count / len(cluster_df) * 100
                f.write(f"  - {cat}: {count} ({pct:.0f}%)\n")
            f.write(f"\n")
            
            f.write(f"SAMPLE BUSINESSES (top 10 by review count):\n")
            for _, biz in sample_businesses.iterrows():
                f.write(f"  • {biz['name']} ({biz['city']}, {biz['state']})\n")
                f.write(f"    {biz['stars']}★ | {biz['review_count']} reviews\n")
                cats = biz['categories'][:80] + "..." if len(str(biz['categories'])) > 80 else biz['categories']
                f.write(f"    Categories: {cats}\n")
            f.write(f"\n")
            
            f.write(f"YOUR LABELS:\n")
            f.write(f"  Label: [FILL IN]\n")
            f.write(f"  Description: [FILL IN]\n")
            f.write(f"  Key characteristics: [FILL IN]\n")
            f.write(f"\n")
            f.write("=" * 80 + "\n\n")
    
    print(f"  ✓ Exported to: {output_path}")
    return output_path


def export_cluster_data_json(df, output_path):
    """Export cluster data as JSON for database import"""
    clusters_data = []
    
    for cluster_id in sorted(df[df['cluster'] >= 0]['cluster'].unique()):
        cluster_df = df[df['cluster'] == cluster_id]
        geo_stats = cluster_geographic_stats(cluster_df)
        
        # Category distribution
        all_categories = []
        for cats in cluster_df['categories'].dropna():
            if isinstance(cats, str):
                all_categories.extend([c.strip() for c in cats.split(',')])
        top_categories = [{'category': cat, 'count': cnt} 
                         for cat, cnt in Counter(all_categories).most_common(10)]
        
        cluster_data = {
            'cluster_id': int(cluster_id),
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
    
    with open(output_path, 'w') as f:
        json.dump(clusters_data, f, indent=2)
    
    print(f"  ✓ Exported JSON to: {output_path}")
    return clusters_data


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    # Run clustering
    df = run_clustering()
    
    # Export for LLM labeling
    txt_path = OUTPUT_DIR / "clusters_for_labeling.txt"
    export_clusters_for_labeling(df, txt_path)
    
    # Export JSON for database import
    json_path = OUTPUT_DIR / "clusters_data.json"
    export_cluster_data_json(df, json_path)
    
    # Summary
    print("\n" + "="*70)
    print("DONE!")
    print("="*70)
    print(f"\nOutput files:")
    print(f"  1. {txt_path}")
    print(f"     → Give this to an LLM to generate labels")
    print(f"  2. {json_path}")
    print(f"     → Use this to import clusters into the database")
