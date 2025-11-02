"""
Database seeding script to load JSON data into PostgreSQL.
Run this script to populate the database with initial data from JSON files.

Usage:
    python -m scripts.seed_database
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from models.business import Business
from models.photo import Photo
from models.review import Review


# Data file paths
DATA_DIR = backend_dir / "data"
BUSINESSES_JSON = DATA_DIR / "subset_businesses.json"
PHOTOS_JSON = DATA_DIR / "subset_photos.json"
REVIEWS_JSON = DATA_DIR / "reviews_complete.json"


def load_json_file(file_path: Path) -> List[Dict[str, Any]]:
    """
    Load JSON data from file.
    Supports both regular JSON arrays and NDJSON (newline-delimited).
    """
    if not file_path.exists():
        raise FileNotFoundError(f"JSON file not found: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            # Try loading as regular JSON array
            data = json.load(f)
            print(f"[+] Loaded {len(data)} records from {file_path.name}")
            return data
        except json.JSONDecodeError:
            # Try loading as NDJSON (newline-delimited)
            f.seek(0)
            data = []
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    try:
                        data.append(json.loads(line))
                    except json.JSONDecodeError as e:
                        print(f"[!] Warning: Skipping invalid JSON on line {line_num}: {e}")
            print(f"[+] Loaded {len(data)} records from {file_path.name} (NDJSON format)")
            return data


async def seed_businesses(session: AsyncSession, businesses_data: List[Dict[str, Any]]) -> int:
    """
    Seed businesses table from JSON data.

    Returns:
        Number of businesses inserted
    """
    print("\n[*] Seeding businesses...")

    inserted_count = 0
    skipped_count = 0

    for business_data in businesses_data:
        business_id = business_data.get('business_id')

        # Check if business already exists
        result = await session.execute(
            select(Business).where(Business.business_id == business_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            skipped_count += 1
            continue

        # Create new business
        business = Business(
            business_id=business_data['business_id'],
            name=business_data['name'],
            city=business_data['city'],
            state=business_data['state'],
            latitude=business_data['latitude'],
            longitude=business_data['longitude'],
            review_count=business_data.get('review_count', 0),
            stars=business_data.get('stars', 0.0),
            is_open=business_data.get('is_open', 1),
            photo_count=business_data.get('photo_count', 0.0),
            categories=business_data.get('categories', ''),
            attributes=business_data.get('attributes', {}),
            hours=business_data.get('hours', {})
        )

        session.add(business)
        inserted_count += 1

        # Commit in batches
        if inserted_count % 100 == 0:
            await session.commit()
            print(f"  >> Inserted {inserted_count} businesses...")

    # Final commit
    await session.commit()

    print(f"[+] Inserted {inserted_count} businesses")
    if skipped_count > 0:
        print(f"  [-] Skipped {skipped_count} existing businesses")

    return inserted_count


async def seed_photos(session: AsyncSession, photos_data: List[Dict[str, Any]]) -> int:
    """
    Seed photos table from JSON data.

    Returns:
        Number of photos inserted
    """
    print("\n[*] Seeding photos...")

    inserted_count = 0
    skipped_count = 0
    orphaned_count = 0

    for photo_data in photos_data:
        photo_id = photo_data.get('photo_id')
        business_id = photo_data.get('business_id')

        # Check if photo already exists
        result = await session.execute(
            select(Photo).where(Photo.photo_id == photo_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            skipped_count += 1
            continue

        # Check if business exists (foreign key constraint)
        result = await session.execute(
            select(Business).where(Business.business_id == business_id)
        )
        business_exists = result.scalar_one_or_none()

        if not business_exists:
            orphaned_count += 1
            continue

        # Create new photo
        photo = Photo(
            photo_id=photo_data['photo_id'],
            business_id=photo_data['business_id'],
            label=photo_data.get('label', 'unknown')
        )

        session.add(photo)
        inserted_count += 1

        # Commit in batches
        if inserted_count % 500 == 0:
            await session.commit()
            print(f"  >> Inserted {inserted_count} photos...")

    # Final commit
    await session.commit()

    print(f"[+] Inserted {inserted_count} photos")
    if skipped_count > 0:
        print(f"  [-] Skipped {skipped_count} existing photos")
    if orphaned_count > 0:
        print(f"  [!] Skipped {orphaned_count} orphaned photos (business not found)")

    return inserted_count


async def seed_reviews(session: AsyncSession, reviews_data: List[Dict[str, Any]]) -> int:
    """
    Seed reviews table from JSON data.

    Returns:
        Number of reviews inserted
    """
    print("\n[*] Seeding reviews...")

    inserted_count = 0
    skipped_count = 0
    orphaned_count = 0
    error_count = 0

    for review_data in reviews_data:
        review_id = review_data.get('review_id')
        business_id = review_data.get('business_id')

        # Check if review already exists
        result = await session.execute(
            select(Review).where(Review.review_id == review_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            skipped_count += 1
            continue

        # Check if business exists (foreign key constraint)
        result = await session.execute(
            select(Business).where(Business.business_id == business_id)
        )
        business_exists = result.scalar_one_or_none()

        if not business_exists:
            orphaned_count += 1
            continue

        try:
            # Parse date string (format: "2015-09-23 23:10:31" or "2015-09-23")
            date_str = review_data.get('date', '')
            if ' ' in date_str:
                # Has timestamp, extract just the date part
                review_date = datetime.strptime(date_str.split()[0], '%Y-%m-%d').date()
            else:
                # Just a date
                review_date = datetime.strptime(date_str, '%Y-%m-%d').date()

            # Create new review
            review = Review(
                review_id=review_data['review_id'],
                business_id=review_data['business_id'],
                text=review_data.get('text', ''),
                stars=review_data.get('stars', 0.0),
                date=review_date,
                user_id=review_data.get('user_id', ''),
                useful=review_data.get('useful', 0),
                funny=review_data.get('funny', 0),
                cool=review_data.get('cool', 0),
                sentiment_label=review_data.get('sentiment_label', 'neutral'),
                sentiment_confidence=review_data.get('sentiment_confidence', 0.0),
                prob_negative=review_data.get('prob_negative', 0.0),
                prob_neutral=review_data.get('prob_neutral', 0.0),
                prob_positive=review_data.get('prob_positive', 0.0),
                sentiment_score_prob_diff=review_data.get('sentiment_score_prob_diff', 0.0),
                sentiment_score_expected=review_data.get('sentiment_score_expected', 0.0),
                sentiment_score_logit=review_data.get('sentiment_score_logit', 0.0)
            )

            session.add(review)
            inserted_count += 1

            # Commit in batches
            if inserted_count % 500 == 0:
                await session.commit()
                print(f"  >> Inserted {inserted_count} reviews...")

        except Exception as e:
            error_count += 1
            if error_count <= 5:  # Only print first 5 errors
                print(f"  [!] Error processing review {review_id}: {e}")

    # Final commit
    await session.commit()

    print(f"[+] Inserted {inserted_count} reviews")
    if skipped_count > 0:
        print(f"  [-] Skipped {skipped_count} existing reviews")
    if orphaned_count > 0:
        print(f"  [!] Skipped {orphaned_count} orphaned reviews (business not found)")
    if error_count > 0:
        print(f"  [!] Encountered {error_count} errors during processing")

    return inserted_count


async def verify_data(session: AsyncSession):
    """
    Verify seeded data by counting records.
    """
    print("\n[*] Verifying seeded data...")

    # Count businesses
    result = await session.execute(select(Business))
    business_count = len(result.scalars().all())
    print(f"  - Total businesses in database: {business_count}")

    # Count photos
    result = await session.execute(select(Photo))
    photo_count = len(result.scalars().all())
    print(f"  - Total photos in database: {photo_count}")

    # Count reviews
    result = await session.execute(select(Review))
    review_count = len(result.scalars().all())
    print(f"  - Total reviews in database: {review_count}")


async def main():
    """
    Main seeding function.
    """
    print("="*60)
    print("DATABASE SEEDING SCRIPT")
    print("="*60)

    try:
        # Load JSON data
        print("\n[*] Loading JSON files...")
        businesses_data = load_json_file(BUSINESSES_JSON)
        photos_data = load_json_file(PHOTOS_JSON)
        reviews_data = load_json_file(REVIEWS_JSON)

        # Create async session
        async with async_session_maker() as session:
            # Seed businesses first (foreign key dependency)
            business_count = await seed_businesses(session, businesses_data)

            # Seed photos
            photo_count = await seed_photos(session, photos_data)

            # Seed reviews (depends on businesses)
            review_count = await seed_reviews(session, reviews_data)

            # Verify data
            await verify_data(session)

        print("\n" + "="*60)
        print("SUCCESS! DATABASE SEEDING COMPLETED!")
        print(f"   [+] {business_count} businesses added")
        print(f"   [+] {photo_count} photos added")
        print(f"   [+] {review_count} reviews added")
        print("="*60)

    except FileNotFoundError as e:
        print(f"\n[ERROR] {e}")
        print("   Make sure the JSON files exist in the data/ directory")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
