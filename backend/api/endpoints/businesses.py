from fastapi import HTTPException, APIRouter

from configs.settings import BUSINESSES_JSON
from repositories.json_repository import BusinessRepository
from schemas.business_dto import BusinessDTO

business_repo = BusinessRepository(BUSINESSES_JSON)

router = APIRouter()

@router.get("/businesses/{business_id}", response_model=BusinessDTO)
async def get_business(business_id: str):
    if business_id == "":
        raise HTTPException(status_code=400, detail="business not found")

    business = business_repo.get_by_business_id(business_id)

    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    return business