"""
Repository interfaces (Abstract Base Classes).
Define contracts for data access layer.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import date

from models.business import Business
from models.review import Review


class BusinessRepositoryInterface(ABC):
    """Abstract interface for business data access operations."""

    @abstractmethod
    async def get_by_id(self, business_id: str) -> Optional[Business]:
        """Get a single business by ID."""
        pass

    @abstractmethod
    async def get_all(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        """Get list of businesses with optional filtering and pagination."""
        pass

    @abstractmethod
    async def get_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        state: Optional[str] = None,
        city: Optional[str] = None,
        neighborhood: Optional[str] = None,
        category: Optional[str] = None,
        min_rating: Optional[float] = None,
        is_open: Optional[int] = None,
        limit: int = 1000
    ) -> List[Business]:
        """Get businesses within a geographic viewport with optional filters."""
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        """Search businesses using fuzzy matching."""
        pass

    @abstractmethod
    async def get_states(self) -> List[str]:
        """Get list of unique states."""
        pass

    @abstractmethod
    async def get_cities_by_state(self, state: str) -> List[str]:
        """Get list of unique cities in a state."""
        pass

    @abstractmethod
    async def get_neighborhoods_by_city(self, state: str, city: str) -> List[str]:
        """Get list of unique neighborhoods in a city."""
        pass


class ReviewRepositoryInterface(ABC):
    """Abstract interface for review data access operations with time-series support."""

    @abstractmethod
    async def get_by_id(self, review_id: str) -> Optional[Review]:
        """Get a single review by ID."""
        pass

    @abstractmethod
    async def get_by_business(
        self,
        business_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Review]:
        """Get reviews for a specific business."""
        pass

    @abstractmethod
    async def get_business_ratings_over_time(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for a specific business.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count
        """
        pass

    @abstractmethod
    async def get_business_sentiment_over_time(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for a specific business.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, avg_sentiment_expected, review_count
        """
        pass

    @abstractmethod
    async def get_city_ratings_over_time(
        self,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for all businesses in a city.

        Args:
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        pass

    @abstractmethod
    async def get_state_ratings_over_time(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for all businesses in a state.

        Args:
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        pass

    @abstractmethod
    async def get_city_sentiment_over_time(
        self,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for all businesses in a city.

        Args:
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, review_count, business_count
        """
        pass

    @abstractmethod
    async def get_state_sentiment_over_time(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for all businesses in a state.

        Args:
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, review_count, business_count
        """
        pass

    @abstractmethod
    async def get_category_ratings_over_time(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for all businesses in a category.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        pass

    @abstractmethod
    async def get_category_sentiment_over_time(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for all businesses in a category.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, review_count, business_count
        """
        pass


class ClusterRepositoryInterface(ABC):
    """Abstract interface for cluster data access operations."""

    @abstractmethod
    async def get_latest_cluster_run(self, level: Optional[str] = None):
        """Get the most recent cluster run."""
        pass

    @abstractmethod
    async def get_cluster_runs(self, skip: int = 0, limit: int = 10):
        """Get all cluster runs ordered by creation date."""
        pass

    @abstractmethod
    async def get_cluster_by_id(self, cluster_id: int):
        """Get a specific cluster by ID."""
        pass

    @abstractmethod
    async def get_clusters_by_run(
        self,
        run_id: int,
        city: Optional[str] = None,
        min_size: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ):
        """Get clusters for a specific run with optional filters."""
        pass

    @abstractmethod
    async def get_clusters_in_viewport(
        self,
        run_id: int,
        south: float,
        north: float,
        west: float,
        east: float,
        min_size: int = 5
    ):
        """Get clusters whose centroids fall within viewport bounds."""
        pass

    @abstractmethod
    async def get_business_ids_in_cluster(self, cluster_id: int, limit: Optional[int] = None):
        """Get business IDs for a cluster."""
        pass

    @abstractmethod
    async def get_cluster_for_business(self, business_id: str, run_id: Optional[int] = None):
        """Get the cluster assignment for a business."""
        pass

    @abstractmethod
    async def count_clusters_by_run(self, run_id: int):
        """Count clusters in a run (excluding noise)."""
        pass

    @abstractmethod
    async def create_cluster_run(self, run_data: dict):
        """Create a new cluster run record."""
        pass

    @abstractmethod
    async def create_clusters_bulk(self, clusters_data: List[dict]):
        """Bulk create cluster records."""
        pass

    @abstractmethod
    async def create_business_clusters_bulk(self, assignments: List[dict]):
        """Bulk create business cluster assignments."""
        pass
