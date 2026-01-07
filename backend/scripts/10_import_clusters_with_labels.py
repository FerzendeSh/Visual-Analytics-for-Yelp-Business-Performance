"""
Import clustering data from clustering_output/clusters_data.json and clusters_labeled.txt.

This script:
1. Parses clusters_data.json for cluster metrics and business assignments
2. Parses clusters_labeled.txt for AI-generated labels and descriptions
3. Creates a ClusterRun record
4. Creates Cluster records with merged data
5. Creates BusinessCluster records for all business assignments
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database.database import async_session_maker
from models.cluster import ClusterRun, Cluster, BusinessCluster, ClusterLevel, ClusterMethod
from repositories.cluster_repository import ClusterRepository


async def clear_existing_clusters(db: AsyncSession):
    """Clear all existing clustering data before importing new data."""
    print("\n" + "=" * 80)
    print("CLEARING EXISTING CLUSTER DATA")
    print("=" * 80)
    
    # Delete in correct order due to foreign key constraints
    result = await db.execute(text("DELETE FROM business_clusters"))
    bc_count = result.rowcount
    print(f"  [OK] Deleted {bc_count} rows from business_clusters")
    
    result = await db.execute(text("DELETE FROM clusters"))
    c_count = result.rowcount
    print(f"  [OK] Deleted {c_count} rows from clusters")
    
    result = await db.execute(text("DELETE FROM cluster_runs"))
    cr_count = result.rowcount
    print(f"  [OK] Deleted {cr_count} rows from cluster_runs")
    
    print(f"\n  Total cleared: {bc_count + c_count + cr_count} rows")


def parse_clusters_labeled_txt(filepath: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse clusters_labeled.txt to extract AI labels and descriptions.

    Returns:
        Dict mapping cluster_id (e.g., "R0_C0") to {label, description, characteristics}
    """
    labels_dict = {}

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by cluster sections
    cluster_sections = re.split(r'={80,}', content)

    for section in cluster_sections:
        if not section.strip() or 'CLUSTER' not in section:
            continue

        # Extract cluster ID (format: R0_C0, R1_C5, etc.)
        cluster_match = re.search(r'CLUSTER (R\d+_C\d+)', section)
        if not cluster_match:
            continue

        cluster_id = cluster_match.group(1)

        # Extract label
        label_match = re.search(r'Label:\s*(.+?)$', section, re.MULTILINE)
        label = label_match.group(1).strip() if label_match else None

        # Extract description
        desc_match = re.search(r'Description:\s*(.+?)$', section, re.MULTILINE)
        description = desc_match.group(1).strip() if desc_match else None

        # Extract key characteristics
        char_match = re.search(r'Key characteristics:\s*(.+?)$', section, re.MULTILINE)
        characteristics = None
        if char_match:
            char_str = char_match.group(1).strip()
            # Split by comma and clean up
            characteristics = [c.strip() for c in char_str.split(',')]

        labels_dict[cluster_id] = {
            'label': label,
            'description': description,
            'characteristics': characteristics
        }

    return labels_dict


