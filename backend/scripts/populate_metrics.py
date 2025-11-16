"""
Populate pre-computed metrics tables with aggregated data.
This script calculates all timeline metrics and stores them for fast querying.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from datetime import datetime
from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import async_session_maker
from models.business import Business
from models.review import Review
from models.metrics import (
    BusinessTimelineMetrics,
    CityTimelineMetrics,
    StateTimelineMetrics,
    CityCategoryTimelineMetrics,
    StateCategoryTimelineMetrics
)


async def clear_metrics_tables(session: AsyncSession):
    """Clear all existing metrics"""
    print("\nClearing existing metrics...")
    await session.execute(delete(BusinessTimelineMetrics))
    await session.execute(delete(CityTimelineMetrics))
    await session.execute(delete(StateTimelineMetrics))
    await session.execute(delete(CityCategoryTimelineMetrics))
    await session.execute(delete(StateCategoryTimelineMetrics))
    await session.commit()
    print("✅ Cleared old metrics")


async def populate_business_metrics(session: AsyncSession, period_type: str):
    """Populate business timeline metrics"""
    print(f"\nPopulating business {period_type}ly metrics...")

    # Determine date truncation
    date_trunc_expr = func.date_trunc(
        'month' if period_type == 'month' else 'year',
        Review.date
    )

    # Query to aggregate by business and period
    query = select(
        Review.business_id,
        date_trunc_expr.label('period_start'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count')
    ).group_by(
        Review.business_id,
        date_trunc_expr
    )

    result = await session.execute(query)
    rows = result.fetchall()

    # Insert metrics
    metrics = []
    for row in rows:
        metrics.append(BusinessTimelineMetrics(
            business_id=row.business_id,
            period_start=row.period_start.date() if row.period_start else None,
            period_type=period_type,
            avg_rating=float(row.avg_rating or 0),
            avg_sentiment_score=float(row.avg_sentiment_score or 0),
            avg_sentiment_expected=float(row.avg_sentiment_expected or 0),
            review_count=int(row.review_count or 0)
        ))

    if metrics:
        session.add_all(metrics)
        await session.commit()

    print(f"✅ Inserted {len(metrics):,} business {period_type}ly metrics")


async def populate_city_metrics(session: AsyncSession, period_type: str):
    """Populate city timeline metrics"""
    print(f"\nPopulating city {period_type}ly metrics...")

    date_trunc_expr = func.date_trunc(
        'month' if period_type == 'month' else 'year',
        Review.date
    )

    # Query to aggregate by city and period
    query = select(
        Business.state,
        Business.city,
        date_trunc_expr.label('period_start'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count'),
        func.count(func.distinct(Review.business_id)).label('business_count')
    ).join(
        Business, Review.business_id == Business.business_id
    ).group_by(
        Business.state,
        Business.city,
        date_trunc_expr
    )

    result = await session.execute(query)
    rows = result.fetchall()

    metrics = []
    for row in rows:
        metrics.append(CityTimelineMetrics(
            state=row.state,
            city=row.city,
            period_start=row.period_start.date() if row.period_start else None,
            period_type=period_type,
            avg_rating=float(row.avg_rating or 0),
            avg_sentiment_score=float(row.avg_sentiment_score or 0),
            avg_sentiment_expected=float(row.avg_sentiment_expected or 0),
            review_count=int(row.review_count or 0),
            business_count=int(row.business_count or 0)
        ))

    if metrics:
        session.add_all(metrics)
        await session.commit()

    print(f"✅ Inserted {len(metrics):,} city {period_type}ly metrics")


async def populate_state_metrics(session: AsyncSession, period_type: str):
    """Populate state timeline metrics"""
    print(f"\nPopulating state {period_type}ly metrics...")

    date_trunc_expr = func.date_trunc(
        'month' if period_type == 'month' else 'year',
        Review.date
    )

    query = select(
        Business.state,
        date_trunc_expr.label('period_start'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count'),
        func.count(func.distinct(Review.business_id)).label('business_count')
    ).join(
        Business, Review.business_id == Business.business_id
    ).group_by(
        Business.state,
        date_trunc_expr
    )

    result = await session.execute(query)
    rows = result.fetchall()

    metrics = []
    for row in rows:
        metrics.append(StateTimelineMetrics(
            state=row.state,
            period_start=row.period_start.date() if row.period_start else None,
            period_type=period_type,
            avg_rating=float(row.avg_rating or 0),
            avg_sentiment_score=float(row.avg_sentiment_score or 0),
            avg_sentiment_expected=float(row.avg_sentiment_expected or 0),
            review_count=int(row.review_count or 0),
            business_count=int(row.business_count or 0)
        ))

    if metrics:
        session.add_all(metrics)
        await session.commit()

    print(f"✅ Inserted {len(metrics):,} state {period_type}ly metrics")


async def populate_city_category_metrics(session: AsyncSession, period_type: str):
    """Populate city+category timeline metrics"""
    print(f"\nPopulating city+category {period_type}ly metrics...")
    print("  (This may take a while for categories...)")

    date_trunc_expr = func.date_trunc(
        'month' if period_type == 'month' else 'year',
        Review.date
    )

    # Get all businesses with categories
    businesses = await session.execute(
        select(Business.business_id, Business.state, Business.city, Business.categories)
        .where(Business.categories.isnot(None))
    )
    businesses = businesses.fetchall()

    # Create a mapping of business_id to (state, city, categories_list)
    business_map = {}
    for b in businesses:
        if b.categories:
            cats = [c.strip() for c in b.categories.split(',')]
            business_map[b.business_id] = (b.state, b.city, cats)

    # Get reviews aggregated by business and period
    query = select(
        Review.business_id,
        date_trunc_expr.label('period_start'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count')
    ).group_by(
        Review.business_id,
        date_trunc_expr
    )

    result = await session.execute(query)
    review_data = result.fetchall()

    # Aggregate by city+category+period
    city_category_aggregates = {}

    for row in review_data:
        if row.business_id in business_map:
            state, city, categories = business_map[row.business_id]
            period_start = row.period_start.date() if row.period_start else None

            for category in categories:
                key = (state, city, category, period_start)

                if key not in city_category_aggregates:
                    city_category_aggregates[key] = {
                        'total_rating': 0,
                        'total_sentiment_score': 0,
                        'total_sentiment_expected': 0,
                        'total_reviews': 0,
                        'businesses': set()
                    }

                agg = city_category_aggregates[key]
                agg['total_rating'] += row.avg_rating * row.review_count
                agg['total_sentiment_score'] += row.avg_sentiment_score * row.review_count
                agg['total_sentiment_expected'] += row.avg_sentiment_expected * row.review_count
                agg['total_reviews'] += row.review_count
                agg['businesses'].add(row.business_id)

    # Create metrics
    metrics = []
    for (state, city, category, period_start), agg in city_category_aggregates.items():
        if agg['total_reviews'] > 0:
            metrics.append(CityCategoryTimelineMetrics(
                state=state,
                city=city,
                category=category,
                period_start=period_start,
                period_type=period_type,
                avg_rating=float(agg['total_rating'] / agg['total_reviews']),
                avg_sentiment_score=float(agg['total_sentiment_score'] / agg['total_reviews']),
                avg_sentiment_expected=float(agg['total_sentiment_expected'] / agg['total_reviews']),
                review_count=int(agg['total_reviews']),
                business_count=len(agg['businesses'])
            ))

    if metrics:
        # Insert in batches
        batch_size = 1000
        for i in range(0, len(metrics), batch_size):
            batch = metrics[i:i+batch_size]
            session.add_all(batch)
            await session.commit()
            print(f"  Inserted batch {i//batch_size + 1} ({len(batch)} records)")

    print(f"✅ Inserted {len(metrics):,} city+category {period_type}ly metrics")


async def populate_state_category_metrics(session: AsyncSession, period_type: str):
    """Populate state+category timeline metrics"""
    print(f"\nPopulating state+category {period_type}ly metrics...")

    date_trunc_expr = func.date_trunc(
        'month' if period_type == 'month' else 'year',
        Review.date
    )

    # Similar to city+category but for states
    businesses = await session.execute(
        select(Business.business_id, Business.state, Business.categories)
        .where(Business.categories.isnot(None))
    )
    businesses = businesses.fetchall()

    business_map = {}
    for b in businesses:
        if b.categories:
            cats = [c.strip() for c in b.categories.split(',')]
            business_map[b.business_id] = (b.state, cats)

    query = select(
        Review.business_id,
        date_trunc_expr.label('period_start'),
        func.avg(Review.stars).label('avg_rating'),
        func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
        func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
        func.count(Review.review_id).label('review_count')
    ).group_by(
        Review.business_id,
        date_trunc_expr
    )

    result = await session.execute(query)
    review_data = result.fetchall()

    state_category_aggregates = {}

    for row in review_data:
        if row.business_id in business_map:
            state, categories = business_map[row.business_id]
            period_start = row.period_start.date() if row.period_start else None

            for category in categories:
                key = (state, category, period_start)

                if key not in state_category_aggregates:
                    state_category_aggregates[key] = {
                        'total_rating': 0,
                        'total_sentiment_score': 0,
                        'total_sentiment_expected': 0,
                        'total_reviews': 0,
                        'businesses': set()
                    }

                agg = state_category_aggregates[key]
                agg['total_rating'] += row.avg_rating * row.review_count
                agg['total_sentiment_score'] += row.avg_sentiment_score * row.review_count
                agg['total_sentiment_expected'] += row.avg_sentiment_expected * row.review_count
                agg['total_reviews'] += row.review_count
                agg['businesses'].add(row.business_id)

    metrics = []
    for (state, category, period_start), agg in state_category_aggregates.items():
        if agg['total_reviews'] > 0:
            metrics.append(StateCategoryTimelineMetrics(
                state=state,
                category=category,
                period_start=period_start,
                period_type=period_type,
                avg_rating=float(agg['total_rating'] / agg['total_reviews']),
                avg_sentiment_score=float(agg['total_sentiment_score'] / agg['total_reviews']),
                avg_sentiment_expected=float(agg['total_sentiment_expected'] / agg['total_reviews']),
                review_count=int(agg['total_reviews']),
                business_count=len(agg['businesses'])
            ))

    if metrics:
        batch_size = 1000
        for i in range(0, len(metrics), batch_size):
            batch = metrics[i:i+batch_size]
            session.add_all(batch)
            await session.commit()

    print(f"✅ Inserted {len(metrics):,} state+category {period_type}ly metrics")


async def main():
    """Main aggregation process"""
    start_time = datetime.now()

    print("=" * 60)
    print("POPULATING PRE-COMPUTED METRICS")
    print("=" * 60)
    print(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    async with async_session_maker() as session:
        # Clear existing metrics
        await clear_metrics_tables(session)

        # Populate all metrics for both month and year periods
        for period_type in ['month', 'year']:
            print(f"\n{'='*60}")
            print(f"PROCESSING {period_type.upper()}LY METRICS")
            print(f"{'='*60}")

            await populate_business_metrics(session, period_type)
            await populate_city_metrics(session, period_type)
            await populate_state_metrics(session, period_type)
            await populate_city_category_metrics(session, period_type)
            await populate_state_category_metrics(session, period_type)

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print("✅ AGGREGATION COMPLETE!")
    print("=" * 60)
    print(f"Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
    print(f"End time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("\nNext: Restart the backend server to use the new metrics!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
