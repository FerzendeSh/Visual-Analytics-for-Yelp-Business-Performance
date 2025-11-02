"""
Business API endpoints.
Handles HTTP requests for business resources using dependency injection.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query

from dependencies import get_business_service
from services.interfaces import BusinessServiceInterface
from schemas.business_dto import BusinessDTO

router = APIRouter(
    prefix="/businesses",
    tags=["businesses"],
    responses={404: {"description": "Not found"}}
)


@router.get("/", response_model=List[BusinessDTO])
async def list_businesses(
    state: Optional[str] = Query(None, min_length=2, max_length=2, description="State code (e.g., 'PA', 'CA')"),
    city: Optional[str] = Query(None, min_length=1, description="City name"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    business_service: BusinessServiceInterface = Depends(get_business_service)
):
    """
    Get all businesses in region with optional filtering.

    Supports filtering by state and city for dashboard and initial map view.
    Returns a paginated list of businesses ordered by star rating and review count.
    """
    return await business_service.get_businesses(
        state=state,
        city=city,
        skip=skip,
        limit=limit
    )


@router.get("/viewport", response_model=List[BusinessDTO])
async def get_businesses_in_viewport(
    south: float = Query(..., ge=-90, le=90, description="Southern latitude bound"),
    north: float = Query(..., ge=-90, le=90, description="Northern latitude bound"),
    west: float = Query(..., ge=-180, le=180, description="Western longitude bound"),
    east: float = Query(..., ge=-180, le=180, description="Eastern longitude bound"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of businesses to return"),
    business_service: BusinessServiceInterface = Depends(get_business_service)
):
    """
    Get businesses within a geographic viewport (bounding box).

    Used for cross-state map panning. Returns businesses whose coordinates fall within
    the specified latitude/longitude bounds.
    """
    return await business_service.get_businesses_in_viewport(
        south=south,
        north=north,
        west=west,
        east=east,
        limit=limit
    )


@router.get("/search", response_model=List[BusinessDTO])
async def search_businesses(
    q: str = Query(..., min_length=1, description="Search query - supports multi-term and fuzzy matching"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results to return"),
    business_service: BusinessServiceInterface = Depends(get_business_service)
):
    """
    Search businesses using advanced fuzzy matching.

    **Features:**
    - **Multi-term search**: "Philadelphia Italian" finds Italian restaurants in Philadelphia
    - **Fuzzy matching**: Handles typos ("Philadelfia" matches "Philadelphia")
    - **Intelligent ranking**: Best matches first based on relevance, not just ratings
    - **Cross-field search**: Searches name, city, state, and categories simultaneously

    **Search fields:**
    - Business name
    - City
    - State
    - Categories

    **Examples:**
    - `q=pizza` → All pizza places
    - `q=Philadelphia` → All businesses in Philadelphia
    - `q=Philadelphia Italian` → Italian restaurants in Philadelphia
    - `q=Philadelfia restaurant` → Restaurants in Philadelphia (typo corrected!)
    - `q=PA coffee` → Coffee shops in Pennsylvania
    - `q=cheesesteak` → Places serving cheesesteaks

    **How it works:**
    Each word in your query contributes to finding the best matches. The more
    relevant the match, the higher it ranks.
    """
    return await business_service.search_businesses(
        query=q,
        skip=skip,
        limit=limit
    )


# IMPORTANT: This route must be LAST because it matches any path
@router.get("/{business_id}", response_model=BusinessDTO)
async def get_business(
    business_id: str = Path(..., min_length=1, description="Unique business identifier"),
    business_service: BusinessServiceInterface = Depends(get_business_service)
):
    """
    Get a single business by ID.

    Returns detailed business information including location, ratings, hours, and attributes.
    """
    return await business_service.get_business_by_id(business_id)