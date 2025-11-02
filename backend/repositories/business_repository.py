"""
Business repository for database operations.
Pure data access layer - no business logic.
"""
from typing import List, Optional
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from models.business import Business
from repositories.interfaces import BusinessRepositoryInterface


class BusinessRepository(BusinessRepositoryInterface):
    """
    Concrete implementation of business repository.
    Handles all database operations for Business entities.
    """

    def __init__(self, db: AsyncSession):
        """
        Initialize repository with database session.

        Args:
            db: Async database session
        """
        self.db = db

    async def get_by_id(self, business_id: str) -> Optional[Business]:
        """
        Get a single business by ID.

        Args:
            business_id: Unique business identifier

        Returns:
            Business object or None if not found
        """
        result = await self.db.execute(
            select(Business).where(Business.business_id == business_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        """
        Get list of businesses with pagination and optional filtering.

        Args:
            state: Filter by state code (e.g., 'PA', 'CA')
            city: Filter by city name
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return

        Returns:
            List of Business objects
        """
        stmt = select(Business)

        # Apply filters
        if state is not None:
            stmt = stmt.where(Business.state == state)

        if city is not None:
            stmt = stmt.where(Business.city == city)

        # Order by stars and review count for relevance
        stmt = stmt.order_by(Business.stars.desc(), Business.review_count.desc())

        # Apply pagination
        stmt = stmt.offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        limit: int = 1000
    ) -> List[Business]:
        """
        Get businesses within a geographic viewport (bounding box).

        Args:
            south: Southern latitude bound
            north: Northern latitude bound
            west: Western longitude bound
            east: Eastern longitude bound
            limit: Maximum number of businesses to return

        Returns:
            List of Business objects within the viewport
        """
        stmt = (
            select(Business)
            .where(
                and_(
                    Business.latitude >= south,
                    Business.latitude <= north,
                    Business.longitude >= west,
                    Business.longitude <= east
                )
            )
            .order_by(Business.stars.desc(), Business.review_count.desc())
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        """
        Advanced fuzzy search with multi-term support across business data.

        Uses PostgreSQL trigram similarity for:
        - Fuzzy matching (handles typos: "Philadelfia" → "Philadelphia")
        - Multi-term search ("Philadelphia Italian" finds Italian restaurants in Philadelphia)
        - Intelligent relevance ranking

        Each search term contributes to the overall match score across all fields.

        Args:
            query: Search query - can be single or multiple terms
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Business objects ranked by relevance (best matches first)

        Examples:
            "pizza" → finds pizza places
            "Philadelphia Italian" → finds Italian restaurants in Philadelphia
            "Philadelfia restaurant" → fuzzy matches Philadelphia restaurants (handles typo)
        """
        query_clean = query.strip().lower()

        # Split into terms for multi-word search
        terms = query_clean.split()

        # Build conditions for each term across all searchable fields
        conditions = []

        for term in terms:
            term_pattern = f"%{term}%"
            conditions.append(
                or_(
                    Business.name.ilike(term_pattern),
                    Business.city.ilike(term_pattern),
                    Business.state.ilike(term_pattern),
                    Business.categories.ilike(term_pattern),
                    # Fuzzy match using trigram similarity (threshold: 0.3)
                    func.similarity(Business.name, term) > 0.3,
                    func.similarity(Business.city, term) > 0.3,
                    func.similarity(Business.categories, term) > 0.3
                )
            )

        # Combine all term conditions (must match at least one term)
        where_clause = or_(*conditions) if conditions else True

        # Calculate comprehensive relevance score
        # Uses both exact/partial matches AND fuzzy similarity
        relevance_score = (
            # Exact matches (highest priority)
            case(
                (func.lower(Business.name) == query_clean, 100),
                (func.lower(Business.city) == query_clean, 90),
                (func.lower(Business.state) == query_clean, 85),
                else_=0
            )
            # Add fuzzy similarity scores for each field (0-1 range, scaled to 0-50)
            # Using coalesce to handle NULL similarity results
            + (func.coalesce(func.similarity(Business.name, query_clean), 0) * 50)
            + (func.coalesce(func.similarity(Business.city, query_clean), 0) * 40)
            + (func.coalesce(func.similarity(Business.categories, query_clean), 0) * 30)
            # Bonus for partial matches
            + case(
                (Business.name.ilike(f"%{query_clean}%"), 20),
                (Business.city.ilike(f"%{query_clean}%"), 15),
                (Business.categories.ilike(f"%{query_clean}%"), 10),
                else_=0
            )
        )

        stmt = (
            select(Business)
            .where(where_clause)
            .order_by(
                relevance_score.desc(),
                Business.stars.desc(),
                Business.review_count.desc()
            )
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_states(self) -> List[str]:
        """
        Get list of unique states that have businesses.

        Returns:
            List of state codes sorted alphabetically
        """
        stmt = (
            select(Business.state)
            .distinct()
            .order_by(Business.state)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_cities_by_state(self, state: str) -> List[str]:
        """
        Get list of unique cities in a specific state.

        Args:
            state: State code (e.g., 'PA', 'CA')

        Returns:
            List of city names sorted alphabetically
        """
        stmt = (
            select(Business.city)
            .where(Business.state == state)
            .distinct()
            .order_by(Business.city)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
