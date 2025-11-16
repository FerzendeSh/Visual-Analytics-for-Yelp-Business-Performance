"""
Check Nashville data to diagnose calculation issues
"""
import sys
from pathlib import Path
# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from sqlalchemy import text, select
from database.database import async_session_maker
from models.business import Business
from models.review import Review


async def check_data():
    async with async_session_maker() as session:
        print("=" * 60)
        print("NASHVILLE DATA CHECK")
        print("=" * 60)

        # Check Nashville businesses
        result = await session.execute(text("""
            SELECT COUNT(*) as business_count
            FROM businesses
            WHERE city ILIKE '%nashville%'
        """))
        business_count = result.scalar()
        print(f"\n1. Nashville businesses: {business_count}")

        # Sample Nashville businesses
        result = await session.execute(text("""
            SELECT business_id, name, city, state, stars, review_count
            FROM businesses
            WHERE city ILIKE '%nashville%'
            LIMIT 3
        """))
        print("\n2. Sample businesses:")
        for row in result:
            print(f"   - {row.name} ({row.city}, {row.state}): {row.stars} stars ({row.review_count} reviews)")

        # Check reviews for Nashville
        result = await session.execute(text("""
            SELECT COUNT(*) as review_count
            FROM reviews r
            JOIN businesses b ON r.business_id = b.business_id
            WHERE b.city ILIKE '%nashville%'
        """))
        review_count = result.scalar()
        print(f"\n3. Nashville total reviews: {review_count}")

        # Check sentiment data structure
        result = await session.execute(text("""
            SELECT
                r.stars,
                r.sentiment_score,
                r.sentiment_expected,
                b.name,
                b.city
            FROM reviews r
            JOIN businesses b ON r.business_id = b.business_id
            WHERE b.city ILIKE '%nashville%'
            LIMIT 5
        """))
        print("\n4. Sample review data:")
        print("   Stars | Sentiment Score | Sentiment Expected | Business | City")
        print("   " + "-" * 70)
        for row in result:
            print(f"   {row.stars:5} | {row.sentiment_score or 'NULL':15} | {row.sentiment_expected or 'NULL':18} | {row.name[:20]:20} | {row.city}")

        # Check if sentiment fields are NULL
        result = await session.execute(text("""
            SELECT
                COUNT(*) as total,
                COUNT(sentiment_score) as with_sentiment,
                COUNT(sentiment_expected) as with_expected,
                AVG(CAST(sentiment_score AS FLOAT)) as avg_sentiment,
                AVG(CAST(stars AS FLOAT)) as avg_rating
            FROM reviews r
            JOIN businesses b ON r.business_id = b.business_id
            WHERE b.city ILIKE '%nashville%'
        """))
        row = result.fetchone()
        print(f"\n5. Sentiment data completeness:")
        print(f"   Total reviews: {row.total}")
        print(f"   With sentiment_score: {row.with_sentiment}")
        print(f"   With sentiment_expected: {row.with_expected}")
        print(f"   Avg sentiment score: {row.avg_sentiment}")
        print(f"   Avg rating (stars): {row.avg_rating}")

        # Check date range
        result = await session.execute(text("""
            SELECT
                MIN(date) as earliest,
                MAX(date) as latest
            FROM reviews r
            JOIN businesses b ON r.business_id = b.business_id
            WHERE b.city ILIKE '%nashville%'
        """))
        row = result.fetchone()
        print(f"\n6. Review date range:")
        print(f"   Earliest: {row.earliest}")
        print(f"   Latest: {row.latest}")

        print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(check_data())
