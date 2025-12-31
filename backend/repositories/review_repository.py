"""
Review repository for database operations with time-series analytics.
Handles SQL aggregations for ratings and sentiment over time.
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import date
from sqlalchemy import select, func, and_, literal, union_all, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from models.review import Review
from models.business import Business
from repositories.interfaces import ReviewRepositoryInterface


class ReviewRepository(ReviewRepositoryInterface):
    """
    Concrete implementation of review repository.
    Handles all database operations for Review entities including time-series aggregations.
    """

    def __init__(self, db: AsyncSession):
        """
        Initialize repository with database session.

        Args:
            db: Async database session
        """
        self.db = db

    def _get_date_trunc_expression(self, period: str):
        """
        Get the appropriate date truncation expression for PostgreSQL.

        Args:
            period: Time period ('day', 'week', 'month', 'year')

        Returns:
            SQLAlchemy expression for date truncation
        """
        valid_periods = {'day', 'week', 'month', 'year'}
        if period not in valid_periods:
            raise ValueError(f"Invalid period: {period}. Must be one of {valid_periods}")

        return func.date_trunc(period, Review.date)

    async def get_by_id(self, review_id: str) -> Optional[Review]:
        """
        Get a single review by ID.

        Args:
            review_id: Unique review identifier

        Returns:
            Review object or None if not found
        """
        result = await self.db.execute(
            select(Review).where(Review.review_id == review_id)
        )
        return result.scalar_one_or_none()

    async def get_by_business(
        self,
        business_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Review]:
        """
        Get reviews for a specific business with pagination.

        Args:
            business_id: Business identifier
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Review objects
        """
        result = await self.db.execute(
            select(Review)
            .where(Review.business_id == business_id)
            .order_by(Review.date.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_business_and_date_range(
        self,
        business_id: str,
        start_date: date,
        end_date: date,
        sentiment_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get reviews for a business within a date range with optional sentiment filter.
        Returns review text and sentiment data for period issue analysis.

        Args:
            business_id: Business identifier
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            sentiment_filter: Optional filter ('negative', 'neutral', 'positive')

        Returns:
            List of dicts with keys: review_id, text, date, stars, sentiment_label, sentiment_score_prob_diff
        """
        query = (
            select(
                Review.review_id,
                Review.text,
                Review.date,
                Review.stars,
                Review.sentiment_label,
                Review.sentiment_score_prob_diff
            )
            .where(
                and_(
                    Review.business_id == business_id,
                    Review.date >= start_date,
                    Review.date <= end_date
                )
            )
        )

        if sentiment_filter and sentiment_filter in ('negative', 'neutral', 'positive'):
            query = query.where(Review.sentiment_label == sentiment_filter)

        query = query.order_by(Review.date.desc())

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'review_id': row.review_id,
                'text': row.text,
                'date': row.date.isoformat() if row.date else None,
                'stars': float(row.stars) if row.stars else 0.0,
                'sentiment_label': row.sentiment_label,
                'sentiment_score_prob_diff': float(row.sentiment_score_prob_diff) if row.sentiment_score_prob_diff else 0.0
            }
            for row in rows
        ]

    async def get_most_recent_year_with_reviews(
        self,
        business_id: str,
        max_years_back: int = 5,
        min_review_count: int = 1
    ) -> Optional[int]:
        """
        Find the most recent year with reviews for a business.

        OPTIMIZED: Single SQL query instead of looping through years.

        Args:
            business_id: Business identifier
            max_years_back: Maximum years to search backwards
            min_review_count: Minimum reviews required for a year to be considered

        Returns:
            Most recent year with sufficient reviews, or None if no data found
        """
        from datetime import datetime

        current_year = datetime.now().year
        min_year = current_year - max_years_back

        query = (
            select(
                func.extract('year', Review.date).label('year'),
                func.count(Review.review_id).label('review_count')
            )
            .where(
                and_(
                    Review.business_id == business_id,
                    Review.date >= date(min_year, 1, 1)
                )
            )
            .group_by(func.extract('year', Review.date))
            .having(func.count(Review.review_id) >= min_review_count)
            .order_by(func.extract('year', Review.date).desc())
            .limit(1)
        )

        result = await self.db.execute(query)
        row = result.first()

        return int(row.year) if row else None

    async def get_business_ratings_over_time(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for a specific business.
        Uses SQL aggregation with GROUP BY date period.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Build query with filters
        query = (
            select(
                period_col,
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count')
            )
            .where(Review.business_id == business_id)
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count)
            }
            for row in rows
        ]

    async def get_business_sentiment_over_time(
        self,
        business_id: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for a specific business.
        Uses SQL aggregation with GROUP BY date period.

        Args:
            business_id: Business identifier
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, avg_sentiment_expected, review_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Build query with filters
        query = (
            select(
                period_col,
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count')
            )
            .where(Review.business_id == business_id)
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count)
            }
            for row in rows
        ]

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
        Joins reviews with businesses table, filters by city/state, aggregates by date period.
        Uses case-insensitive comparison for city and state to ensure consistent results.

        Args:
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Normalize inputs: trim whitespace and handle case-insensitivity
        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        # Build query with JOIN to businesses table
        # Use ILIKE for case-insensitive comparison in PostgreSQL
        query = (
            select(
                period_col,
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(
                and_(
                    func.lower(Business.city) == func.lower(normalized_city),
                    func.lower(Business.state) == func.lower(normalized_state)
                )
            )
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]

    async def get_state_ratings_over_time(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for all businesses in a state.
        Joins reviews with businesses table, filters by state, aggregates by date period.
        Uses case-insensitive comparison for state to ensure consistent results.

        Args:
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Normalize state: trim whitespace and handle case-insensitivity
        normalized_state = state.strip().upper()

        # Build query with JOIN to businesses table
        # Use case-insensitive comparison for state
        query = (
            select(
                period_col,
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(func.lower(Business.state) == func.lower(normalized_state))
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]

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
        Joins reviews with businesses table, filters by city/state, aggregates by date period.
        Uses case-insensitive comparison for city and state to ensure consistent results.

        Args:
            city: City name
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Normalize inputs: trim whitespace and handle case-insensitivity
        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        # Build query with JOIN to businesses table
        # Use case-insensitive comparison for city and state
        query = (
            select(
                period_col,
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(
                and_(
                    func.lower(Business.city) == func.lower(normalized_city),
                    func.lower(Business.state) == func.lower(normalized_state)
                )
            )
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]

    async def get_state_sentiment_over_time(
        self,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for all businesses in a state.
        Joins reviews with businesses table, filters by state, aggregates by date period.
        Uses case-insensitive comparison for state to ensure consistent results.

        Args:
            state: State code
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Normalize state: trim whitespace and handle case-insensitivity
        normalized_state = state.strip().upper()

        # Build query with JOIN to businesses table
        # Use case-insensitive comparison for state
        query = (
            select(
                period_col,
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(func.lower(Business.state) == func.lower(normalized_state))
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]


    async def get_business_and_city_ratings_comparison(
        self,
        business_id: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Get business and city ratings in a SINGLE query using UNION ALL.

        Returns:
            Tuple of (business_data, city_data)
        """
        # consistent period expression for both queries
        period_expr = func.date_trunc(period, Review.date)

        # Business query - business_count is always 1 for single business
        business_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                literal(1).label('business_count'),  
                literal('business').label('data_type')
            )
            .where(Review.business_id == business_id)
        )

        # Normalize city/state for case-insensitive comparison
        normalized_city = city.strip()
        normalized_state = state.strip().upper()

        # City query with JOIN - counts distinct businesses
        # Use case-insensitive comparison for city and state
        city_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count'),
                literal('city').label('data_type')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(and_(
                func.lower(Business.city) == func.lower(normalized_city),
                func.lower(Business.state) == func.lower(normalized_state)
            ))
        )

        # Apply date filters to both
        if start_date:
            business_query = business_query.where(Review.date >= start_date)
            city_query = city_query.where(Review.date >= start_date)
        if end_date:
            business_query = business_query.where(Review.date <= end_date)
            city_query = city_query.where(Review.date <= end_date)

        # Combine with UNION ALL - SINGLE database call!
        # Use column(0) to reference first column for ordering
        combined_query = union_all(
            business_query.group_by(period_expr),
            city_query.group_by(period_expr)
        ).order_by(literal_column('period_start'))

        # Execute single query
        result = await self.db.execute(combined_query)
        rows = result.all()

        # Separate results by data_type
        business_data = []
        city_data = []

        for row in rows:
            data_point = {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)  
            }

            if row.data_type == 'business':
                business_data.append(data_point)
            else:
                city_data.append(data_point)

        return business_data, city_data

    async def get_business_and_state_ratings_comparison(
        self,
        business_id: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Get business and state ratings in a SINGLE query with case-insensitive state matching."""

        # Use consistent period expression
        period_expr = func.date_trunc(period, Review.date)

        # Normalize state for case-insensitive comparison
        normalized_state = state.strip().upper()

        business_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                literal(1).label('business_count'),
                literal('business').label('data_type')
            )
            .where(Review.business_id == business_id)
        )

        state_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count'),
                literal('state').label('data_type')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(func.lower(Business.state) == func.lower(normalized_state))
        )

        if start_date:
            business_query = business_query.where(Review.date >= start_date)
            state_query = state_query.where(Review.date >= start_date)
        if end_date:
            business_query = business_query.where(Review.date <= end_date)
            state_query = state_query.where(Review.date <= end_date)

        #  Use literal_column for ORDER BY
        combined_query = union_all(
            business_query.group_by(period_expr),
            state_query.group_by(period_expr)
        ).order_by(literal_column('period_start'))

        result = await self.db.execute(combined_query)
        rows = result.all()

        business_data = []
        state_data = []

        for row in rows:
            data_point = {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)  # FIX #1: Include in response
            }
            if row.data_type == 'business':
                business_data.append(data_point)
            else:
                state_data.append(data_point)

        return business_data, state_data

    async def get_business_and_city_sentiment_comparison(
        self,
        business_id: str,
        city: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Get business and city sentiment in a SINGLE query."""
        # Use consistent period expression
        period_expr = func.date_trunc(period, Review.date)

        business_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                literal(1).label('business_count'),  # FIX #1: Added business_count
                literal('business').label('data_type')
            )
            .where(Review.business_id == business_id)
        )

        city_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count'),  # FIX #1: Added business_count
                literal('city').label('data_type')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(and_(Business.city == city, Business.state == state))
        )

        if start_date:
            business_query = business_query.where(Review.date >= start_date)
            city_query = city_query.where(Review.date >= start_date)
        if end_date:
            business_query = business_query.where(Review.date <= end_date)
            city_query = city_query.where(Review.date <= end_date)

        # Use literal_column for ORDER BY
        combined_query = union_all(
            business_query.group_by(period_expr),
            city_query.group_by(period_expr)
        ).order_by(literal_column('period_start'))

        result = await self.db.execute(combined_query)
        rows = result.all()

        business_data = []
        city_data = []

        for row in rows:
            data_point = {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)  # FIX #1: Include in response
            }
            if row.data_type == 'business':
                business_data.append(data_point)
            else:
                city_data.append(data_point)

        return business_data, city_data

    async def get_business_and_state_sentiment_comparison(
        self,
        business_id: str,
        state: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Get business and state sentiment in a SINGLE query."""
        # Use consistent period expression
        period_expr = func.date_trunc(period, Review.date)

        business_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                literal(1).label('business_count'), 
                literal('business').label('data_type')
            )
            .where(Review.business_id == business_id)
        )

        state_query = (
            select(
                period_expr.label('period_start'),
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count'),  
                literal('state').label('data_type')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(Business.state == state)
        )

        if start_date:
            business_query = business_query.where(Review.date >= start_date)
            state_query = state_query.where(Review.date >= start_date)
        if end_date:
            business_query = business_query.where(Review.date <= end_date)
            state_query = state_query.where(Review.date <= end_date)

        # Use literal_column for ORDER BY
        combined_query = union_all(
            business_query.group_by(period_expr),
            state_query.group_by(period_expr)
        ).order_by(literal_column('period_start'))

        result = await self.db.execute(combined_query)
        rows = result.all()

        business_data = []
        state_data = []

        for row in rows:
            data_point = {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            if row.data_type == 'business':
                business_data.append(data_point)
            else:
                state_data.append(data_point)

        return business_data, state_data

    async def get_category_ratings_over_time(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average ratings over time for all businesses in a category.
        Joins reviews with businesses table, filters by category, aggregates by date period.
        Uses case-insensitive comparison for category to ensure consistent results.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_rating, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Build query with JOIN to businesses table
        # Use case-insensitive comparison for category
        query = (
            select(
                period_col,
                func.avg(Review.stars).label('avg_rating'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(Business.categories.ilike(f'%{category}%'))
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_rating': float(row.avg_rating) if row.avg_rating else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]

    async def get_category_sentiment_over_time(
        self,
        category: str,
        period: str = 'month',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get average sentiment scores over time for all businesses in a category.
        Joins reviews with businesses table, filters by category, aggregates by date period.
        Uses case-insensitive comparison for category to ensure consistent results.

        Args:
            category: Category name
            period: Time period for aggregation ('day', 'week', 'month', 'year')
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of dicts with keys: period_start, avg_sentiment_score, avg_sentiment_expected, review_count, business_count
        """
        period_col = self._get_date_trunc_expression(period).label('period_start')

        # Build query with JOIN to businesses table
        # Use case-insensitive comparison for category
        query = (
            select(
                period_col,
                func.avg(Review.sentiment_score_prob_diff).label('avg_sentiment_score'),
                func.avg(Review.sentiment_score_expected).label('avg_sentiment_expected'),
                func.count(Review.review_id).label('review_count'),
                func.count(func.distinct(Review.business_id)).label('business_count')
            )
            .join(Business, Review.business_id == Business.business_id)
            .where(Business.categories.ilike(f'%{category}%'))
        )

        # Apply date filters if provided
        if start_date:
            query = query.where(Review.date >= start_date)
        if end_date:
            query = query.where(Review.date <= end_date)

        # Group by period and order chronologically
        query = query.group_by(period_col).order_by(period_col)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                'period_start': row.period_start.isoformat() if row.period_start else None,
                'avg_sentiment_score': float(row.avg_sentiment_score) if row.avg_sentiment_score else 0.0,
                'avg_sentiment_expected': float(row.avg_sentiment_expected) if row.avg_sentiment_expected else 0.0,
                'review_count': int(row.review_count),
                'business_count': int(row.business_count)
            }
            for row in rows
        ]
