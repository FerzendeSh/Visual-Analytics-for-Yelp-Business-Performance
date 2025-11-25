"""
Assign neighborhoods to businesses using processed GeoJSON files from public/neighborhoods/.

This script performs spatial joins to assign neighborhood names to businesses
based on their coordinates and the neighborhood boundary files.

Usage:
    python -m scripts.assign_neighborhoods [--dry-run] [--batch-size 100]
"""

import asyncio
import argparse
import sys
from pathlib import Path
from typing import List, Tuple

import geopandas as gpd
from shapely.geometry import Point

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from sqlalchemy import text

# Paths
NEIGHBORHOODS_DIR = backend_dir / "public" / "neighborhoods"


def normalize_name(name: str) -> str:
    """Normalize city name for filename matching."""
    return name.lower().replace(' ', '_').replace('/', '_').replace("'", '')


async def get_cities_with_businesses() -> List[Tuple[str, str, int]]:
    """Get all cities that have businesses with coordinates."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT city, state, COUNT(*) as count
                FROM businesses
                WHERE latitude IS NOT NULL 
                  AND longitude IS NOT NULL
                GROUP BY city, state
                ORDER BY count DESC
            """)
        )
        return [(row[0], row[1], row[2]) for row in result.all()]


async def get_city_businesses(city: str, state: str):
    """Get businesses for a specific city."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT business_id, latitude, longitude, neighborhood
                FROM businesses
                WHERE city = :city
                  AND state = :state
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            """),
            {"city": city, "state": state}
        )
        return result.all()


def load_neighborhood_geojson(city: str, state: str) -> gpd.GeoDataFrame:
    """Load neighborhood GeoJSON for a city."""
    city_key = normalize_name(city)
    state_key = state.lower()
    filename = f"{city_key}_{state_key}.geojson"
    filepath = NEIGHBORHOODS_DIR / filename
    
    if not filepath.exists():
        return None
    
    try:
        gdf = gpd.read_file(filepath)
        # Ensure WGS84
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")
        return gdf
    except Exception as e:
        print(f"    ERROR loading {filepath}: {e}")
        return None


async def execute_batch_update(batch: List[dict]):
    """Execute batch updates to database."""
    if not batch:
        return
    
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


async def assign_neighborhoods(dry_run: bool = False, batch_size: int = 100):
    """Main assignment function."""
    
    print("\n" + "="*80)
    print("ASSIGNING NEIGHBORHOODS TO BUSINESSES")
    print("="*80)
    
    if dry_run:
        print("\n[DRY RUN MODE] No changes will be committed\n")
    
    # Get all cities
    cities = await get_cities_with_businesses()
    print(f"\nFound {len(cities)} cities with businesses")
    
    total_businesses = 0
    total_updated = 0
    total_not_found = 0
    total_skipped = 0
    cities_processed = 0
    cities_skipped = 0
    
    for city, state, count in cities:
        print(f"\n{'='*60}")
        print(f"Processing {city}, {state} ({count} businesses)")
        print(f"{'='*60}")
        
        # Load neighborhood data
        neighborhoods = load_neighborhood_geojson(city, state)
        
        if neighborhoods is None:
            print(f"  No neighborhood data available, skipping")
            cities_skipped += 1
            total_skipped += count
            continue
        
        print(f"  Loaded {len(neighborhoods)} neighborhoods")
        cities_processed += 1
        
        # Get businesses
        businesses = await get_city_businesses(city, state)
        print(f"  Processing {len(businesses)} businesses...")
        
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
            containing = neighborhoods[neighborhoods.contains(point)]
            
            if containing.empty:
                not_found_count += 1
                continue
            
            # Get neighborhood name (check common field names)
            if 'NAME' in containing.columns:
                new_neighborhood = containing.iloc[0]['NAME']
            elif 'name' in containing.columns:
                new_neighborhood = containing.iloc[0]['name']
            elif 'neighborhood' in containing.columns:
                new_neighborhood = containing.iloc[0]['neighborhood']
            else:
                # Use first string column as fallback
                str_cols = containing.select_dtypes(include=['object']).columns
                if len(str_cols) > 0:
                    new_neighborhood = containing.iloc[0][str_cols[0]]
                else:
                    not_found_count += 1
                    continue
            
            # Update
            if dry_run:
                if updated_count < 10:  # Show first 10
                    print(f"  [{i}] {business_id}: '{current_neighborhood}' -> '{new_neighborhood}'")
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
            print(f"  Updated {updated_count}/{len(businesses)} businesses...")
        
        total_businesses += len(businesses)
        total_updated += updated_count
        total_not_found += not_found_count
        
        print(f"\n  {city}, {state} Summary:")
        print(f"    Businesses processed: {len(businesses)}")
        print(f"    Updated: {updated_count}")
        print(f"    Not found in boundaries: {not_found_count}")
    
    print()
    print("="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Cities with neighborhood data: {cities_processed}/{len(cities)}")
    print(f"Cities skipped (no data): {cities_skipped}")
    print(f"Total businesses processed: {total_businesses}")
    print(f"Total businesses skipped: {total_skipped}")
    print(f"Neighborhoods assigned: {total_updated}")
    print(f"Not found in boundaries: {total_not_found}")
    if dry_run:
        print(f"\n[DRY RUN] No changes committed")
    print("="*80)


def main():
    parser = argparse.ArgumentParser(description='Assign neighborhoods to businesses')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Preview changes without committing to database')
    parser.add_argument('--batch-size', type=int, default=100, 
                       help='Number of updates per database commit')
    
    args = parser.parse_args()
    
    try:
        asyncio.run(assign_neighborhoods(
            dry_run=args.dry_run,
            batch_size=args.batch_size
        ))
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
