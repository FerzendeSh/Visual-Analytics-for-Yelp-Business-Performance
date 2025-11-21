"""
Location API endpoints.
Handles requests for states and cities data.
"""
from typing import List, Dict, Any
import json
import os
from pathlib import Path
from fastapi import APIRouter, Depends, Query, HTTPException
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


@router.get("/neighborhoods", response_model=List[str])
async def get_neighborhoods(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'CA')"),
    city: str = Query(..., min_length=1, description="City name"),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get list of all neighborhoods in a specific city.

    Returns a sorted list of neighborhood names for the given city.
    """
    neighborhoods = await business_repository.get_neighborhoods_by_city(db, state.upper(), city)
    return neighborhoods


@router.get("/neighborhoods/boundaries")
async def get_neighborhood_boundaries(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'CA')"),
    city: str = Query(..., min_length=1, description="City name"),
):
    """
    Get GeoJSON boundaries for neighborhoods in a specific city.

    Returns a GeoJSON FeatureCollection with neighborhood boundaries if available.
    """
    # Construct the path to the neighborhood geojson file in public directory
    city_state_key = f"{city.lower().replace(' ', '_')}_{state.lower()}"
    geojson_path = Path(__file__).parent.parent.parent / "public" / "neighborhoods" / f"{city_state_key}.geojson"

    if not geojson_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Neighborhood boundaries not available for {city}, {state}"
        )

    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        return geojson_data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading neighborhood boundaries: {str(e)}"
        )


@router.get("/cities/boundaries")
async def get_city_boundaries(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'CA')"),
    city: str = Query(..., min_length=1, description="City name"),
):
    """
    Get GeoJSON boundary for an entire city.

    Returns a GeoJSON FeatureCollection with the city boundary polygon.
    """
    # Construct the path to the city boundary geojson file
    city_state_key = f"{city.lower().replace(' ', '_')}_{state.lower()}"
    geojson_path = Path(__file__).parent.parent.parent / "public" / "cities" / f"{city_state_key}.geojson"

    if not geojson_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"City boundary not available for {city}, {state}"
        )

    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        return geojson_data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading city boundary: {str(e)}"
        )
