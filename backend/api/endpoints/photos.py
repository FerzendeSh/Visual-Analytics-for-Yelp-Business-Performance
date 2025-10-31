from typing import List

from fastapi import APIRouter, HTTPException, Path, Query, status

from configs.settings import PHOTOS_JSON
from repositories.json_repository import PhotoRepository
from schemas.photo_dto import PhotoDTO

repository = PhotoRepository(PHOTOS_JSON)

router = APIRouter(
    prefix="/photos",
    tags=["photos"],
    responses={404: {"description": "Not found"}}
)

@router.get("/{business_id}", response_model=List[PhotoDTO])
def get_photos(
    business_id: str = Path(..., min_length=1, description="Unique business identifier"),
    skip: int = Query(0, ge=0, description="Number of photos to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of photos to return")
):
    """
    Get all photos for a specific business.

    Returns a list of photos with their labels (e.g., food, inside, drink, outside, menu).
    Supports pagination via skip and limit parameters.
    """
    photos = repository.get_by_business_id(business_id)

    if photos is None or len(photos) == 0:
        return []

    # Apply pagination
    return photos[skip:skip + limit]