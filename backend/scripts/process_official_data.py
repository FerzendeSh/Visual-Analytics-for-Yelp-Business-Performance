"""
Process official Zillow neighborhoods and Census city boundaries.
Converts them to city-specific GeoJSON files matching our naming convention.

Usage:
    python process_official_data.py
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List

import geopandas as gpd


# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
ZILLOW_DIR = SCRIPT_DIR / "neighborhood-GeoJSON"
CITIES_DIR = SCRIPT_DIR / "cities"
OUTPUT_NEIGHBORHOODS = SCRIPT_DIR.parent / "public" / "neighborhoods"
OUTPUT_CITIES = SCRIPT_DIR.parent / "public" / "cities"


def normalize_name(name: str) -> str:
    """Normalize city/neighborhood name for filename."""
    return name.lower().replace(' ', '_').replace('/', '_').replace("'", '')


def process_zillow_neighborhoods():
    """Process Zillow neighborhood data into city-specific files."""
    print("\n" + "="*80)
    print("PROCESSING ZILLOW NEIGHBORHOODS")
    print("="*80)

    if not ZILLOW_DIR.exists():
        print(f"ERROR: Zillow directory not found: {ZILLOW_DIR}")
        return 0

    OUTPUT_NEIGHBORHOODS.mkdir(parents=True, exist_ok=True)

    zillow_files = list(ZILLOW_DIR.glob("ZillowNeighborhoods-*.geojson"))
    print(f"\nFound {len(zillow_files)} Zillow state files")

    total_files_created = 0
    total_neighborhoods = 0

    for zillow_file in sorted(zillow_files):
        state_code = zillow_file.stem.split('-')[-1]
        print(f"\nProcessing {state_code}...")

        try:
            # Load GeoJSON
            with open(zillow_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Group neighborhoods by city
            city_neighborhoods = defaultdict(list)

            for feature in data['features']:
                props = feature['properties']
                city = props.get('CITY', '').strip()
                state = props.get('STATE', state_code).strip()

                if not city:
                    continue

                city_neighborhoods[(city, state)].append(feature)

            # Create city-specific files
            for (city, state), features in city_neighborhoods.items():
                city_key = normalize_name(city)
                state_key = state.lower()
                filename = f"{city_key}_{state_key}.geojson"
                output_file = OUTPUT_NEIGHBORHOODS / filename

                # Create GeoJSON FeatureCollection
                geojson = {
                    "type": "FeatureCollection",
                    "features": features
                }

                # Save file
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(geojson, f)

                total_files_created += 1
                total_neighborhoods += len(features)

            print(f"  Created {len(city_neighborhoods)} city files with neighborhoods")

        except Exception as e:
            print(f"  ERROR processing {zillow_file.name}: {e}")
            continue

    print()
    print("="*80)
    print(f"Zillow Summary:")
    print(f"  City files created: {total_files_created}")
    print(f"  Total neighborhoods: {total_neighborhoods}")
    print(f"  Output: {OUTPUT_NEIGHBORHOODS}")
    print("="*80)

    return total_files_created


def process_census_cities():
    """Process Census city boundary data."""
    print("\n" + "="*80)
    print("PROCESSING CENSUS CITY BOUNDARIES")
    print("="*80)

    if not CITIES_DIR.exists():
        print(f"ERROR: Cities directory not found: {CITIES_DIR}")
        return 0

    OUTPUT_CITIES.mkdir(parents=True, exist_ok=True)

    # Get all state directories
    state_dirs = [d for d in CITIES_DIR.iterdir() if d.is_dir()]
    print(f"\nFound {len(state_dirs)} state directories")

    total_files_created = 0

    for state_dir in sorted(state_dirs):
        state_code = state_dir.name.upper()
        city_files = list(state_dir.glob("*.json"))

        if not city_files:
            continue

        print(f"\n{state_code}: Processing {len(city_files)} cities...")

        for city_file in city_files:
            try:
                # Load city JSON
                with open(city_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Get city name from properties
                if 'features' not in data or len(data['features']) == 0:
                    continue

                city_name = data['features'][0]['properties'].get('NAME', '')
                if not city_name:
                    city_name = city_file.stem.replace('-', ' ').title()

                # Create filename
                city_key = normalize_name(city_name)
                state_key = state_code.lower()
                filename = f"{city_key}_{state_key}.geojson"
                output_file = OUTPUT_CITIES / filename

                # Save file
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f)

                total_files_created += 1

            except Exception as e:
                print(f"  ERROR processing {city_file.name}: {e}")
                continue

        print(f"  Created {len(city_files)} city boundary files")

    print()
    print("="*80)
    print(f"Census Cities Summary:")
    print(f"  City boundary files created: {total_files_created}")
    print(f"  Output: {OUTPUT_CITIES}")
    print("="*80)

    return total_files_created


def backup_old_data():
    """Backup existing calculated data."""
    print("\n" + "="*80)
    print("BACKING UP OLD DATA")
    print("="*80)

    backup_dir = SCRIPT_DIR.parent / "public" / "_backup_calculated"
    backup_dir.mkdir(parents=True, exist_ok=True)

    if OUTPUT_NEIGHBORHOODS.exists():
        backup_neighborhoods = backup_dir / "neighborhoods"
        if not backup_neighborhoods.exists():
            import shutil
            shutil.copytree(OUTPUT_NEIGHBORHOODS, backup_neighborhoods)
            print(f"  Backed up neighborhoods to {backup_neighborhoods}")

    if OUTPUT_CITIES.exists():
        backup_cities = backup_dir / "cities"
        if not backup_cities.exists():
            import shutil
            shutil.copytree(OUTPUT_CITIES, backup_cities)
            print(f"  Backed up cities to {backup_cities}")

    print("="*80)


def main():
    print("\n" + "="*80)
    print("REPLACING WITH OFFICIAL DATA")
    print("="*80)

    # Backup old data
    backup_old_data()

    # Clear existing data
    print("\nClearing old calculated data...")
    for f in OUTPUT_NEIGHBORHOODS.glob("*.geojson"):
        f.unlink()
    for f in OUTPUT_CITIES.glob("*.geojson"):
        f.unlink()

    # Process official data
    neighborhoods_count = process_zillow_neighborhoods()
    cities_count = process_census_cities()

    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Total neighborhood files: {neighborhoods_count}")
    print(f"Total city boundary files: {cities_count}")
    print(f"\nData is now served from official sources:")
    print(f"  - Zillow neighborhoods (crowd-sourced)")
    print(f"  - US Census city boundaries (government)")
    print("="*80)


if __name__ == "__main__":
    main()
