from typing import List

from fastapi import APIRouter, HTTPException

from backend.configs.settings import PHOTOS_JSON
from backend.repositories.json_repository import PhotoRepository
from backend.schemas.photo_dto import PhotoDTO

router = APIRouter()

repository = PhotoRepository(PHOTOS_JSON)

@router.get("/photos/{business_id}")
async def get_photos(business_id: str, response_model=List[PhotoDTO]):
    if business_id == "":
        raise HTTPException(status_code=400, detail="Business ID cannot be empty")
    photos = repository.get_by_business_id(business_id)
    if photos is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return response_model(photos)