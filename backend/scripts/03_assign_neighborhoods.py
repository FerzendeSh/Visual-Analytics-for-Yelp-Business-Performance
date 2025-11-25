"""
Re-assign businesses to neighborhoods using city-specific GeoJSON files.

This script reads neighborhood boundaries from backend/public/neighborhoods/
and performs spatial joins to assign each business to its correct neighborhood.

Usage:
    python 03_assign_neighborhoods.py [--dry-run] [--batch-size 100]
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
NEIGHBORHOODS_DIR = Path(__file__).parent.parent / "public" / "neighborhoods"


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


async def get_businesses_by_city(state: str, city: str):
    """Get businesses for a specific city."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT business_id, city, latitude, longitude, neighborhood
                FROM businesses
                WHERE state = :state
                  AND city = :city
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            """),
            {"state": state, "city": city}
        )
        return result.all()


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


async def get_cities_in_state(state: str):
    """Get all cities in a state."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT DISTINCT city
                FROM businesses
                WHERE state = :state
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
                ORDER BY city
            """),
            {"state": state}
        )
        return [row[0] for row in result.all()]


def normalize_city_name(city: str) -> str:
    """Normalize city name for filename matching."""
    return city.lower().replace(' ', '_').replace('.', '').replace('/', '_').replace('-', '_').replace("'", '')


def load_neighborhoods_for_city(city: str, state: str) -> Optional[gpd.GeoDataFrame]:
    """Load neighborhood boundaries for a specific city."""
    city_normalized = normalize_city_name(city)
    state_normalized = state.lower()

    # Try exact match first
    neighborhood_file = NEIGHBORHOODS_DIR / f"{city_normalized}_{state_normalized}.geojson"

    # Also try with double underscore (some files have this)
    if not neighborhood_file.exists():
        neighborhood_file = NEIGHBORHOODS_DIR / f"{city_normalized}__{state_normalized}.geojson"

    if not neighborhood_file.exists():
        return None

    try:
        gdf = gpd.read_file(neighborhood_file)
        # Ensure WGS84
        if gdf.crs is None:
            gdf.set_crs("EPSG:4326", inplace=True)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")
        return gdf
    except Exception as e:
        print(f"    ERROR loading {neighborhood_file}: {e}")
        return None


async def update_neighborhoods(dry_run: bool = False, batch_size: int = 100):
    """Main update function."""

    print("\n" + "="*80)
    print("RE-ASSIGNING BUSINESSES TO NEIGHBORHOODS")
    print("="*80)

    if dry_run:
        print("\n[DRY RUN MODE] No changes will be committed\n")

    # Get states
    states = await get_businesses_by_state()
    print(f"\nFound {len(states)} states with businesses")

    total_businesses = 0
    total_updated = 0
    total_not_found = 0
    cities_with_data = 0
    cities_processed = 0

    for state in states:
        print(f"\n{'='*60}")
        print(f"Processing {state}")
        print(f"{'='*60}")

        # Get cities in this state
        cities = await get_cities_in_state(state)
        print(f"  Found {len(cities)} cities in {state}")

        for city in cities:
            cities_processed += 1

            # Load neighborhood data for this city
            neighborhoods = load_neighborhoods_for_city(city, state)

            if neighborhoods is None:
                print(f"  [{city}] No neighborhood data available, skipping")
                continue

            print(f"  [{city}] Loaded {len(neighborhoods)} neighborhoods")
            cities_with_data += 1

            # Get businesses for this city
            businesses = await get_businesses_by_city(state, city)
            if len(businesses) == 0:
                continue

            print(f"  [{city}] Found {len(businesses)} businesses")

            updated_count = 0
            not_found_count = 0
            batch = []

            for i, biz in enumerate(businesses, 1):
                business_id = biz.business_id
                lat = biz.latitude
                lon = biz.longitude
                current_neighborhood = biz.neighborhood

                # Create point
                point = Point(lon, lat)

                # Find containing neighborhood
                matches = neighborhoods[neighborhoods.contains(point)]

                if matches.empty:
                    not_found_count += 1
                    continue

                # Get neighborhood name (handle both 'neighborhood' and 'NAME' properties)
                if 'neighborhood' in matches.iloc[0]:
                    new_neighborhood = matches.iloc[0]['neighborhood']
                elif 'NAME' in matches.iloc[0]:
                    new_neighborhood = matches.iloc[0]['NAME']
                else:
                    # Skip if no recognizable neighborhood property
                    not_found_count += 1
                    continue

                # Skip if already correct
                if current_neighborhood == new_neighborhood:
                    continue

                # Update
                if dry_run:
                    if updated_count < 10:  # Show first 10 per city
                        print(f"    [{i}] {business_id}: '{current_neighborhood}' -> '{new_neighborhood}'")
                else:
                    batch.append({
                        'business_id': business_id,
                        'neighborhood': new_neighborhood
                    })

                    if len(batch) >= batch_size:
                        await execute_batch_update(batch)
                        batch = []

                updated_count += 1

            # Final batch
            if batch and not dry_run:
                await execute_batch_update(batch)

            total_businesses += len(businesses)
            total_updated += updated_count
            total_not_found += not_found_count

            if updated_count > 0 or not_found_count > 0:
                print(f"  [{city}] Updated: {updated_count}, Not found: {not_found_count}")

    print()
    print("="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Cities processed: {cities_processed}")
    print(f"Cities with neighborhood data: {cities_with_data}")
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
    parser = argparse.ArgumentParser(description='Re-assign businesses to neighborhoods')
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
