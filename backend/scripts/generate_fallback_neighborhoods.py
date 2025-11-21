"""
Generate census-tract neighborhoods ONLY for cities without Zillow data.

Usage:
    python generate_fallback_neighborhoods.py
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from glob import glob
import csv

import geopandas as gpd
import pandas as pd

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from sqlalchemy import text

# Paths
TRACT_CSV = Path(__file__).parent / "tracts_with_neighborhoods.csv"
CENSUS_TRACTS_DIR = Path(__file__).parent / "neighborhood_data" / "census_tracts"
OUTPUT_DIR = backend_dir / "public" / "neighborhoods"


def normalize_name(name: str) -> str:
    """Normalize city name for filename."""
    return name.lower().replace(' ', '_').replace('/', '_').replace("'", '')


async def get_cities_without_zillow() -> List[Tuple[str, str]]:
    """Get cities that don't have Zillow neighborhood data."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT city, state, COUNT(*) as count
                FROM businesses
                WHERE city IS NOT NULL
                  AND state IS NOT NULL
                GROUP BY city, state
                ORDER BY count DESC
            """)
        )
        all_cities = [(row[0], row[1]) for row in result.all()]

    # Filter to cities without existing Zillow data
    cities_without_zillow = []
    for city, state in all_cities:
        city_key = normalize_name(city)
        state_key = state.lower()
        filename = f"{city_key}_{state_key}.geojson"

        if not (OUTPUT_DIR / filename).exists():
            cities_without_zillow.append((city, state))

    return cities_without_zillow


def load_tract_mapping() -> Dict[str, str]:
    """Load GEOID -> neighborhood name mapping."""
    mapping = {}
    if not TRACT_CSV.exists():
        return mapping

    with open(TRACT_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            mapping[row['GEOID']] = row['name']

    return mapping


def load_census_tracts() -> gpd.GeoDataFrame:
    """Load all census tract shapefiles."""
    all_tracts = []
    state_dirs = [d for d in glob(str(CENSUS_TRACTS_DIR / "*")) if Path(d).is_dir()]

    for state_dir in state_dirs:
        shp_files = glob(str(Path(state_dir) / "*.shp"))
        for shp_file in shp_files:
            try:
                tracts = gpd.read_file(shp_file)
                if not tracts.empty:
                    if 'GEOID' in tracts.columns:
                        all_tracts.append(tracts[['GEOID', 'geometry']])
                    elif 'TRACTCE' in tracts.columns and 'STATEFP' in tracts.columns and 'COUNTYFP' in tracts.columns:
                        tracts['GEOID'] = tracts['STATEFP'] + tracts['COUNTYFP'] + tracts['TRACTCE']
                        all_tracts.append(tracts[['GEOID', 'geometry']])
            except:
                continue

    if not all_tracts:
        return None

    combined = pd.concat(all_tracts, ignore_index=True)
    combined = gpd.GeoDataFrame(combined, geometry='geometry', crs=all_tracts[0].crs)

    if combined.crs.to_epsg() != 4326:
        combined = combined.to_crs("EPSG:4326")

    return combined


async def get_city_bounds(city: str, state: str) -> Tuple[float, float, float, float]:
    """Get bounding box for a city based on its businesses."""
    async with async_session_maker() as session:
        result = await session.execute(
            text("""
                SELECT
                    MIN(longitude) as min_lon,
                    MIN(latitude) as min_lat,
                    MAX(longitude) as max_lon,
                    MAX(latitude) as max_lat
                FROM businesses
                WHERE city = :city AND state = :state
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            """),
            {"city": city, "state": state}
        )
        row = result.first()
        return (row.min_lon, row.min_lat, row.max_lon, row.max_lat)


def create_city_neighborhoods(city, state, tracts, tract_mapping, city_bounds):
    """Create neighborhood GeoJSON for a specific city."""
    min_lon, min_lat, max_lon, max_lat = city_bounds

    buffer = 0.05
    min_lon -= buffer
    min_lat -= buffer
    max_lon += buffer
    max_lat += buffer

    city_tracts = tracts.cx[min_lon:max_lon, min_lat:max_lat].copy()

    if city_tracts.empty:
        return None

    city_tracts['neighborhood'] = city_tracts['GEOID'].map(tract_mapping)
    city_tracts = city_tracts[
        city_tracts['neighborhood'].notna() &
        (city_tracts['neighborhood'] != 'Unknown')
    ]

    if city_tracts.empty:
        return None

    neighborhoods = city_tracts.dissolve(by='neighborhood', as_index=False)
    neighborhoods['geometry'] = neighborhoods['geometry'].simplify(tolerance=0.0001)

    return neighborhoods[['neighborhood', 'geometry']]


async def main():
    print("\n" + "="*80)
    print("GENERATING FALLBACK NEIGHBORHOODS (Census-based)")
    print("="*80)

    # Get cities without Zillow data
    print("\nIdentifying cities without Zillow data...")
    cities = await get_cities_without_zillow()
    print(f"Found {len(cities)} cities needing fallback neighborhoods")

    if not cities:
        print("All cities already have neighborhoods!")
        return

    # Load data
    print("\nLoading tract data...")
    tract_mapping = load_tract_mapping()
    print(f"  Loaded {len(tract_mapping):,} tract mappings")

    tracts = load_census_tracts()
    print(f"  Loaded {len(tracts):,} census tracts")

    # Generate neighborhoods
    print(f"\nGenerating neighborhoods for {len(cities)} cities...")
    print("-" * 80)

    success_count = 0
    skip_count = 0

    for i, (city, state) in enumerate(cities, 1):
        city_key = normalize_name(city)
        state_key = state.lower()
        output_file = OUTPUT_DIR / f"{city_key}_{state_key}.geojson"

        if i % 50 == 0:
            print(f"  [{i}/{len(cities)}] Processing...")

        try:
            city_bounds = await get_city_bounds(city, state)
            neighborhoods = create_city_neighborhoods(
                city, state, tracts, tract_mapping, city_bounds
            )

            if neighborhoods is None or len(neighborhoods) == 0:
                skip_count += 1
                continue

            neighborhoods.to_file(output_file, driver='GeoJSON')
            success_count += 1

        except Exception as e:
            skip_count += 1
            continue

    print()
    print("="*80)
    print("Summary:")
    print(f"  Cities needing fallback: {len(cities)}")
    print(f"  Fallback neighborhoods generated: {success_count}")
    print(f"  Skipped: {skip_count}")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
