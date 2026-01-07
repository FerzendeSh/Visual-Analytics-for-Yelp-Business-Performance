"""
Cluster repository for database operations.
Handles all cluster-related queries.
"""
from typing import List, Optional
from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.cluster import ClusterRun, Cluster, BusinessCluster, ClusterLevel
from models.business import Business


class ClusterRepository:
    """Repository for cluster database operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_latest_cluster_run(self, level: Optional[str] = None) -> Optional[ClusterRun]:
        """
        Get the most recent cluster run.

        Args:
            level: Optional level filter (city/neighborhood)

        Returns:
            Latest ClusterRun or None
        """
        stmt = select(ClusterRun).order_by(ClusterRun.created_at.desc())

        if level:
            stmt = stmt.where(ClusterRun.level == level)

        stmt = stmt.limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_cluster_runs(self, skip: int = 0, limit: int = 10) -> List[ClusterRun]:
        """
        Get all cluster runs ordered by creation date.

        Args:
            skip: Offset for pagination
            limit: Maximum number of results

        Returns:
            List of ClusterRun objects
        """
        stmt = (
            select(ClusterRun)
            .order_by(ClusterRun.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_cluster_by_id(self, cluster_id: int) -> Optional[Cluster]:
        """
        Get a specific cluster by ID.

        Args:
            cluster_id: Cluster identifier

        Returns:
            Cluster or None
        """
        stmt = select(Cluster).where(Cluster.cluster_id == cluster_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_clusters_by_run(
        self,
        run_id: int,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_size: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Cluster]:
        """
        Get clusters for a specific run with optional filters.

        Args:
            run_id: Cluster run identifier
            city: Optional city filter
            state: Optional state filter (used with city)
            min_size: Minimum cluster size
            skip: Offset for pagination
            limit: Maximum number of results

        Returns:
            List of Cluster objects
        """
        conditions = [Cluster.run_id == run_id, Cluster.cluster_label != -1]

        if city:
            conditions.append(Cluster.city == city)

        if min_size:
            conditions.append(Cluster.size >= min_size)

        stmt = (
            select(Cluster)
            .where(and_(*conditions))
            .order_by(Cluster.size.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_clusters_in_viewport(
        self,
        run_id: int,
        south: float,
        north: float,
        west: float,
        east: float,
        min_size: int = 5
    ) -> List[Cluster]:
        """
        Get clusters whose centroids fall within viewport bounds.

        Args:
            run_id: Cluster run identifier
            south: Southern latitude bound
            north: Northern latitude bound
            west: Western longitude bound
            east: Eastern longitude bound
            min_size: Minimum cluster size

        Returns:
            List of Cluster objects in viewport
        """
        stmt = (
            select(Cluster)
            .where(
                and_(
                    Cluster.run_id == run_id,
                    Cluster.centroid_lat >= south,
                    Cluster.centroid_lat <= north,
                    Cluster.centroid_lon >= west,
                    Cluster.centroid_lon <= east,
                    Cluster.size >= min_size,
                    Cluster.cluster_label != -1  # Exclude noise
                )
            )
            .order_by(Cluster.size.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_business_ids_in_cluster(
        self,
        cluster_id: int,
        limit: Optional[int] = None
    ) -> List[str]:
        """
        Get business IDs for a cluster.

        Args:
            cluster_id: Cluster identifier
            limit: Optional limit on number of businesses

        Returns:
            List of business IDs
        """
        stmt = (
            select(BusinessCluster.business_id)
            .where(BusinessCluster.cluster_id == cluster_id)
        )

        if limit:
            stmt = stmt.limit(limit)

        result = await self.db.execute(stmt)
        return [row[0] for row in result.all()]

    async def get_cluster_for_business(
        self,
        business_id: str,
        run_id: Optional[int] = None
    ) -> Optional[Cluster]:
        """
        Get the cluster assignment for a business.

        Args:
            business_id: Business identifier
            run_id: Optional run_id filter (defaults to latest)

        Returns:
            Cluster or None
        """
        if not run_id:
            latest_run = await self.get_latest_cluster_run()
            if not latest_run:
                return None
            run_id = latest_run.run_id

        stmt = (
            select(Cluster)
            .join(BusinessCluster, Cluster.cluster_id == BusinessCluster.cluster_id)
            .where(
                and_(
                    BusinessCluster.business_id == business_id,
                    Cluster.run_id == run_id
                )
            )
        )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_clusters_by_run(
        self,
        run_id: int,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_size: Optional[int] = None
    ) -> int:
        """
        Count clusters in a run (excluding noise).

        Args:
            run_id: Cluster run identifier
            city: Optional city filter
            state: Optional state filter (used with city)
            min_size: Minimum cluster size

        Returns:
            Number of clusters
        """
        conditions = [Cluster.run_id == run_id, Cluster.cluster_label != -1]

        if city:
            conditions.append(Cluster.city == city)

        if min_size:
            conditions.append(Cluster.size >= min_size)

        stmt = (
            select(func.count())
            .select_from(Cluster)
            .where(and_(*conditions))
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def create_cluster_run(self, run_data: dict) -> ClusterRun:
        """
        Create a new cluster run record.

        Args:
            run_data: Dictionary with ClusterRun fields

        Returns:
            Created ClusterRun
        """
        run = ClusterRun(**run_data)
        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)
        return run

    async def create_clusters_bulk(self, clusters_data: List[dict]) -> List[Cluster]:
        """
        Bulk create cluster records.

        Args:
            clusters_data: List of dictionaries with Cluster fields

        Returns:
            List of created Cluster objects
        """
        clusters = [Cluster(**data) for data in clusters_data]
        self.db.add_all(clusters)
        await self.db.flush()

        # Refresh to get IDs
        for cluster in clusters:
            await self.db.refresh(cluster)

        return clusters

    async def create_business_clusters_bulk(self, assignments: List[dict]) -> None:
        """
        Bulk create business cluster assignments.

        Args:
            assignments: List of dictionaries with BusinessCluster fields
        """
        business_clusters = [BusinessCluster(**data) for data in assignments]
        self.db.add_all(business_clusters)
        await self.db.flush()
