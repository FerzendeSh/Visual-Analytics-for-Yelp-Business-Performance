"""
Service interfaces (Abstract Base Classes).
Define contracts for business logic layer.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import date

from models.business import Business


class BusinessServiceInterface(ABC):
    """Abstract interface for business service operations."""

    @abstractmethod
    async def get_business_by_id(self, business_id: str) -> Business:
        """
        Get a single business by ID.

        Args:
            business_id: Unique business identifier

        Returns:
            Business object

        Raises:
            HTTPException: If business not found
        """
        pass

    @abstractmethod
    async def get_businesses(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        """
        Get list of businesses with optional filtering and pagination.

        Args:
            state: Filter by state code (will be normalized to uppercase)
            city: Filter by city name
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Business objects
        """
        pass

    @abstractmethod
    async def get_businesses_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        limit: int = 1000
    ) -> List[Business]:
        """
        Get businesses within a geographic viewport.

        Validates bounds before querying.

        Args:
            south: Southern latitude bound
            north: Northern latitude bound
            west: Western longitude bound
            east: Eastern longitude bound
            limit: Maximum number of businesses to return

        Returns:
            List of Business objects within the viewport

        Raises:
            HTTPException: If bounds are invalid
        """
        pass

    @abstractmethod
    async def search_businesses(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        """
        Search businesses using advanced fuzzy matching.

        Args:
            query: Search query - supports multi-term and fuzzy matching
            skip: Number of records to skip
            limit: Maximum number of results to return

        Returns:
            List of Business objects ranked by relevance
        """
        pass


class AnalyticsServiceInterface(ABC):
    """Abstract interface for analytics service operations."""

    @abstractmethod
    async def get_business_ratings_timeline(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a business.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata

        Raises:
            HTTPException: If business not found or invalid parameters
        """
        pass

    @abstractmethod
    async def get_business_sentiment_timeline(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a business.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata

        Raises:
            HTTPException: If business not found or invalid parameters
        """
        pass

    @abstractmethod
    async def get_business_timeline_with_city_comparison(
        self,
        business_id: str,
        metric: str = 'rating',
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get business timeline with city average comparison.

        Args:
            business_id: Business identifier
            metric: Metric to compare ('rating' or 'sentiment')
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with business and city comparison data

        Raises:
            HTTPException: If business not found or invalid parameters
        """
        pass

    @abstractmethod
    async def get_business_timeline_with_state_comparison(
        self,
        business_id: str,
        metric: str = 'rating',
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get business timeline with state average comparison.

        Args:
            business_id: Business identifier
            metric: Metric to compare ('rating' or 'sentiment')
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with business and state comparison data

        Raises:
            HTTPException: If business not found or invalid parameters
        """
        pass

    @abstractmethod
    async def get_city_ratings_timeline(
        self,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a city.

        Args:
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata
        """
        pass

    @abstractmethod
    async def get_state_ratings_timeline(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a state.

        Args:
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata
        """
        pass

    @abstractmethod
    async def get_category_ratings_timeline(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a category.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata
        """
        pass

    @abstractmethod
    async def get_category_sentiment_timeline(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a category.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata
        """
        pass
