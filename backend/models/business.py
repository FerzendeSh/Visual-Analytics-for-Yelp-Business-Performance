from __future__ import annotations

from sqlalchemy import String, Float, Integer, JSON, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional, TYPE_CHECKING

from models.base import Base

if TYPE_CHECKING:
    from models.photo import Photo
    from models.review import Review


class Business(Base):
    __tablename__ = "businesses"

    # Primary key
    business_id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    state: Mapped[str] = mapped_column(String(50), index=True)

    # Location data
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    # Metrics
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[float] = mapped_column(Float, default=0.0)
    is_open: Mapped[int] = mapped_column(Integer, default=1)
    photo_count: Mapped[float] = mapped_column(Float, default=0.0)

    # Categories and metadata
    categories: Mapped[str] = mapped_column(Text)
    attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    hours: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships - one business has many photos and reviews
    photos: Mapped[List["Photo"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan"
    )

    reviews: Mapped[List["Review"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan"
    )

    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_location', 'city', 'state'),
        Index('idx_stars_reviews', 'stars', 'review_count'),
    )

    def __repr__(self):
        return f"<Business(business_id={self.business_id}, name={self.name})>"
