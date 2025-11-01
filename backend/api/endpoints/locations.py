"""
Location API endpoints.
Handles requests for states and cities data.
"""
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_async_session
from repositories import business_repository

router = APIRouter(
    tags=["locations"]
)


@router.get("/states", response_model=List[str])
async def get_states(
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get list of all states that have businesses.

    Returns a sorted list of state codes (e.g., ['CA', 'NY', 'PA']).
    """
    states = await business_repository.get_states(db)
    return states


@router.get("/cities", response_model=List[str])
async def get_cities(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'CA')"),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get list of all cities in a specific state.

    Returns a sorted list of city names for the given state.
    """
    cities = await business_repository.get_cities_by_state(db, state.upper())
    return cities
