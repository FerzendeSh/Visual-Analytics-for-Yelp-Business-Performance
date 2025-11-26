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
        state: Optional[str] = None,
        city: Optional[str] = None,
        neighborhood: Optional[str] = None,
        category: Optional[str] = None,
        min_rating: Optional[float] = None,
        is_open: Optional[int] = None,
        limit: int = 1000
    ) -> List[Business]:
        """
        Get businesses within a geographic viewport with optional filters.

        Validates bounds before querying.

        Args:
            south: Southern latitude bound
            north: Northern latitude bound
            west: Western longitude bound
            east: Eastern longitude bound
            state: Filter by state code (will be normalized to uppercase)
            city: Filter by city name
            neighborhood: Filter by neighborhood name
            category: Filter by category (partial match)
            min_rating: Filter by minimum star rating
            is_open: Filter by open status (0 = closed, 1 = open)
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
        city: Optional[str] = None,
        state: Optional[str] = None,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a category.

        Args:
            category: Category name
            city: Optional city filter (for city-specific category data)
            state: Optional state filter (required if city is provided)
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
        city: Optional[str] = None,
        state: Optional[str] = None,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a category.

        Args:
            category: Category name
            city: Optional city filter (for city-specific category data)
            state: Optional state filter (required if city is provided)
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Dict with timeline data and metadata
        """
        pass

    @abstractmethod
    async def get_competitive_snapshot(
        self,
        city: Optional[str] = None,
        state: Optional[str] = None,
        neighborhood: Optional[str] = None,
        category: Optional[str] = None,
        business_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get competitive positioning snapshot for a market.

        Returns all businesses in the specified market (city/neighborhood/category) with
        pre-calculated statistics for competitive analysis visualization.

        Args:
            city: City name (optional)
            state: State code (optional, recommended with city)
            neighborhood: Neighborhood name (optional)
            category: Category name (optional)
            business_id: Specific business to highlight (optional)

        Returns:
            Dict with businesses and market statistics:
            {
                "businesses": List of business data with ratings and review counts,
                "statistics": {
                    "avg_rating": float,
                    "median_review_count": int,
                    "total_businesses": int
                },
                "selected_business": Optional business data if business_id provided
            }
        """
        pass

    @abstractmethod
    async def get_neighborhood_ratings_timeline(
        self,
        neighborhood: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get ratings timeline for a neighborhood.

        Args:
            neighborhood: Neighborhood name
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
    async def get_neighborhood_sentiment_timeline(
        self,
        neighborhood: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a neighborhood.

        Args:
            neighborhood: Neighborhood name
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
    async def get_neighborhood_combined_timeline(
        self,
        neighborhood: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get combined ratings and sentiment timelines for a neighborhood with optional category comparison.

        Args:
            neighborhood: Neighborhood name
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter
            category: Optional category for comparison

        Returns:
            Dict with combined neighborhood and optional category timeline data
        """
        pass
