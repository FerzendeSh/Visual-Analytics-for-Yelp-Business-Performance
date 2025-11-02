"""
Business service layer.
Contains business logic, validation, and orchestration between controller and repository.
"""
from typing import List, Optional
from fastapi import HTTPException, status

from models.business import Business
from repositories.interfaces import BusinessRepositoryInterface
from services.interfaces import BusinessServiceInterface


class BusinessService(BusinessServiceInterface):
    """
    Concrete implementation of business service.
    Handles business logic and coordinates with repository layer.
    """

    def __init__(self, business_repository: BusinessRepositoryInterface):
        """
        Initialize service with repository dependency.

        Args:
            business_repository: Repository for business data access
        """
        self.business_repository = business_repository

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
        business = await self.business_repository.get_by_id(business_id)

        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found"
            )

        return business

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
            state: Filter by state code (e.g., 'PA', 'CA') - will be normalized to uppercase
            city: Filter by city name
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Business objects
        """
        normalized_state = state.upper() if state else None

        return await self.business_repository.get_all(
            state=normalized_state,
            city=city,
            skip=skip,
            limit=limit
        )

    async def get_businesses_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        limit: int = 1000
    ) -> List[Business]:
        """
        Get businesses within a geographic viewport (bounding box).

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
        if south >= north:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="South latitude must be less than north latitude"
            )

        if west >= east:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="West longitude must be less than east longitude"
            )

        return await self.business_repository.get_in_viewport(
            south=south,
            north=north,
            west=west,
            east=east,
            limit=limit
        )

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
        return await self.business_repository.search(
            query=query,
            skip=skip,
            limit=limit
        )
