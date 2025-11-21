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

    def __init__(self, business_repository: BusinessRepositoryInterface):
        self.business_repository = business_repository

    async def get_business_by_id(self, business_id: str) -> Business:
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
        state: Optional[str] = None,
        city: Optional[str] = None,
        neighborhood: Optional[str] = None,
        category: Optional[str] = None,
        min_rating: Optional[float] = None,
        is_open: Optional[int] = None,
        limit: int = 1000
    ) -> List[Business]:
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

        # Normalize state to uppercase
        normalized_state = state.upper() if state else None

        return await self.business_repository.get_in_viewport(
            south=south,
            north=north,
            west=west,
            east=east,
            state=normalized_state,
            city=city,
            neighborhood=neighborhood,
            category=category,
            min_rating=min_rating,
            is_open=is_open,
            limit=limit
        )

    async def search_businesses(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        return await self.business_repository.search(
            query=query,
            skip=skip,
            limit=limit
        )
