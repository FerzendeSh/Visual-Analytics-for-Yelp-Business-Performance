from pydantic import BaseModel, Field


class ReviewDTO(BaseModel):
    review_id: str = Field(..., description="Unique review identifier")
    text: str = Field(..., description="Review text content")
    stars: float = Field(..., ge=0, le=5, description="Star rating (0-5)")
    date: str = Field(..., description="Review date")
    business_id: str = Field(..., description="Business this review belongs to")
    sentiment_confidence: float = Field(..., description="Confidence of sentiment prediction")
    prob_negative: float = Field(..., ge=0, le=1, description="Probability of negative sentiment")
    prob_neutral: float = Field(..., ge=0, le=1, description="Probability of neutral sentiment")
    prob_positive: float = Field(..., ge=0, le=1, description="Probability of positive sentiment")
    sentiment_score_prob_diff: float = Field(..., description="Sentiment score based on probability difference")
    sentiment_score_expected: float = Field(..., description="Expected sentiment score")
    sentiment_score_logit: float = Field(..., description="Sentiment score based on logits")

    class Config:
        json_schema_extra = {
            "example": {
                "review_id": "xQY8N_2wKLWHs1qJVlNwxw",
                "text": "Great food and excellent service! Highly recommend.",
                "stars": 5.0,
                "date": "2023-06-15",
                "business_id": "MTSW4McQd7CbVtyjqoe9mw",
                "sentiment_confidence": 0.95,
                "prob_negative": 0.02,
                "prob_neutral": 0.03,
                "prob_positive": 0.95,
                "sentiment_score_prob_diff": 0.93,
                "sentiment_score_expected": 0.93,
                "sentiment_score_logit": 3.42
            }
        }
