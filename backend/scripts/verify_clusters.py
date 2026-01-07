"""Verify cluster data in database."""
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from database.database import async_session_maker
from sqlalchemy import text


async def verify():
    async with async_session_maker() as session:
        # Check cluster_runs
        result = await session.execute(text('SELECT COUNT(*) FROM cluster_runs'))
        runs = result.scalar()
        print(f'[OK] Cluster Runs: {runs}')

        # Check clusters
        result = await session.execute(text('SELECT COUNT(*) FROM clusters'))
        clusters = result.scalar()
        print(f'[OK] Clusters: {clusters}')

        # Check business_clusters
        result = await session.execute(text('SELECT COUNT(*) FROM business_clusters'))
        business_clusters = result.scalar()
        print(f'[OK] Business Clusters: {business_clusters}')

        # Check cluster_timeline_metrics
        result = await session.execute(text('SELECT COUNT(*) FROM cluster_timeline_metrics'))
        metrics = result.scalar()
        print(f'[OK] Cluster Timeline Metrics: {metrics}')

        # Sample some cluster labels
        print('\nSample cluster labels:')
        result = await session.execute(
            text('SELECT cluster_label, ai_label, size FROM clusters LIMIT 5')
        )
        for row in result:
            print(f'  - Cluster {row[0]}: {row[1]} ({row[2]} businesses)')


if __name__ == "__main__":
    asyncio.run(verify())