def load_clusters_json(filepath: Path) -> List[Dict[str, Any]]:
    """Load clusters_data.json."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


async def import_clusters():
    """Main import function."""
    print("=" * 80)
    print("CLUSTER DATA IMPORT")
    print("=" * 80)

    # File paths
    script_dir = Path(__file__).parent
    clusters_json_path = script_dir / 'clustering_output' / 'clusters_data.json'
    clusters_txt_path = script_dir / 'clustering_output' / 'clusters_labeled.txt'

    # Verify files exist
    if not clusters_json_path.exists():
        print(f"ERROR: {clusters_json_path} not found!")
        return

    if not clusters_txt_path.exists():
        print(f"ERROR: {clusters_txt_path} not found!")
        return

    print(f"\nLoading data from:")
    print(f"  - {clusters_json_path}")
    print(f"  - {clusters_txt_path}")

    # Parse both files
    print("\nParsing clusters_data.json...")
    clusters_data = load_clusters_json(clusters_json_path)
    print(f"  [OK] Loaded {len(clusters_data)} clusters")

    print("\nParsing clusters_labeled.txt...")
    labels_dict = parse_clusters_labeled_txt(clusters_txt_path)
    print(f"  [OK] Parsed labels for {len(labels_dict)} clusters")

    # Get database session
    async with async_session_maker() as db:
        try:
            # Clear existing data first (full replacement)
            await clear_existing_clusters(db)
            
            repo = ClusterRepository(db)

            # Create ClusterRun
            print("\n" + "=" * 80)
            print("CREATING CLUSTER RUN")
            print("=" * 80)

            total_businesses = sum(len(c['business_ids']) for c in clusters_data)

            run_data = {
                'level': ClusterLevel.CITY,  # Using CITY as hack for global clustering
                'feature_variant': 'embeddings+geo+categories+sentiment',
                'dimred_method': 'UMAP',
                'dimred_params': {
                    'n_neighbors': 30,
                    'n_components': 50,
                    'min_dist': 0.0,
                    'metric': 'cosine'
                },
                'total_entities_processed': 1,  # 1 "entity" (global)
                'total_clusters_created': len(clusters_data),
                'avg_composite_score': None,
                'execution_time_seconds': None,
                'notes': f'Global clustering run. {len(clusters_data)} clusters, {total_businesses} businesses total.'
            }

            cluster_run = await repo.create_cluster_run(run_data)
            print(f"\n[OK] Created ClusterRun (run_id={cluster_run.run_id})")
            print(f"  - Level: {cluster_run.level}")
            print(f"  - Clusters: {cluster_run.total_clusters_created}")
            print(f"  - Total businesses: {total_businesses}")

            # Create Clusters
            print("\n" + "=" * 80)
            print("CREATING CLUSTERS")
            print("=" * 80)

            clusters_to_insert = []
            business_clusters_to_insert = []

            for idx, cluster_data in enumerate(clusters_data):
                cluster_id_from_json = cluster_data['cluster_id']  # e.g., "R0_C5"
                labels = labels_dict.get(cluster_id_from_json, {})

                # Determine primary city from top_cities
                top_cities = cluster_data.get('top_cities', {})
                primary_city = list(top_cities.keys())[0] if top_cities else 'GLOBAL'

                # Use sequential index as cluster_label (integer required by schema)
                # The hierarchical ID (R0_C5) is preserved in ai_label prefix
                cluster_record = {
                    'run_id': cluster_run.run_id,
                    'city': primary_city,
                    'neighborhood': None,
                    'cluster_label': idx,  # Sequential integer index
                    'method': ClusterMethod.HDBSCAN,
                    'method_params': {
                        'min_cluster_size': 15,
                        'min_samples': 5,
                        'cluster_selection_epsilon': 0.0,
                        'metric': 'euclidean'
                    },
                    'size': cluster_data['size'],
                    'silhouette_score': None,
                    'davies_bouldin_score': None,
                    'calinski_harabasz_score': None,
                    'composite_score': None,
                    'avg_stars': cluster_data.get('avg_stars'),
                    'avg_review_count': cluster_data.get('avg_review_count'),
                    'avg_price_range': None,
                    'centroid_lat': cluster_data.get('center_lat'),
                    'centroid_lon': cluster_data.get('center_lon'),
                    'ai_label': labels.get('label'),
                    'ai_description': labels.get('description'),
                    'ai_key_characteristics': labels.get('characteristics'),
                    'top_categories': cluster_data.get('top_categories', []),
                    'attribute_patterns': None
                }

                clusters_to_insert.append(cluster_record)

                if (idx + 1) % 10 == 0:
                    print(f"  Prepared {idx + 1}/{len(clusters_data)} clusters...")

            print(f"\n[OK] Prepared {len(clusters_to_insert)} cluster records")

            # Bulk insert clusters
            print("\nInserting clusters into database...")
            created_clusters = await repo.create_clusters_bulk(clusters_to_insert)
            print(f"[OK] Inserted {len(created_clusters)} clusters")

            # Create mapping from sequential index to database cluster_id
            # clusters_data and created_clusters are in the same order
            idx_to_cluster_id = {
                idx: c.cluster_id for idx, c in enumerate(created_clusters)
            }

            # Create BusinessCluster records
            print("\n" + "=" * 80)
            print("CREATING BUSINESS-CLUSTER ASSIGNMENTS")
            print("=" * 80)

            for idx, cluster_data in enumerate(clusters_data):
                cluster_id = idx_to_cluster_id[idx]  # Use sequential index
                business_ids = cluster_data['business_ids']

                for business_id in business_ids:
                    business_cluster = {
                        'business_id': business_id,
                        'cluster_id': cluster_id,
                        'distance_to_centroid': None,
                        'cluster_probability': None,
                        'outlier_score': None,
                        'umap_x': None,
                        'umap_y': None,
                        'is_noise': False
                    }
                    business_clusters_to_insert.append(business_cluster)

                if (idx + 1) % 10 == 0:
                    print(f"  Prepared assignments for {idx + 1}/{len(clusters_data)} clusters...")

            print(f"\n[OK] Prepared {len(business_clusters_to_insert)} business-cluster assignments")

            # Bulk insert business clusters
            print("\nInserting business-cluster assignments...")
            await repo.create_business_clusters_bulk(business_clusters_to_insert)
            print(f"[OK] Inserted {len(business_clusters_to_insert)} business-cluster assignments")

            # Commit transaction
            await db.commit()

            print("\n" + "=" * 80)
            print("IMPORT COMPLETE!")
            print("=" * 80)
            print(f"\nSummary:")
            print(f"  - ClusterRun ID: {cluster_run.run_id}")
            print(f"  - Clusters created: {len(created_clusters)}")
            print(f"  - Business assignments: {len(business_clusters_to_insert)}")
            print(f"  - Average cluster size: {len(business_clusters_to_insert) / len(created_clusters):.1f} businesses")

            # Show sample clusters
            print(f"\nSample clusters:")
            for cluster in created_clusters[:5]:
                print(f"  - Cluster {cluster.cluster_label}: {cluster.ai_label} ({cluster.size} businesses)")

        except Exception as e:
            await db.rollback()
            print(f"\nERROR: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(import_clusters())
