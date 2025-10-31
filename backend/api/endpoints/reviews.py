from typing import List
from fastapi import APIRouter, HTTPException, Path, Query, status

from configs.settings import REVIEWS_JSON
from repositories.json_repository import ReviewRepository
from schemas.review_dto import ReviewDTO

repository = ReviewRepository(REVIEWS_JSON)

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
    responses={404: {"description": "Not found"}}
)


@router.get("/{business_id}", response_model=List[ReviewDTO])
def get_reviews(
    business_id: str = Path(..., min_length=1, description="Unique business identifier"),
    skip: int = Query(0, ge=0, description="Number of reviews to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of reviews to return")
):
    """
    Get all reviews for a specific business.

    Returns a list of reviews with sentiment analysis.
    Supports pagination via skip and limit parameters.
    """
    reviews = repository.get_by_business_id(business_id)

    if not reviews or len(reviews) == 0:
        return []

    # Apply pagination
    return reviews[skip:skip + limit]
