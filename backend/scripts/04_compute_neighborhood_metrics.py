"""
Compute and populate neighborhood timeline metrics.

This script calculates pre-computed metrics for neighborhoods:
- Average ratings
- Average sentiment scores
- Review counts
- Business counts

Aggregated by month and year for fast analytics queries.

Usage:
    python scripts/compute_neighborhood_metrics.py
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
from models.photo import Photo  # For relationship resolution
from models.metrics import NeighborhoodTimelineMetrics


async def compute_neighborhood_metrics(session: AsyncSession):
    """Compute neighborhood-level metrics from reviews."""

    print("\n" + "="*60)
    print("COMPUTING NEIGHBORHOOD TIMELINE METRICS")
    print("="*60)

    # First, clear existing metrics
    print("\nClearing existing neighborhood metrics...")
    await session.execute(
        NeighborhoodTimelineMetrics.__table__.delete()
    )
    await session.commit()
    print("  Cleared existing data")

    # Compute monthly metrics
    print("\nComputing monthly metrics...")
    monthly_query = select(
        Business.state,
        Business.city,
        Business.neighborhood,
        extract('year', Review.date).label('year'),
        extract('month', Review.date).label('month'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count'),
        func.count(func.distinct(Business.business_id)).label('business_count')
    ).select_from(Business).join(
        Review, Business.business_id == Review.business_id
    ).where(
        Business.neighborhood.isnot(None)
    ).group_by(
        Business.state,
        Business.city,
        Business.neighborhood,
        'year',
        'month'
    )

    result = await session.execute(monthly_query)
    monthly_metrics = result.all()

    print(f"  Found {len(monthly_metrics):,} monthly metric records")

    # Insert monthly metrics
    batch_size = 1000
    monthly_records = []

    for row in monthly_metrics:
        state, city, neighborhood, year, month, avg_rating, avg_sentiment, avg_expected, review_count, business_count = row

        # Create period_start date
        period_start = datetime(int(year), int(month), 1).date()

        monthly_records.append({
            'state': state,
            'city': city,
            'neighborhood': neighborhood,
            'period_start': period_start,
            'period_type': 'month',
            'avg_rating': float(avg_rating),
            'avg_sentiment_score': float(avg_sentiment),
            'avg_sentiment_expected': float(avg_expected),
            'review_count': int(review_count),
            'business_count': int(business_count)
        })

        if len(monthly_records) >= batch_size:
            await session.execute(
                NeighborhoodTimelineMetrics.__table__.insert(),
                monthly_records
            )
            await session.commit()
            print(f"  Inserted {len(monthly_records)} monthly records")
            monthly_records = []

    # Insert remaining monthly records
    if monthly_records:
        await session.execute(
            NeighborhoodTimelineMetrics.__table__.insert(),
            monthly_records
        )
        await session.commit()
        print(f"  Inserted {len(monthly_records)} monthly records")

    # Compute yearly metrics
    print("\nComputing yearly metrics...")
    yearly_query = select(
        Business.state,
        Business.city,
        Business.neighborhood,
        extract('year', Review.date).label('year'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count'),
        func.count(func.distinct(Business.business_id)).label('business_count')
    ).select_from(Business).join(
        Review, Business.business_id == Review.business_id
    ).where(
        Business.neighborhood.isnot(None)
    ).group_by(
        Business.state,
        Business.city,
        Business.neighborhood,
        'year'
    )

    result = await session.execute(yearly_query)
    yearly_metrics = result.all()

    print(f"  Found {len(yearly_metrics):,} yearly metric records")

    # Insert yearly metrics
    yearly_records = []

    for row in yearly_metrics:
        state, city, neighborhood, year, avg_rating, avg_sentiment, avg_expected, review_count, business_count = row

        # Create period_start date (January 1st of the year)
        period_start = datetime(int(year), 1, 1).date()

        yearly_records.append({
            'state': state,
            'city': city,
            'neighborhood': neighborhood,
            'period_start': period_start,
            'period_type': 'year',
            'avg_rating': float(avg_rating),
            'avg_sentiment_score': float(avg_sentiment),
            'avg_sentiment_expected': float(avg_expected),
            'review_count': int(review_count),
            'business_count': int(business_count)
        })

        if len(yearly_records) >= batch_size:
            await session.execute(
                NeighborhoodTimelineMetrics.__table__.insert(),
                yearly_records
            )
            await session.commit()
            print(f"  Inserted {len(yearly_records)} yearly records")
            yearly_records = []

    # Insert remaining yearly records
    if yearly_records:
        await session.execute(
            NeighborhoodTimelineMetrics.__table__.insert(),
            yearly_records
        )
        await session.commit()
        print(f"  Inserted {len(yearly_records)} yearly records")

    print("\n" + "="*60)
    print("METRICS COMPUTATION COMPLETE")
    print("="*60)

    # Show summary statistics
    total_query = select(func.count(NeighborhoodTimelineMetrics.id))
    total_result = await session.execute(total_query)
    total_metrics = total_result.scalar()

    neighborhoods_query = select(
        func.count(func.distinct(NeighborhoodTimelineMetrics.neighborhood))
    )
    neighborhoods_result = await session.execute(neighborhoods_query)
    unique_neighborhoods = neighborhoods_result.scalar()

    print(f"\nTotal metric records: {total_metrics:,}")
    print(f"Unique neighborhoods: {unique_neighborhoods:,}")
    print(f"Monthly records: {len(monthly_metrics):,}")
    print(f"Yearly records: {len(yearly_metrics):,}")
    print("="*60 + "\n")


async def main():
    """Main execution."""
    print("\nStarting neighborhood metrics computation...")
    print("This may take a few minutes for large datasets.\n")

    async with async_session_maker() as session:
        await compute_neighborhood_metrics(session)

    print("\nDone! Neighborhood metrics are ready for analytics queries.")


if __name__ == "__main__":
    asyncio.run(main())
