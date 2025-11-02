from pydantic import BaseModel, Field


class PhotoDTO(BaseModel):
    photo_id: str = Field(..., description="Unique photo identifier")
    business_id: str = Field(..., description="Business this photo belongs to")
    label: str = Field(..., description="Photo category (food, inside, drink, outside, menu)")

    class Config:
        json_schema_extra = {
            "example": {
                "photo_id": "zsvj7vloL4L5jhYyPIuVwg",
                "business_id": "Nk-SJhPlDBkAZvfsADtccA",
                "label": "food"
            }
        }
