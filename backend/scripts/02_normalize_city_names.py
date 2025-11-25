"""
Database update script to fix city name inconsistencies.

Usage:
    python -m scripts.fix_city_names --dry-run
    python -m scripts.fix_city_names
    python -m scripts.fix_city_names --include-saint-louis
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from sqlalchemy import text


async def create_backup(session, mappings: List[Dict], include_saint_louis: bool = False) -> str:
    print("\n" + "=" * 100)
    print("CREATING BACKUP")
    print("=" * 100)

    backup_data = {
        'timestamp': datetime.now().isoformat(),
        'total_records': 0,
        'records': []
    }

    for mapping in mappings:
        query = text("""
            SELECT business_id, name, city, state, latitude, longitude
            FROM businesses
            WHERE city = :city AND state = :state
        """)

        result = await session.execute(query, {
            'city': mapping['original'],
            'state': mapping['state']
        })

        records = result.fetchall()
        for record in records:
            backup_data['records'].append({
                'business_id': record.business_id,
                'name': record.name,
                'city': record.city,
                'state': record.state,
                'latitude': record.latitude,
                'longitude': record.longitude
            })

        backup_data['total_records'] += len(records)

    if include_saint_louis:
        query = text("""
            SELECT business_id, name, city, state, latitude, longitude
            FROM businesses
            WHERE city = 'Saint Louis' AND state = 'MO'
        """)

        result = await session.execute(query)
        records = result.fetchall()

        for record in records:
            backup_data['records'].append({
                'business_id': record.business_id,
                'name': record.name,
                'city': record.city,
                'state': record.state,
                'latitude': record.latitude,
                'longitude': record.longitude
            })

        backup_data['total_records'] += len(records)

    backup_file = backend_dir.parent / f"city_normalization_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, indent=2)

    print(f"Backed up {backup_data['total_records']} records to {backup_file.name}")
    return str(backup_file)


async def verify_before_update(session, mappings: List[Dict], include_saint_louis: bool = False) -> Dict:
    print("\n" + "=" * 100)
    print("PRE-UPDATE VERIFICATION")
    print("=" * 100)

    stats = {
        'total_to_update': 0,
        'by_city': {},
        'unique_cities_before': set(),
        'unique_cities_after': set()
    }

    for mapping in mappings:
        query = text("""
            SELECT COUNT(*) as count
            FROM businesses
            WHERE city = :city AND state = :state
        """)

        result = await session.execute(query, {
            'city': mapping['original'],
            'state': mapping['state']
        })

        count = result.scalar()

        if count > 0:
            key = f"{mapping['canonical']}, {mapping['state']}"
            if key not in stats['by_city']:
                stats['by_city'][key] = {
                    'canonical': mapping['canonical'],
                    'variations': [],
                    'total': 0
                }

            stats['by_city'][key]['variations'].append({
                'original': mapping['original'],
                'count': count
            })
            stats['by_city'][key]['total'] += count
            stats['total_to_update'] += count

            stats['unique_cities_before'].add(f"{mapping['original']}, {mapping['state']}")
            stats['unique_cities_after'].add(f"{mapping['canonical']}, {mapping['state']}")

    if include_saint_louis:
        query = text("""
            SELECT COUNT(*) as count
            FROM businesses
            WHERE city = 'Saint Louis' AND state = 'MO'
        """)

        result = await session.execute(query)
        count = result.scalar()

        if count > 0:
            key = "St. Louis, MO"
            if key not in stats['by_city']:
                stats['by_city'][key] = {
                    'canonical': 'St. Louis',
                    'variations': [],
                    'total': 0
                }

            stats['by_city'][key]['variations'].append({
                'original': 'Saint Louis',
                'count': count
            })
            stats['by_city'][key]['total'] += count
            stats['total_to_update'] += count

            stats['unique_cities_before'].add("Saint Louis, MO")
            stats['unique_cities_after'].add("St. Louis, MO")

    print(f"Total businesses to update: {stats['total_to_update']}")
    print(f"Unique city/state combinations before: {len(stats['unique_cities_before'])}")
    print(f"Unique city/state combinations after: {len(stats['unique_cities_after'])}")
    print(f"Reduction in duplicates: {len(stats['unique_cities_before']) - len(stats['unique_cities_after'])}")
    print()

    for city_key, data in sorted(stats['by_city'].items()):
        print(f"{city_key}:")
        for var in data['variations']:
            print(f"  '{var['original']}' -> '{data['canonical']}': {var['count']} businesses")
        print(f"  Total: {data['total']} businesses")
        print()

    return stats


async def apply_updates(session, mappings: List[Dict], include_saint_louis: bool = False, dry_run: bool = False) -> Dict:
    if dry_run:
        print("\n" + "=" * 100)
        print("DRY RUN - NO CHANGES WILL BE MADE")
        print("=" * 100)
    else:
        print("\n" + "=" * 100)
        print("APPLYING UPDATES")
        print("=" * 100)

    results = {
        'updated': 0,
        'failed': 0,
        'details': []
    }

    for mapping in mappings:
        original = mapping['original']
        state = mapping['state']
        canonical = mapping['canonical']

        count_query = text("""
            SELECT COUNT(*)
            FROM businesses
            WHERE city = :original AND state = :state
        """)

        result = await session.execute(count_query, {
            'original': original,
            'state': state
        })
        count = result.scalar()

        if count > 0:
            print(f"{state}: '{original}' -> '{canonical}' ({count} businesses)")

            if not dry_run:
                try:
                    update_query = text("""
                        UPDATE businesses
                        SET city = :canonical
                        WHERE city = :original AND state = :state
                    """)

                    await session.execute(update_query, {
                        'canonical': canonical,
                        'original': original,
                        'state': state
                    })

                    results['updated'] += count
                    results['details'].append({
                        'state': state,
                        'original': original,
                        'canonical': canonical,
                        'count': count,
                        'status': 'success'
                    })

                except Exception as e:
                    print(f"Failed to update {original}: {str(e)}")
                    results['failed'] += count
                    results['details'].append({
                        'state': state,
                        'original': original,
                        'canonical': canonical,
                        'count': count,
                        'status': 'failed',
                        'error': str(e)
                    })
            else:
                results['updated'] += count

    if include_saint_louis:
        count_query = text("""
            SELECT COUNT(*)
            FROM businesses
            WHERE city = 'Saint Louis' AND state = 'MO'
        """)

        result = await session.execute(count_query)
        count = result.scalar()

        if count > 0:
            print(f"MO: 'Saint Louis' -> 'St. Louis' ({count} businesses)")

            if not dry_run:
                try:
                    update_query = text("""
                        UPDATE businesses
                        SET city = 'St. Louis'
                        WHERE city = 'Saint Louis' AND state = 'MO'
                    """)

                    await session.execute(update_query)

                    results['updated'] += count
                    results['details'].append({
                        'state': 'MO',
                        'original': 'Saint Louis',
                        'canonical': 'St. Louis',
                        'count': count,
                        'status': 'success'
                    })

                except Exception as e:
                    print(f"Failed to update Saint Louis: {str(e)}")
                    results['failed'] += count
                    results['details'].append({
                        'state': 'MO',
                        'original': 'Saint Louis',
                        'canonical': 'St. Louis',
                        'count': count,
                        'status': 'failed',
                        'error': str(e)
                    })
            else:
                results['updated'] += count

    if not dry_run:
        await session.commit()
        print()
        print(f"Successfully updated {results['updated']} businesses")
        if results['failed'] > 0:
            print(f"Failed to update {results['failed']} businesses")
    else:
        print()
        print(f"Would update {results['updated']} businesses")
        print("Run without --dry-run to apply changes")

    return results


async def verify_after_update(session, mappings: List[Dict], include_saint_louis: bool = False):
    print("\n" + "=" * 100)
    print("POST-UPDATE VERIFICATION")
    print("=" * 100)

    issues = []

    for mapping in mappings:
        query = text("""
            SELECT COUNT(*)
            FROM businesses
            WHERE city = :city AND state = :state
        """)

        result = await session.execute(query, {
            'city': mapping['original'],
            'state': mapping['state']
        })
        count = result.scalar()

        if count > 0:
            issues.append(f"{count} businesses still have '{mapping['original']}' in {mapping['state']}")

    if include_saint_louis:
        query = text("""
            SELECT COUNT(*)
            FROM businesses
            WHERE city = 'Saint Louis' AND state = 'MO'
        """)

        result = await session.execute(query)
        count = result.scalar()

        if count > 0:
            issues.append(f"{count} businesses still have 'Saint Louis' in MO")

    if issues:
        print("Issues found:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("All city names successfully normalized")
        print("No inconsistencies remaining")

    print()
    print("Canonical city counts:")

    canonical_cities = set(m['canonical'] for m in mappings)
    if include_saint_louis:
        canonical_cities.add('St. Louis')

    for city in sorted(canonical_cities):
        query = text("""
            SELECT state, COUNT(*) as count
            FROM businesses
            WHERE city = :city
            GROUP BY state
        """)

        result = await session.execute(query, {'city': city})
        rows = result.fetchall()

        for row in rows:
            print(f"  {city}, {row.state}: {row.count} businesses")


async def main():
    dry_run = '--dry-run' in sys.argv
    include_saint_louis = '--include-saint-louis' in sys.argv

    print("\n" + "=" * 100)
    print("CITY NAME NORMALIZATION - DATABASE UPDATE")
    print("=" * 100)

    if dry_run:
        print("MODE: DRY RUN - No changes will be made")
    else:
        print("MODE: LIVE - Database will be updated")

    if include_saint_louis:
        print("Including 'Saint Louis' -> 'St. Louis' normalization")

    mapping_file = Path(__file__).resolve().parent / 'city_normalization_map.json'

    if not mapping_file.exists():
        print(f"Mapping file not found: {mapping_file}")
        print("Run analyze_city_inconsistencies.py first")
        return

    with open(mapping_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    mappings = data['mapping']

    print(f"Loaded {len(mappings)} mappings")

    async with async_session_maker() as session:
        try:
            stats = await verify_before_update(session, mappings, include_saint_louis)

            if stats['total_to_update'] == 0:
                print("No businesses to update")
                return

            if not dry_run:
                backup_file = await create_backup(session, mappings, include_saint_louis)

            results = await apply_updates(session, mappings, include_saint_louis, dry_run)

            if not dry_run:
                await verify_after_update(session, mappings, include_saint_louis)

                print("\n" + "=" * 100)
                print("SUMMARY")
                print("=" * 100)
                print(f"Total businesses updated: {results['updated']}")
                if results['failed'] > 0:
                    print(f"Failed updates: {results['failed']}")
                print(f"Backup saved to: {backup_file}")
                print("\nCity name normalization completed")

        except Exception as e:
            print(f"Error during update: {str(e)}")
            print("Rolling back changes")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
