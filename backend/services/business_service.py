"""
Business service layer.
Contains business logic, validation, and orchestration between controller and repository.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException, status

from models.business import Business
from repositories.interfaces import BusinessRepositoryInterface
from services.interfaces import BusinessServiceInterface


def is_business_currently_open(hours: Optional[dict]) -> int:
    """
    Calculate if a business is currently open based on its operating hours.

    Args:
        hours: Dictionary with day names as keys and time ranges as values.
               Example: {"Monday": "7:0-20:0", "Tuesday": "7:0-20:0", ...}

    Returns:
        1 if business is currently open, 0 if closed or hours are unavailable.
    """
    if not hours:
        return 1

    try:
        current_time = datetime.now()
        day_name = current_time.strftime("%A")
        current_hour = current_time.hour
        current_minute = current_time.minute

        if day_name not in hours:
            return 0

        time_range = hours[day_name]

        if not time_range or time_range.strip() == "":
            return 0

        parts = time_range.split("-")
        if len(parts) != 2:
            return 1

        opening_str, closing_str = parts

        opening_time = opening_str.split(":")
        closing_time = closing_str.split(":")

        if len(opening_time) < 2 or len(closing_time) < 2:
            return 1

        opening_hour = int(opening_time[0])
        opening_minute = int(opening_time[1])
        closing_hour = int(closing_time[0])
        closing_minute = int(closing_time[1])

        current_minutes = current_hour * 60 + current_minute
        opening_minutes = opening_hour * 60 + opening_minute
        closing_minutes = closing_hour * 60 + closing_minute

        if opening_minutes <= current_minutes < closing_minutes:
            return 1
        else:
            return 0

    except (ValueError, KeyError, TypeError, AttributeError):
        return 1


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

        business.is_open = is_business_currently_open(business.hours)
        return business

    async def get_businesses(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        normalized_state = state.upper() if state else None

        businesses = await self.business_repository.get_all(
            state=normalized_state,
            city=city,
            skip=skip,
            limit=limit
        )

        for business in businesses:
            business.is_open = is_business_currently_open(business.hours)

        return businesses

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

        normalized_state = state.upper() if state else None

        businesses = await self.business_repository.get_in_viewport(
            south=south,
            north=north,
            west=west,
            east=east,
            state=normalized_state,
            city=city,
            neighborhood=neighborhood,
            category=category,
            min_rating=min_rating,
            is_open=None,
            limit=limit
        )

        for business in businesses:
            business.is_open = is_business_currently_open(business.hours)

        if is_open is not None:
            businesses = [b for b in businesses if b.is_open == is_open]

        return businesses

    async def search_businesses(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        businesses = await self.business_repository.search(
            query=query,
            skip=skip,
            limit=limit
        )

        for business in businesses:
            business.is_open = is_business_currently_open(business.hours)

        return businesses
