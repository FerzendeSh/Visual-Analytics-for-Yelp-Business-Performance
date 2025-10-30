from typing import List

from fastapi import APIRouter, HTTPException

from configs.settings import PHOTOS_JSON
from repositories.json_repository import PhotoRepository
from schemas.photo_dto import PhotoDTO

router = APIRouter()

repository = PhotoRepository(PHOTOS_JSON)

@router.get("/photos/{business_id}", response_model=List[PhotoDTO])
async def get_photos(business_id: str):
    if business_id == "":
        raise HTTPException(status_code=400, detail="Business ID cannot be empty")
    photos = repository.get_by_business_id(business_id)
    if photos is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photos