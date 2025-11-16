"""
Repository for accessing pre-computed metrics.
Fast queries with no real-time aggregation.
"""
from typing import List, Dict, Any, Optional
from datetime import date as date_type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from models.metrics import (
    BusinessTimelineMetrics,
    CityTimelineMetrics,
    StateTimelineMetrics,
    CityCategoryTimelineMetrics,
    StateCategoryTimelineMetrics
)
from models.business import Business


class MetricsRepository:
    """Fast repository using pre-computed metrics"""

    @staticmethod
    async def get_business_ratings_timeline(
        db: AsyncSession,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed ratings timeline for a business"""
        query = select(BusinessTimelineMetrics).where(
            and_(
                BusinessTimelineMetrics.business_id == business_id,
                BusinessTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(BusinessTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(BusinessTimelineMetrics.period_start <= end_date)

        query = query.order_by(BusinessTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_rating': metric.avg_rating,
                'review_count': metric.review_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_business_sentiment_timeline(
        db: AsyncSession,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed sentiment timeline for a business"""
        query = select(BusinessTimelineMetrics).where(
            and_(
                BusinessTimelineMetrics.business_id == business_id,
                BusinessTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(BusinessTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(BusinessTimelineMetrics.period_start <= end_date)

        query = query.order_by(BusinessTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_sentiment_score': metric.avg_sentiment_score,
                'avg_sentiment_expected': metric.avg_sentiment_expected,
                'review_count': metric.review_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_city_ratings_timeline(
        db: AsyncSession,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed ratings timeline for a city"""
        query = select(CityTimelineMetrics).where(
            and_(
                CityTimelineMetrics.city.ilike(city),
                CityTimelineMetrics.state == state.upper(),
                CityTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(CityTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(CityTimelineMetrics.period_start <= end_date)

        query = query.order_by(CityTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_rating': metric.avg_rating,
                'review_count': metric.review_count,
                'business_count': metric.business_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_city_sentiment_timeline(
        db: AsyncSession,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed sentiment timeline for a city"""
        query = select(CityTimelineMetrics).where(
            and_(
                CityTimelineMetrics.city.ilike(city),
                CityTimelineMetrics.state == state.upper(),
                CityTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(CityTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(CityTimelineMetrics.period_start <= end_date)

        query = query.order_by(CityTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_sentiment_score': metric.avg_sentiment_score,
                'avg_sentiment_expected': metric.avg_sentiment_expected,
                'review_count': metric.review_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_state_ratings_timeline(
        db: AsyncSession,
        state: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed ratings timeline for a state"""
        query = select(StateTimelineMetrics).where(
            and_(
                StateTimelineMetrics.state == state.upper(),
                StateTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(StateTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(StateTimelineMetrics.period_start <= end_date)

        query = query.order_by(StateTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_rating': metric.avg_rating,
                'review_count': metric.review_count,
                'business_count': metric.business_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_state_sentiment_timeline(
        db: AsyncSession,
        state: str,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed sentiment timeline for a state"""
        query = select(StateTimelineMetrics).where(
            and_(
                StateTimelineMetrics.state == state.upper(),
                StateTimelineMetrics.period_type == period
            )
        )

        if start_date:
            query = query.where(StateTimelineMetrics.period_start >= start_date)
        if end_date:
            query = query.where(StateTimelineMetrics.period_start <= end_date)

        query = query.order_by(StateTimelineMetrics.period_start)

        result = await db.execute(query)
        metrics = result.scalars().all()

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_sentiment_score': metric.avg_sentiment_score,
                'avg_sentiment_expected': metric.avg_sentiment_expected,
                'review_count': metric.review_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_category_ratings_timeline(
        db: AsyncSession,
        category: str,
        city: Optional[str] = None,
        state: Optional[str] = None,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed ratings timeline for a category (optionally filtered by city/state)"""

        # If city is provided, use city+category metrics
        if city and state:
            query = select(CityCategoryTimelineMetrics).where(
                and_(
                    CityCategoryTimelineMetrics.city.ilike(city),
                    CityCategoryTimelineMetrics.state == state.upper(),
                    CityCategoryTimelineMetrics.category.ilike(f'%{category}%'),
                    CityCategoryTimelineMetrics.period_type == period
                )
            )

            if start_date:
                query = query.where(CityCategoryTimelineMetrics.period_start >= start_date)
            if end_date:
                query = query.where(CityCategoryTimelineMetrics.period_start <= end_date)

            query = query.order_by(CityCategoryTimelineMetrics.period_start)

            result = await db.execute(query)
            metrics = result.scalars().all()

        # If only state, use state+category metrics
        elif state:
            query = select(StateCategoryTimelineMetrics).where(
                and_(
                    StateCategoryTimelineMetrics.state == state.upper(),
                    StateCategoryTimelineMetrics.category.ilike(f'%{category}%'),
                    StateCategoryTimelineMetrics.period_type == period
                )
            )

            if start_date:
                query = query.where(StateCategoryTimelineMetrics.period_start >= start_date)
            if end_date:
                query = query.where(StateCategoryTimelineMetrics.period_start <= end_date)

            query = query.order_by(StateCategoryTimelineMetrics.period_start)

            result = await db.execute(query)
            metrics = result.scalars().all()

        else:
            # No city or state filter - return empty (or could aggregate all states)
            return []

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_rating': metric.avg_rating,
                'review_count': metric.review_count,
                'business_count': metric.business_count
            }
            for metric in metrics
        ]

    @staticmethod
    async def get_category_sentiment_timeline(
        db: AsyncSession,
        category: str,
        city: Optional[str] = None,
        state: Optional[str] = None,
        period: str = 'month',
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None
    ) -> List[Dict[str, Any]]:
        """Get pre-computed sentiment timeline for a category (optionally filtered by city/state)"""

        if city and state:
            query = select(CityCategoryTimelineMetrics).where(
                and_(
                    CityCategoryTimelineMetrics.city.ilike(city),
                    CityCategoryTimelineMetrics.state == state.upper(),
                    CityCategoryTimelineMetrics.category.ilike(f'%{category}%'),
                    CityCategoryTimelineMetrics.period_type == period
                )
            )

            if start_date:
                query = query.where(CityCategoryTimelineMetrics.period_start >= start_date)
            if end_date:
                query = query.where(CityCategoryTimelineMetrics.period_start <= end_date)

            query = query.order_by(CityCategoryTimelineMetrics.period_start)

            result = await db.execute(query)
            metrics = result.scalars().all()

        elif state:
            query = select(StateCategoryTimelineMetrics).where(
                and_(
                    StateCategoryTimelineMetrics.state == state.upper(),
                    StateCategoryTimelineMetrics.category.ilike(f'%{category}%'),
                    StateCategoryTimelineMetrics.period_type == period
                )
            )

            if start_date:
                query = query.where(StateCategoryTimelineMetrics.period_start >= start_date)
            if end_date:
                query = query.where(StateCategoryTimelineMetrics.period_start <= end_date)

            query = query.order_by(StateCategoryTimelineMetrics.period_start)

            result = await db.execute(query)
            metrics = result.scalars().all()

        else:
            return []

        return [
            {
                'period_start': metric.period_start.isoformat(),
                'avg_sentiment_score': metric.avg_sentiment_score,
                'avg_sentiment_expected': metric.avg_sentiment_expected,
                'review_count': metric.review_count
            }
            for metric in metrics
        ]
