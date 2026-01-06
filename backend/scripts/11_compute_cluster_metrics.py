"""
Compute and populate cluster timeline metrics.

This script calculates pre-computed metrics for clusters:
- Average ratings
- Average sentiment scores
- Review counts
- Business counts

Aggregated by month and year for fast analytics queries.

Usage:
    python -m scripts.11_compute_cluster_metrics
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, func, extract, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import async_session_maker
from models.business import Business
from models.review import Review
from models.cluster import Cluster, BusinessCluster, ClusterRun
from models.metrics import ClusterTimelineMetrics


async def compute_cluster_metrics(session: AsyncSession):
    """Compute cluster-level metrics from reviews."""

    print("\n" + "=" * 80)
    print("COMPUTING CLUSTER TIMELINE METRICS")
    print("=" * 80)

    # Get latest cluster run
    print("\nFinding latest cluster run...")
    result = await session.execute(
        select(ClusterRun).order_by(ClusterRun.created_at.desc()).limit(1)
    )
    latest_run = result.scalar_one_or_none()

    if not latest_run:
        print("  ERROR: No cluster runs found in database!")
        return

    print(f"  [OK] Using run_id={latest_run.run_id} (created {latest_run.created_at})")

    # Get all clusters in this run
    result = await session.execute(
        select(Cluster).where(Cluster.run_id == latest_run.run_id)
    )
    clusters = result.scalars().all()
    print(f"  [OK] Found {len(clusters)} clusters to process")

    # Clear existing metrics for this run
    print("\nClearing existing cluster metrics...")
    await session.execute(
        ClusterTimelineMetrics.__table__.delete().where(
            ClusterTimelineMetrics.cluster_id.in_([c.cluster_id for c in clusters])
        )
    )
    await session.commit()
    print("  [OK] Cleared existing data")

    # Process each cluster
    print("\n" + "=" * 80)
    print("PROCESSING CLUSTERS")
    print("=" * 80)

    total_records_inserted = 0

    for idx, cluster in enumerate(clusters):
        print(f"\n[{idx + 1}/{len(clusters)}] Processing Cluster {cluster.cluster_label}: {cluster.ai_label}")
        print(f"  City: {cluster.city}, Size: {cluster.size} businesses")

        # Get business IDs in this cluster
        business_ids_result = await session.execute(
            select(BusinessCluster.business_id).where(
                BusinessCluster.cluster_id == cluster.cluster_id
            )
        )
        business_ids = [row[0] for row in business_ids_result.all()]

        if not business_ids:
            print("  [SKIP] No businesses found for this cluster")
            continue

        print(f"  Found {len(business_ids)} businesses in cluster")

        # Compute monthly metrics
        monthly_query = select(
            extract('year', Review.date).label('year'),
            extract('month', Review.date).label('month'),
            func.avg(Review.stars).label('avg_rating'),
            func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
            func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
            func.count(Review.review_id).label('review_count'),
            func.count(func.distinct(Review.business_id)).label('business_count')
        ).where(
            Review.business_id.in_(business_ids)
        ).group_by(
            'year',
            'month'
        )

        result = await session.execute(monthly_query)
        monthly_metrics = result.all()

        # Insert monthly metrics
        monthly_records = []
        for row in monthly_metrics:
            year, month, avg_rating, avg_sentiment, avg_expected, review_count, business_count = row

            # Create period_start date
            period_start = datetime(int(year), int(month), 1).date()

            monthly_records.append({
                'cluster_id': cluster.cluster_id,
                'period_start': period_start,
                'period_type': 'month',
                'avg_rating': float(avg_rating) if avg_rating else None,
                'avg_sentiment_score': float(avg_sentiment) if avg_sentiment else None,
                'avg_sentiment_expected': float(avg_expected) if avg_expected else None,
                'review_count': int(review_count),
                'business_count': int(business_count)
            })

        if monthly_records:
            # Insert in batches
            batch_size = 1000
            for i in range(0, len(monthly_records), batch_size):
                batch = monthly_records[i:i + batch_size]
                await session.execute(
                    ClusterTimelineMetrics.__table__.insert(),
                    batch
                )
            await session.commit()
            print(f"  [OK] Inserted {len(monthly_records)} monthly records")
            total_records_inserted += len(monthly_records)
        else:
            print("  [SKIP] No monthly metrics found")

        # Compute yearly metrics
        yearly_query = select(
            extract('year', Review.date).label('year'),
            func.avg(Review.stars).label('avg_rating'),
            func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
            func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
            func.count(Review.review_id).label('review_count'),
            func.count(func.distinct(Review.business_id)).label('business_count')
        ).where(
            Review.business_id.in_(business_ids)
        ).group_by(
            'year'
        )

        result = await session.execute(yearly_query)
        yearly_metrics = result.all()

        # Insert yearly metrics
        yearly_records = []
        for row in yearly_metrics:
            year, avg_rating, avg_sentiment, avg_expected, review_count, business_count = row

            # Create period_start date (January 1st of year)
            period_start = datetime(int(year), 1, 1).date()

            yearly_records.append({
                'cluster_id': cluster.cluster_id,
                'period_start': period_start,
                'period_type': 'year',
                'avg_rating': float(avg_rating) if avg_rating else None,
                'avg_sentiment_score': float(avg_sentiment) if avg_sentiment else None,
                'avg_sentiment_expected': float(avg_expected) if avg_expected else None,
                'review_count': int(review_count),
                'business_count': int(business_count)
            })

        if yearly_records:
            # Insert in batches
            for i in range(0, len(yearly_records), batch_size):
                batch = yearly_records[i:i + batch_size]
                await session.execute(
                    ClusterTimelineMetrics.__table__.insert(),
                    batch
                )
            await session.commit()
            print(f"  [OK] Inserted {len(yearly_records)} yearly records")
            total_records_inserted += len(yearly_records)
        else:
            print("  [SKIP] No yearly metrics found")

    print("\n" + "=" * 80)
    print("COMPUTATION COMPLETE!")
    print("=" * 80)
    print(f"\nSummary:")
    print(f"  - Clusters processed: {len(clusters)}")
    print(f"  - Total metrics records inserted: {total_records_inserted}")
    print(f"  - Average records per cluster: {total_records_inserted / len(clusters):.1f}")


async def main():
    """Main entry point."""
    async with async_session_maker() as session:
        try:
            await compute_cluster_metrics(session)
        except Exception as e:
            await session.rollback()
            print(f"\nERROR: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(main())
