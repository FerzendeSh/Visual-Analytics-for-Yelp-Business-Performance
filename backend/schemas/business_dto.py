from typing import Optional
from pydantic import BaseModel, Field


class BusinessDTO(BaseModel):
    business_id: str = Field(..., description="Unique business identifier")
    name: str = Field(..., description="Business name")
    categories: str = Field(..., description="Comma-separated business categories")
    city: str = Field(..., description="City where business is located")
    state: str = Field(..., description="State where business is located")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    review_count: int = Field(..., description="Total number of reviews")
    stars: float = Field(..., ge=0, le=5, description="Average star rating (0-5)")
    is_open: int = Field(..., description="Whether business is open (1) or closed (0)")
    attributes: Optional[dict[str, str]] = Field(None, description="Business attributes (parking, WiFi, etc.)")
    hours: Optional[dict[str, str]] = Field(None, description="Business operating hours by day")
    photo_count: float = Field(..., description="Total number of photos")

    class Config:
        json_schema_extra = {
            "example": {
                "business_id": "MTSW4McQd7CbVtyjqoe9mw",
                "name": "St Honore Pastries",
                "categories": "Restaurants, Food, Bubble Tea, Coffee & Tea, Bakeries",
                "city": "Philadelphia",
                "state": "PA",
                "latitude": 39.9555052,
                "longitude": -75.1555641,
                "review_count": 80,
                "stars": 4.0,
                "is_open": 1,
                "attributes": {
                    "RestaurantsDelivery": "False",
                    "WiFi": "u'free'",
                    "Alcohol": "u'none'"
                },
                "hours": {
                    "Monday": "7:0-20:0",
                    "Tuesday": "7:0-20:0"
                },
                "photo_count": 7.0
            }
        }


