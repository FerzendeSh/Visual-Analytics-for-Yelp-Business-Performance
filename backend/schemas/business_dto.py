from pydantic import BaseModel


class BusinessDTO(BaseModel):
    business_id: str
    name: str
    categories: str
    city: str
    state: str
    latitude: float
    longitude: float
    review_count: int
    stars: float
    attributes: dict[str, str]
    hours: dict[str, str]
    photo_count: int


