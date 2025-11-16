"""
Create pre-computed metrics tables in the database.
Run this once to set up the new tables.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from database.database import engine
from models.base import Base
from models.metrics import (
    BusinessTimelineMetrics,
    CityTimelineMetrics,
    StateTimelineMetrics,
    CityCategoryTimelineMetrics,
    StateCategoryTimelineMetrics
)


async def create_metrics_tables():
    """Create all metrics tables"""
    print("=" * 60)
    print("CREATING PRE-COMPUTED METRICS TABLES")
    print("=" * 60)

    async with engine.begin() as conn:
        # Create only the metrics tables
        print("\nCreating tables...")
        await conn.run_sync(Base.metadata.create_all, tables=[
            BusinessTimelineMetrics.__table__,
            CityTimelineMetrics.__table__,
            StateTimelineMetrics.__table__,
            CityCategoryTimelineMetrics.__table__,
            StateCategoryTimelineMetrics.__table__,
        ])

    print("\n✅ Successfully created 5 metrics tables:")
    print("  1. business_timeline_metrics")
    print("  2. city_timeline_metrics")
    print("  3. state_timeline_metrics")
    print("  4. city_category_timeline_metrics")
    print("  5. state_category_timeline_metrics")
    print("\n" + "=" * 60)
    print("Next step: Run populate_metrics.py to populate the tables")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(create_metrics_tables())
