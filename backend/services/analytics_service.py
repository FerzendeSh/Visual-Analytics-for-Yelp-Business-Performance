"""
Analytics service layer for time-series data.
Orchestrates repository calls, combines data, and formats for API responses.
"""
from typing import Dict, Any, Optional
from datetime import date
from fastapi import HTTPException, status

from repositories.interfaces import ReviewRepositoryInterface, BusinessRepositoryInterface
from services.interfaces import AnalyticsServiceInterface


class AnalyticsService(AnalyticsServiceInterface):
    """
    Concrete implementation of analytics service.
    Handles business logic for time-series analytics and comparisons.
    """

    def __init__(
        self,
        review_repository: ReviewRepositoryInterface,
        business_repository: BusinessRepositoryInterface
    ):
        """
        Initialize service with repository dependencies.

        Args:
            review_repository: Repository for review data access
            business_repository: Repository for business data access
        """
        self.review_repository = review_repository
        self.business_repository = business_repository

    def _validate_period(self, period: str) -> None:
        """
        Validate time period parameter.

        Args:
            period: Time period string

        Raises:
            HTTPException: If period is invalid
        """
        valid_periods = {'day', 'week', 'month', 'year'}
        if period not in valid_periods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid period '{period}'. Must be one of: {valid_periods}"
            )

    def _validate_metric(self, metric: str) -> None:
        """
        Validate metric parameter.

        Args:
            metric: Metric string

        Raises:
            HTTPException: If metric is invalid
        """
        valid_metrics = {'rating', 'sentiment'}
        if metric not in valid_metrics:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metric '{metric}'. Must be one of: {valid_metrics}"
            )

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
        self._validate_period(period)

        # Verify business exists
        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

        # Get timeline data from repository
        timeline_data = await self.review_repository.get_business_ratings_over_time(
            business_id=business_id,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_id': business_id,
            'business_name': business.name,
            'period': period,
            'metric': 'rating',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

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

        self._validate_period(period)

        # Verify business exists
        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

        # Get timeline data from repository
        timeline_data = await self.review_repository.get_business_sentiment_over_time(
            business_id=business_id,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_id': business_id,
            'business_name': business.name,
            'period': period,
            'metric': 'sentiment',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

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

        self._validate_period(period)
        self._validate_metric(metric)

        # Verify business exists and get location
        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

        # Single database call for both business and city data
        if metric == 'rating':
            business_data, city_data = await self.review_repository.get_business_and_city_ratings_comparison(
                business_id=business_id,
                city=business.city,
                state=business.state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )
        else:  # sentiment
            business_data, city_data = await self.review_repository.get_business_and_city_sentiment_comparison(
                business_id=business_id,
                city=business.city,
                state=business.state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )

        return {
            'business_id': business_id,
            'business_name': business.name,
            'city': business.city,
            'state': business.state,
            'period': period,
            'metric': metric,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'business_data': business_data,
            'city_average': city_data
        }

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

        self._validate_period(period)
        self._validate_metric(metric)

        # Verify business exists and get location
        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

        # Single database call for both business and state data
        if metric == 'rating':
            business_data, state_data = await self.review_repository.get_business_and_state_ratings_comparison(
                business_id=business_id,
                state=business.state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )
        else:  # sentiment
            business_data, state_data = await self.review_repository.get_business_and_state_sentiment_comparison(
                business_id=business_id,
                state=business.state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )

        return {
            'business_id': business_id,
            'business_name': business.name,
            'state': business.state,
            'period': period,
            'metric': metric,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'business_data': business_data,
            'state_average': state_data
        }

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

        self._validate_period(period)

        # Get timeline data from repository
        timeline_data = await self.review_repository.get_city_ratings_over_time(
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'city': city,
            'state': state,
            'period': period,
            'metric': 'rating',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

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
       
        self._validate_period(period)

        # Get timeline data from repository
        timeline_data = await self.review_repository.get_state_ratings_over_time(
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'state': state,
            'period': period,
            'metric': 'rating',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }
