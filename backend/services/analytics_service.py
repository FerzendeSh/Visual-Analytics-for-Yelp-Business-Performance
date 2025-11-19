"""
Analytics service layer for time-series data.
Orchestrates repository calls, combines data, and formats for API responses.
"""
from typing import Dict, Any, Optional
from datetime import date
from fastapi import HTTPException, status

from repositories.interfaces import ReviewRepositoryInterface, BusinessRepositoryInterface
from repositories.metrics_repository import MetricsRepository
from services.interfaces import AnalyticsServiceInterface
from sqlalchemy.ext.asyncio import AsyncSession


class AnalyticsService(AnalyticsServiceInterface):
    """
    Concrete implementation of analytics service.
    Handles business logic for time-series analytics and comparisons.
    Uses pre-computed metrics for fast queries.
    """

    def __init__(
        self,
        review_repository: ReviewRepositoryInterface,
        business_repository: BusinessRepositoryInterface,
        db: AsyncSession = None
    ):
        """
        Initialize service with repository dependencies.

        Args:
            review_repository: Repository for review data access (legacy)
            business_repository: Repository for business data access
            db: Database session for metrics repository
        """
        self.review_repository = review_repository
        self.business_repository = business_repository
        self.db = db
        self.metrics_repo = MetricsRepository()

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

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_business_ratings_timeline(
            db=self.db,
            business_id=business_id,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_id': business_id,
            'business_name': business.name,
            'city': business.city,
            'state': business.state,
            'categories': business.categories,
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

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_business_sentiment_timeline(
            db=self.db,
            business_id=business_id,
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
        Normalizes city/state inputs to ensure consistent results across queries.

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

        # Normalize inputs: trim whitespace and uppercase state for consistency
        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_city_ratings_timeline(
            db=self.db,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'city': normalized_city,
            'state': normalized_state,
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
        timeline_data = await self.metrics_repo.get_state_ratings_timeline(
            db=self.db,
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
        self._validate_period(period)

        # Normalize city and state if provided
        normalized_city = city.strip() if city else None
        normalized_state = state.strip().upper() if state else None

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        # If city/state provided, gets city-specific category data
        timeline_data = await self.metrics_repo.get_category_ratings_timeline(
            db=self.db,
            category=category,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'category': category,
            'city': normalized_city,
            'state': normalized_state,
            'period': period,
            'metric': 'rating',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

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
        self._validate_period(period)

        # Normalize city and state if provided
        normalized_city = city.strip() if city else None
        normalized_state = state.strip().upper() if state else None

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        # If city/state provided, gets city-specific category data
        timeline_data = await self.metrics_repo.get_category_sentiment_timeline(
            db=self.db,
            category=category,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'category': category,
            'city': normalized_city,
            'state': normalized_state,
            'period': period,
            'metric': 'sentiment',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

    async def get_city_sentiment_timeline(
        self,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a city.
        Normalizes city/state inputs to ensure consistent results across queries.

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

        # Normalize inputs: trim whitespace and uppercase state for consistency
        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_city_sentiment_timeline(
            db=self.db,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'city': normalized_city,
            'state': normalized_state,
            'period': period,
            'metric': 'sentiment',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

    async def get_state_sentiment_timeline(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get sentiment timeline for a state.

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
        timeline_data = await self.metrics_repo.get_state_sentiment_timeline(
            db=self.db,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'state': state,
            'period': period,
            'metric': 'sentiment',
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'data': timeline_data
        }

    async def get_competitive_snapshot(
        self,
        city: Optional[str] = None,
        state: Optional[str] = None,
        category: Optional[str] = None,
        business_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get competitive positioning snapshot for a market.

        Returns all businesses in the specified market (city/category) with
        pre-calculated statistics for competitive analysis visualization.

        Args:
            city: City name (optional)
            state: State code (optional, recommended with city)
            category: Category name (optional)
            business_id: Specific business to highlight (optional)

        Returns:
            Dict with businesses and market statistics
        """
        from sqlalchemy import select, func
        from models.business import Business

        # Build query with filters
        stmt = select(Business)

        if state:
            normalized_state = state.strip().upper()
            stmt = stmt.where(Business.state == normalized_state)

        if city:
            normalized_city = city.strip()
            stmt = stmt.where(Business.city == normalized_city)

        if category:
            stmt = stmt.where(Business.categories.ilike(f'%{category}%'))

        # Order by rating and review count for relevance
        stmt = stmt.order_by(Business.stars.desc(), Business.review_count.desc())

        # Limit to 5000 businesses for performance
        stmt = stmt.limit(5000)

        # Execute query
        result = await self.db.execute(stmt)
        businesses = list(result.scalars().all())

        # Calculate statistics
        if not businesses:
            return {
                'businesses': [],
                'statistics': {
                    'avg_rating': 0,
                    'median_review_count': 0,
                    'total_businesses': 0
                },
                'selected_business': None,
                'filters': {
                    'city': city,
                    'state': state,
                    'category': category
                }
            }

        # Calculate avg rating
        ratings = [b.stars for b in businesses if b.stars is not None]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0

        # Calculate median review count
        review_counts = sorted([b.review_count for b in businesses if b.review_count is not None])
        median_review_count = review_counts[len(review_counts) // 2] if review_counts else 0

        # Format business data for response
        business_data = []
        selected_business_data = None

        for b in businesses:
            formatted = {
                'business_id': b.business_id,
                'name': b.name,
                'stars': b.stars,
                'review_count': b.review_count,
                'city': b.city,
                'state': b.state,
                'categories': b.categories,
                'is_open': b.is_open,
                'latitude': b.latitude,
                'longitude': b.longitude
            }
            business_data.append(formatted)

            if business_id and b.business_id == business_id:
                selected_business_data = formatted

        return {
            'businesses': business_data,
            'statistics': {
                'avg_rating': round(avg_rating, 2),
                'median_review_count': median_review_count,
                'total_businesses': len(businesses)
            },
            'selected_business': selected_business_data,
            'filters': {
                'city': city,
                'state': state,
                'category': category
            }
        }
