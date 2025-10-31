from __future__ import annotations

from sqlalchemy import String, Float, Integer, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, TYPE_CHECKING

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.photo import Photo


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
    categories: Mapped[str] = mapped_column(String(500))
    attributes: Mapped[dict] = mapped_column(JSON)
    hours: Mapped[dict] = mapped_column(JSON)

    # Relationships - one business has many photos
    photos: Mapped[List["Photo"]] = relationship(
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
