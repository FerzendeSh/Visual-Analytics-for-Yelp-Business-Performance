"""
Debug cluster timeline metrics to find why old years show zeros.

This script:
1. Checks a specific cluster's timeline data
2. Verifies the underlying review data for businesses in that cluster
3. Identifies where the calculation breaks down
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, func, extract, text
from database.database import async_session_maker
from models.cluster import Cluster, BusinessCluster, ClusterRun
from models.review import Review
from models.metrics import ClusterTimelineMetrics


async def debug_cluster_timeline():
    async with async_session_maker() as session:
        print("\n" + "=" * 80)
        print("CLUSTER TIMELINE METRICS DEBUG")
        print("=" * 80)

        # Get latest cluster run
        result = await session.execute(
            select(ClusterRun).order_by(ClusterRun.created_at.desc()).limit(1)
        )
        latest_run = result.scalar_one_or_none()

        if not latest_run:
            print("ERROR: No cluster runs found!")
            return

        print(f"\nLatest Run: {latest_run.run_id} (created {latest_run.created_at})")

        # Get a sample cluster (first non-noise cluster)
        result = await session.execute(
            select(Cluster)
            .where(Cluster.run_id == latest_run.run_id)
            .where(Cluster.cluster_label != -1)
            .order_by(Cluster.size.desc())
            .limit(1)
        )
        cluster = result.scalar_one_or_none()

        if not cluster:
            print("ERROR: No clusters found!")
            return

        print(f"\nTesting Cluster: {cluster.cluster_id}")
        print(f"  Label: {cluster.ai_label}")
        print(f"  Size: {cluster.size} businesses")
        print(f"  City: {cluster.city}")

        # Get business IDs in cluster
        result = await session.execute(
            select(BusinessCluster.business_id)
            .where(BusinessCluster.cluster_id == cluster.cluster_id)
        )
        business_ids = [row[0] for row in result.all()]
        print(f"\n  Business IDs in cluster: {len(business_ids)}")

        # Check raw review data by year
        print("\n" + "=" * 80)
        print("RAW REVIEW DATA (directly from reviews table)")
        print("=" * 80)

        result = await session.execute(
            select(
                extract('year', Review.date).label('year'),
                func.avg(Review.stars).label('avg_rating'),
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment'),
                func.count(Review.review_id).label('review_count')
            )
            .where(Review.business_id.in_(business_ids))
            .group_by('year')
            .order_by('year')
        )

        raw_data = result.all()
        print(f"\n{'Year':<10} {'Avg Rating':<15} {'Avg Sentiment':<20} {'Review Count':<15}")
        print("-" * 80)
        for row in raw_data:
            year, avg_rating, avg_sentiment, review_count = row
            print(f"{int(year):<10} {avg_rating:<15.3f} {avg_sentiment or 0:<20.6f} {review_count:<15}")

        # Check what's stored in ClusterTimelineMetrics
        print("\n" + "=" * 80)
        print("STORED CLUSTER TIMELINE METRICS (from cluster_timeline_metrics table)")
        print("=" * 80)

        result = await session.execute(
            select(ClusterTimelineMetrics)
            .where(ClusterTimelineMetrics.cluster_id == cluster.cluster_id)
            .where(ClusterTimelineMetrics.period_type == 'year')
            .order_by(ClusterTimelineMetrics.period_start)
        )

        stored_metrics = result.scalars().all()

        if not stored_metrics:
            print("\nWARNING: No metrics found in cluster_timeline_metrics table!")
            print("This means the script 11_compute_cluster_metrics.py hasn't been run.")
        else:
            print(f"\n{'Year':<10} {'Avg Rating':<15} {'Avg Sentiment':<20} {'Review Count':<15}")
            print("-" * 80)
            for metric in stored_metrics:
                year = metric.period_start.year
                print(f"{year:<10} {metric.avg_rating:<15.3f} {metric.avg_sentiment_score or 0:<20.6f} {metric.review_count:<15}")

        # Compare the two
        print("\n" + "=" * 80)
        print("ANALYSIS")
        print("=" * 80)

        if not stored_metrics:
            print("\n❌ ISSUE FOUND: cluster_timeline_metrics table is empty or incomplete")
            print("\n   SOLUTION: Run the following command:")
            print("   python -m scripts.11_compute_cluster_metrics")
        elif len(raw_data) != len(stored_metrics):
            print(f"\n⚠️  MISMATCH: Raw data has {len(raw_data)} years, but stored metrics has {len(stored_metrics)} years")
            print("\n   SOLUTION: Re-run the metrics computation:")
            print("   python -m scripts.11_compute_cluster_metrics")
        else:
            # Check for zeros
            zeros_in_stored = sum(1 for m in stored_metrics if m.avg_rating == 0 or m.avg_sentiment_score == 0)
            if zeros_in_stored > 0:
                print(f"\n⚠️  Found {zeros_in_stored} periods with zero values in stored metrics")
                print("\n   This could indicate a calculation issue. Re-running might help:")
                print("   python -m scripts.11_compute_cluster_metrics")
            else:
                print("\n✅ Data looks correct! The issue might be in the frontend.")
                print("   Check how the frontend is fetching and displaying this data.")


if __name__ == "__main__":
    asyncio.run(debug_cluster_timeline())
