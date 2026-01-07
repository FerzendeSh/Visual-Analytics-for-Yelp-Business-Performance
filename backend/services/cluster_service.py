"""
Cluster service for business logic.
Handles cluster operations and DTO transformations.
"""
from typing import List, Optional, Dict, Any
from datetime import date as date_type

from repositories.cluster_repository import ClusterRepository
from repositories.metrics_repository import MetricsRepository
from repositories.interfaces import ClusterRepositoryInterface
from schemas.cluster_dto import (
    ClusterRunDTO,
    ClusterSummaryDTO,
    ClusterDetailDTO,
    ClusterTimelineDTO,
    ClusterTimelinePointDTO,
    ClusterCatalogResponse,
    ClusterListResponse
)
from models.cluster import ClusterRun, Cluster
from sqlalchemy.ext.asyncio import AsyncSession


class ClusterService:
    """Service for cluster-related business logic"""

    def __init__(self, cluster_repo: ClusterRepositoryInterface, db: AsyncSession):
        self.cluster_repo = cluster_repo
        self.db = db

    def _cluster_run_to_dto(self, run: ClusterRun) -> ClusterRunDTO:
        """Convert ClusterRun model to DTO"""
        return ClusterRunDTO(
            run_id=run.run_id,
            level=run.level.value if hasattr(run.level, 'value') else run.level,
            created_at=run.created_at,
            feature_variant=run.feature_variant,
            dimred_method=run.dimred_method,
            total_entities_processed=run.total_entities_processed,
            total_clusters_created=run.total_clusters_created,
            avg_composite_score=run.avg_composite_score,
            execution_time_seconds=run.execution_time_seconds
        )

    def _cluster_to_summary_dto(self, cluster: Cluster) -> ClusterSummaryDTO:
        """Convert Cluster model to summary DTO"""
        return ClusterSummaryDTO(
            cluster_id=cluster.cluster_id,
            run_id=cluster.run_id,
            city=cluster.city,
            neighborhood=cluster.neighborhood,
            cluster_label=cluster.cluster_label,
            method=cluster.method.value if hasattr(cluster.method, 'value') else cluster.method,
            size=cluster.size,
            avg_stars=cluster.avg_stars,
            avg_review_count=cluster.avg_review_count,
            centroid_lat=cluster.centroid_lat,
            centroid_lon=cluster.centroid_lon,
            ai_label=cluster.ai_label,
            ai_description=cluster.ai_description,
            top_categories=cluster.top_categories
        )

    def _cluster_to_detail_dto(self, cluster: Cluster) -> ClusterDetailDTO:
        """Convert Cluster model to detailed DTO"""
        return ClusterDetailDTO(
            cluster_id=cluster.cluster_id,
            run_id=cluster.run_id,
            city=cluster.city,
            neighborhood=cluster.neighborhood,
            cluster_label=cluster.cluster_label,
            method=cluster.method.value if hasattr(cluster.method, 'value') else cluster.method,
            size=cluster.size,
            avg_stars=cluster.avg_stars,
            avg_review_count=cluster.avg_review_count,
            centroid_lat=cluster.centroid_lat,
            centroid_lon=cluster.centroid_lon,
            ai_label=cluster.ai_label,
            ai_description=cluster.ai_description,
            top_categories=cluster.top_categories,
            ai_key_characteristics=cluster.ai_key_characteristics,
            attribute_patterns=cluster.attribute_patterns,
            silhouette_score=cluster.silhouette_score,
            davies_bouldin_score=cluster.davies_bouldin_score,
            calinski_harabasz_score=cluster.calinski_harabasz_score,
            composite_score=cluster.composite_score,
            method_params=cluster.method_params,
            avg_price_range=cluster.avg_price_range
        )

    async def get_catalog(self) -> ClusterCatalogResponse:
        """
        Get catalog of available cluster runs.

        Returns:
            ClusterCatalogResponse with all runs and latest run
        """
        runs = await self.cluster_repo.get_cluster_runs(skip=0, limit=10)
        latest_run = await self.cluster_repo.get_latest_cluster_run()

        return ClusterCatalogResponse(
            runs=[self._cluster_run_to_dto(run) for run in runs],
            latest_run=self._cluster_run_to_dto(latest_run) if latest_run else None
        )

    async def get_clusters(
        self,
        run_id: Optional[int] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_size: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> ClusterListResponse:
        """
        Get list of clusters with filters.

        Args:
            run_id: Optional run ID (defaults to latest)
            city: Optional city filter
            state: Optional state filter
            min_size: Minimum cluster size
            skip: Pagination offset
            limit: Maximum results

        Returns:
            ClusterListResponse with clusters and metadata
        """
        if not run_id:
            latest_run = await self.cluster_repo.get_latest_cluster_run()
            if not latest_run:
                return ClusterListResponse(clusters=[], total=0, skip=skip, limit=limit)
            run_id = latest_run.run_id

        clusters = await self.cluster_repo.get_clusters_by_run(
            run_id=run_id,
            city=city,
            state=state,
            min_size=min_size,
            skip=skip,
            limit=limit
        )

        total = await self.cluster_repo.count_clusters_by_run(
            run_id=run_id,
            city=city,
            state=state,
            min_size=min_size
        )

        return ClusterListResponse(
            clusters=[self._cluster_to_summary_dto(c) for c in clusters],
            total=total,
            skip=skip,
            limit=limit
        )

    async def get_clusters_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        run_id: Optional[int] = None,
        min_size: int = 5
    ) -> List[ClusterSummaryDTO]:
        """
        Get clusters in viewport bounds.

        Args:
            south: Southern latitude
            north: Northern latitude
            west: Western longitude
            east: Eastern longitude
            run_id: Optional run ID (defaults to latest)
            min_size: Minimum cluster size

        Returns:
            List of ClusterSummaryDTO
        """
        if not run_id:
            latest_run = await self.cluster_repo.get_latest_cluster_run()
            if not latest_run:
                return []
            run_id = latest_run.run_id

        clusters = await self.cluster_repo.get_clusters_in_viewport(
            run_id=run_id,
            south=south,
            north=north,
            west=west,
            east=east,
            min_size=min_size
        )

        return [self._cluster_to_summary_dto(c) for c in clusters]

    async def get_cluster_detail(self, cluster_id: int) -> Optional[ClusterDetailDTO]:
        """
        Get detailed cluster information.

        Args:
            cluster_id: Cluster identifier

        Returns:
            ClusterDetailDTO or None
        """
        cluster = await self.cluster_repo.get_cluster_by_id(cluster_id)
        if not cluster:
            return None

        return self._cluster_to_detail_dto(cluster)

    async def get_cluster_timeline(
        self,
        cluster_id: int,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> Optional[ClusterTimelineDTO]:
        """
        Get time series data for a cluster.

        Args:
            cluster_id: Cluster identifier
            period: Aggregation period (month/year)
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            ClusterTimelineDTO or None if cluster not found
        """
        cluster = await self.cluster_repo.get_cluster_by_id(cluster_id)
        if not cluster:
            return None

        timeline_data = await MetricsRepository.get_cluster_timeline(
            db=self.db,
            cluster_id=cluster_id,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        if not timeline_data:
            return ClusterTimelineDTO(
                cluster_id=cluster_id,
                cluster_label=cluster.ai_label,
                period=period,
                data=[],
                statistics={}
            )

        data_points = [
            ClusterTimelinePointDTO(
                period_start=point['period_start'].isoformat(),
                avg_rating=point['avg_rating'],
                avg_sentiment_score=point['avg_sentiment_score'],
                avg_sentiment_expected=point['avg_sentiment_expected'],
                review_count=point['review_count'],
                business_count=point['business_count']
            )
            for point in timeline_data
        ]

        total_reviews = sum(p['review_count'] for p in timeline_data)
        avg_rating = sum(p['avg_rating'] * p['review_count'] for p in timeline_data) / total_reviews if total_reviews > 0 else 0
        avg_sentiment = sum(p['avg_sentiment_score'] * p['review_count'] for p in timeline_data) / total_reviews if total_reviews > 0 else 0

        statistics = {
            'overall_avg_rating': round(avg_rating, 2),
            'overall_avg_sentiment': round(avg_sentiment, 3),
            'total_reviews': total_reviews,
            'date_range': {
                'start': timeline_data[0]['period_start'].isoformat() if timeline_data else None,
                'end': timeline_data[-1]['period_start'].isoformat() if timeline_data else None
            }
        }

        return ClusterTimelineDTO(
            cluster_id=cluster_id,
            cluster_label=cluster.ai_label,
            period=period,
            data=data_points,
            statistics=statistics
        )

    async def get_business_ids_in_cluster(
        self,
        cluster_id: int,
        limit: Optional[int] = None
    ) -> List[str]:
        """
        Get business IDs for a cluster.

        Args:
            cluster_id: Cluster identifier
            limit: Optional limit

        Returns:
            List of business IDs
        """
        return await self.cluster_repo.get_business_ids_in_cluster(cluster_id, limit)
