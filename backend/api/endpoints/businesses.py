from fastapi import HTTPException, APIRouter, Path, status

from configs.settings import BUSINESSES_JSON
from repositories.json_repository import BusinessRepository
from schemas.business_dto import BusinessDTO

repository = BusinessRepository(BUSINESSES_JSON)

router = APIRouter(
    prefix="/businesses",
    tags=["businesses"],
    responses={404: {"description": "Not found"}}
)

@router.get("/{business_id}", response_model=BusinessDTO)
def get_business(
    business_id: str = Path(..., min_length=1, description="Unique business identifier")
):
    """
    Get a single business by ID.

    Returns detailed business information including location, ratings, hours, and attributes.
    """
    business = repository.get_by_business_id(business_id)

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )

    return business