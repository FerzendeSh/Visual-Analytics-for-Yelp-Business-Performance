from __future__ import annotations

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from models.base import Base

if TYPE_CHECKING:
    from models.business import Business


class Photo(Base):
    __tablename__ = "photos"

    # Primary key
    photo_id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Foreign key to businesses
    business_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("businesses.business_id"),
        index=True
    )

    # Photo label (e.g., "food", "inside", "drink", "outside", "menu")
    label: Mapped[str] = mapped_column(String(50), index=True)

    # Relationship - many photos belong to one business
    business: Mapped["Business"] = relationship(back_populates="photos")

    # Index for efficient queries by business
    __table_args__ = (
        Index('idx_business_label', 'business_id', 'label'),
    )

    def __repr__(self):
        return f"<Photo(photo_id={self.photo_id}, business_id={self.business_id}, label={self.label})>"
