from pydantic import BaseModel

class ReviewDTO(BaseModel):
    review_id: str
    text: str
    stars: float
    date: str
    business_id: str
    sentiment_confidence: float
    prob_negative: float
    prob_neutral: float
    prob_positive: float
    sentiment_score_prob_diff: float
    sentiment_score_expected: float
    sentiment_score_logit: float
