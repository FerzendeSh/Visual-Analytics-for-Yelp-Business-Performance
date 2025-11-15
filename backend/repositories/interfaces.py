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
        limit: int = 1000
    ) -> List[Business]:
        """Get businesses within a geographic viewport."""
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
