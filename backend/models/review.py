from __future__ import annotations

from sqlalchemy import String, Float, Integer, Date, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from datetime import date

from models.base import Base

if TYPE_CHECKING:
    from models.business import Business


class Review(Base):
    __tablename__ = "reviews"

    # Primary key
    review_id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Foreign key to businesses
    business_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("businesses.business_id"),
        index=True
    )

    # Review content
    text: Mapped[str] = mapped_column(Text)
    stars: Mapped[float] = mapped_column(Float)

    # Date field - CRITICAL for time-series analysis
    date: Mapped[date] = mapped_column(Date, index=True)

    # User information
    user_id: Mapped[str] = mapped_column(String(50), index=True)

    # Voting metrics
    useful: Mapped[int] = mapped_column(Integer, default=0)
    funny: Mapped[int] = mapped_column(Integer, default=0)
    cool: Mapped[int] = mapped_column(Integer, default=0)

    # Sentiment analysis fields
    sentiment_label: Mapped[str] = mapped_column(String(20))  # negative, neutral, positive
    sentiment_confidence: Mapped[float] = mapped_column(Float)

    # Sentiment probabilities
    prob_negative: Mapped[float] = mapped_column(Float)
    prob_neutral: Mapped[float] = mapped_column(Float)
    prob_positive: Mapped[float] = mapped_column(Float)

    # Sentiment scores (different calculation methods)
    sentiment_score_prob_diff: Mapped[float] = mapped_column(Float)
    sentiment_score_expected: Mapped[float] = mapped_column(Float)
    sentiment_score_logit: Mapped[float] = mapped_column(Float)

    # Relationship - many reviews belong to one business
    business: Mapped["Business"] = relationship(back_populates="reviews")

    # Composite indexes for time-series queries
    __table_args__ = (
        Index('idx_business_date', 'business_id', 'date'),  # For business time-series
        Index('idx_date_business', 'date', 'business_id'),  # For date-range queries
    )

    def __repr__(self):
        return f"<Review(review_id={self.review_id}, business_id={self.business_id}, stars={self.stars}, date={self.date})>"
