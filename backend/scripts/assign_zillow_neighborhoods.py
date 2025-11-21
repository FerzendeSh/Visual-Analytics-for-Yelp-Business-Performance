"""
Re-assign businesses to Zillow neighborhood names using spatial joins.

Usage:
    python assign_zillow_neighborhoods.py [--dry-run] [--batch-size 100]
"""

import asyncio
import argparse
import sys
import json
from pathlib import Path
from typing import Dict, Optional

import geopandas as gpd
from shapely.geometry import Point

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from sqlalchemy import text

# Paths
ZILLOW_DIR = Path(__file__).parent / "neighborhood-GeoJSON"


async def get_businesses_by_state():
    """Get all businesses grouped by state."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT DISTINCT state
                FROM businesses
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                ORDER BY state
            """)
        )
        return [row[0] for row in result.all()]


async def get_state_businesses(state: str):
    """Get businesses for a specific state."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT business_id, city, latitude, longitude, neighborhood
                FROM businesses
                WHERE state = :state
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            """),
            {"state": state}
        )
        return result.all()


def load_zillow_for_state(state: str) -> Optional[gpd.GeoDataFrame]:
    """Load Zillow neighborhoods for a state."""
    zillow_file = ZILLOW_DIR / f"ZillowNeighborhoods-{state}.geojson"

    if not zillow_file.exists():
        return None

    try:
        gdf = gpd.read_file(zillow_file)
        # Ensure WGS84
        if gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")
        return gdf
    except Exception as e:
        print(f"    ERROR loading {zillow_file}: {e}")
        return None


async def update_neighborhoods(dry_run: bool = False, batch_size: int = 100):
    """Main update function."""

    print("\n" + "="*80)
    print("RE-ASSIGNING BUSINESSES TO ZILLOW NEIGHBORHOODS")
    print("="*80)

    if dry_run:
        print("\n[DRY RUN MODE] No changes will be committed\n")

    # Get states
    states = await get_businesses_by_state()
    print(f"\nFound {len(states)} states with businesses")

    total_businesses = 0
    total_updated = 0
    total_not_found = 0
    states_with_data = 0

    for state in states:
        print(f"\n{'='*60}")
        print(f"Processing {state}")
        print(f"{'='*60}")

        # Load Zillow data
        zillow = load_zillow_for_state(state)

        if zillow is None:
            print(f"  No Zillow data available for {state}, skipping")
            continue

        print(f"  Loaded {len(zillow)} Zillow neighborhoods")
        states_with_data += 1

        # Get businesses
        businesses = await get_state_businesses(state)
        print(f"  Found {len(businesses)} businesses")

        updated_count = 0
        not_found_count = 0
        batch = []

        for i, biz in enumerate(businesses, 1):
            business_id = biz.business_id
            city = biz.city
            lat = biz.latitude
            lon = biz.longitude
            current_neighborhood = biz.neighborhood

            # Create point
            point = Point(lon, lat)
            point_gdf = gpd.GeoDataFrame([{'geometry': point}], crs="EPSG:4326")

            # Find containing Zillow neighborhood
            matches = zillow[zillow.contains(point)]

            if matches.empty:
                not_found_count += 1
                continue

            # Get neighborhood name
            new_neighborhood = matches.iloc[0]['NAME']

            # Skip if already correct
            if current_neighborhood == new_neighborhood:
                continue

            # Update
            if dry_run:
                if updated_count < 20:  # Show first 20
                    print(f"  [{i}] {business_id} ({city}): '{current_neighborhood}' -> '{new_neighborhood}'")
            else:
                batch.append({
                    'business_id': business_id,
                    'neighborhood': new_neighborhood
                })

                if len(batch) >= batch_size:
                    await execute_batch_update(batch)
                    updated_count += len(batch)
                    print(f"  Updated {updated_count}/{len(businesses)} businesses...")
                    batch = []

            updated_count += 1

            if i % 500 == 0:
                print(f"  Progress: {i}/{len(businesses)}")

        # Final batch
        if batch and not dry_run:
            await execute_batch_update(batch)

        total_businesses += len(businesses)
        total_updated += updated_count
        total_not_found += not_found_count

        print(f"\n  {state} Summary:")
        print(f"    Businesses processed: {len(businesses)}")
        print(f"    Updated: {updated_count}")
        print(f"    Not found in Zillow: {not_found_count}")

    print()
    print("="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"States with Zillow data: {states_with_data}/{len(states)}")
    print(f"Total businesses: {total_businesses}")
    print(f"Updated: {total_updated}")
    print(f"Not found: {total_not_found}")
    if dry_run:
        print(f"\n[DRY RUN] No changes committed")
    print("="*80)


async def execute_batch_update(batch):
    """Execute batch updates."""
    async with async_session_maker() as session:
        for item in batch:
            await session.execute(
                text("""
                    UPDATE businesses
                    SET neighborhood = :neighborhood
                    WHERE business_id = :business_id
                """),
                item
            )
        await session.commit()


def main():
    parser = argparse.ArgumentParser(description='Re-assign to Zillow neighborhoods')
    parser.add_argument('--dry-run', action='store_true', help='Preview without committing')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size')

    args = parser.parse_args()

    try:
        asyncio.run(update_neighborhoods(
            dry_run=args.dry_run,
            batch_size=args.batch_size
        ))
    except KeyboardInterrupt:
        print("\n\nCancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
