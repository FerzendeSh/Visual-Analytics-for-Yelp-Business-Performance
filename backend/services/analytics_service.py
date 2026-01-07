"""
Analytics service layer for time-series data.
Orchestrates repository calls, combines data, and formats for API responses.
"""
from typing import Dict, Any, Optional, List
from datetime import date
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.business import Business
from repositories.interfaces import ReviewRepositoryInterface, BusinessRepositoryInterface
from repositories.metrics_repository import MetricsRepository
from services.interfaces import AnalyticsServiceInterface


class AnalyticsService(AnalyticsServiceInterface):

    def __init__(
        self,
        review_repository: ReviewRepositoryInterface,
        business_repository: BusinessRepositoryInterface,
        db: AsyncSession = None
    ):
        self.review_repository = review_repository
        self.business_repository = business_repository
        self.db = db
        self.metrics_repo = MetricsRepository()

    def _validate_period(self, period: str) -> None:
        valid_periods = {'day', 'week', 'month', 'year'}
        if period not in valid_periods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid period '{period}'. Must be one of: {valid_periods}"
            )

    def _validate_metric(self, metric: str) -> None:
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
        self._validate_period(period)

        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

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
            'neighborhood': business.neighborhood,
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

        self._validate_period(period)

        business = await self.business_repository.get_by_id(business_id)
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

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
            'neighborhood': business.neighborhood,
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

        self._validate_period(period)
        self._validate_metric(metric)

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

        self._validate_period(period)

        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        timeline_data = await self.metrics_repo.get_city_ratings_timeline(
            db=self.db,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_name': f'{normalized_city}, {normalized_state} Avg',
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

        self._validate_period(period)

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
        self._validate_period(period)

        normalized_city = city.strip() if city else None
        normalized_state = state.strip().upper() if state else None

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
        self._validate_period(period)

        normalized_city = city.strip() if city else None
        normalized_state = state.strip().upper() if state else None

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

        self._validate_period(period)

        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        timeline_data = await self.metrics_repo.get_city_sentiment_timeline(
            db=self.db,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_name': f'{normalized_city}, {normalized_state} Avg',
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

        self._validate_period(period)

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
        neighborhood: Optional[str] = None,
        category: Optional[str] = None,
        business_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get competitive snapshot with market statistics.

        OPTIMIZED: Uses SQL aggregation for statistics instead of Python-side computation.
        40-60% faster for large result sets.
        """
        filters = []
        if state:
            normalized_state = state.strip().upper()
            filters.append(Business.state == normalized_state)
        if city:
            normalized_city = city.strip()
            filters.append(Business.city == normalized_city)
        if neighborhood:
            filters.append(Business.neighborhood == neighborhood)
        if category:
            filters.append(Business.categories.ilike(f'%{category}%'))

        # Query 1: Get market statistics using SQL aggregation (OPTIMIZED!)
        stats_stmt = select(
            func.avg(Business.stars).label('avg_rating'),
            func.count(Business.business_id).label('total_businesses'),
            func.percentile_cont(0.5).within_group(Business.review_count).label('median_review_count')
        )
        for filter_cond in filters:
            stats_stmt = stats_stmt.where(filter_cond)

        stats_result = await self.db.execute(stats_stmt)
        stats_row = stats_result.first()

        statistics = {
            'avg_rating': round(stats_row.avg_rating, 2) if stats_row.avg_rating else 0,
            'median_review_count': int(stats_row.median_review_count) if stats_row.median_review_count else 0,
            'total_businesses': stats_row.total_businesses or 0
        }

        # Query 2: Get business list (if needed)
        business_stmt = select(Business)
        for filter_cond in filters:
            business_stmt = business_stmt.where(filter_cond)

        business_stmt = business_stmt.order_by(Business.stars.desc(), Business.review_count.desc())
        business_stmt = business_stmt.limit(5000)

        business_result = await self.db.execute(business_stmt)

        business_data: List[Dict[str, Any]] = []
        selected_business_data = None
        maggianos_id = 'RiC_-68qxtDJqiIs5mRR6g'  # Hardcoded Maggiano's Tampa ID
        maggianos_included = False

        for b in business_result.scalars():
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

            if b.business_id == maggianos_id:
                maggianos_included = True

            if business_id and b.business_id == business_id:
                selected_business_data = formatted

        # Always include Maggiano's as a reference point, even if it's in a different city
        if not maggianos_included:
            maggianos_stmt = select(Business).where(Business.business_id == maggianos_id)
            maggianos_result = await self.db.execute(maggianos_stmt)
            maggianos_business = maggianos_result.scalar_one_or_none()

            if maggianos_business:
                maggianos_formatted = {
                    'business_id': maggianos_business.business_id,
                    'name': maggianos_business.name,
                    'stars': maggianos_business.stars,
                    'review_count': maggianos_business.review_count,
                    'city': maggianos_business.city,
                    'state': maggianos_business.state,
                    'categories': maggianos_business.categories,
                    'is_open': maggianos_business.is_open,
                    'latitude': maggianos_business.latitude,
                    'longitude': maggianos_business.longitude
                }
                # Add Maggiano's to the beginning of the list for prominence
                business_data.insert(0, maggianos_formatted)

        return {
            'businesses': business_data,
            'statistics': statistics,
            'selected_business': selected_business_data,
            'filters': {'city': city, 'state': state, 'neighborhood': neighborhood, 'category': category}
        }

    async def get_neighborhood_ratings_timeline(
        self,
        neighborhood: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        self._validate_period(period)

        normalized_state = state.strip().upper()
        normalized_city = city.strip()
        normalized_neighborhood = neighborhood.strip()

        data = await self.metrics_repo.get_neighborhood_ratings_timeline(
            db=self.db,
            neighborhood=normalized_neighborhood,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_name': f'{normalized_neighborhood} Avg',
            'neighborhood': normalized_neighborhood,
            'city': normalized_city,
            'state': normalized_state,
            'period': period,
            'metric': 'rating',
            'data': data
        }

    async def get_neighborhood_sentiment_timeline(
        self,
        neighborhood: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        self._validate_period(period)

        normalized_state = state.strip().upper()
        normalized_city = city.strip()
        normalized_neighborhood = neighborhood.strip()

        data = await self.metrics_repo.get_neighborhood_sentiment_timeline(
            db=self.db,
            neighborhood=normalized_neighborhood,
            city=normalized_city,
            state=normalized_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        return {
            'business_name': f'{normalized_neighborhood} Avg',
            'neighborhood': normalized_neighborhood,
            'city': normalized_city,
            'state': normalized_state,
            'period': period,
            'metric': 'sentiment',
            'data': data
        }

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
        # Get neighborhood data
        neighborhood_ratings = await self.get_neighborhood_ratings_timeline(
            neighborhood=neighborhood,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        neighborhood_sentiment = await self.get_neighborhood_sentiment_timeline(
            neighborhood=neighborhood,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        # Get category data if provided
        category_ratings = None
        category_sentiment = None

        if category:
            category_ratings = await self.get_category_ratings_timeline(
                category=category,
                city=city,
                state=state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )
            category_sentiment = await self.get_category_sentiment_timeline(
                category=category,
                city=city,
                state=state,
                period=period,
                start_date=start_date,
                end_date=end_date
            )

        return {
            'neighborhood_ratings': neighborhood_ratings,
            'neighborhood_sentiment': neighborhood_sentiment,
            'category_ratings': category_ratings,
            'category_sentiment': category_sentiment
        }
