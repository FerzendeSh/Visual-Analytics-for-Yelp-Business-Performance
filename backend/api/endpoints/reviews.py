from typing import List
from fastapi import APIRouter, HTTPException

from configs.settings import REVIEWS_JSON
from repositories.json_repository import ReviewRepository
from schemas.review_dto import ReviewDTO

router = APIRouter()

repository = ReviewRepository(REVIEWS_JSON)


@router.get("/reviews/{business_id}", response_model=List[ReviewDTO])
async def get_reviews(business_id: str):
    if business_id == "":
        raise HTTPException(status_code=400, detail="Business ID cannot be empty")

    reviews = repository.get_by_business_id(business_id)

    if not reviews:
        raise HTTPException(status_code=404, detail="No reviews found for this business")

    return reviews
