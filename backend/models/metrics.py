"""
Pre-computed metrics models for fast analytics queries.
These tables store aggregated data to avoid real-time calculations.
"""
from sqlalchemy import String, Float, Integer, Date, Index, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date

from models.base import Base


class BusinessTimelineMetrics(Base):
    """Pre-computed timeline metrics for individual businesses"""
    __tablename__ = "business_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[str] = mapped_column(String(50), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('business_id', 'period_start', 'period_type', name='uq_business_period'),
        Index('idx_business_metrics_lookup', 'business_id', 'period_type', 'period_start'),
    )


class CityTimelineMetrics(Base):
    """Pre-computed timeline metrics for cities"""
    __tablename__ = "city_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('state', 'city', 'period_start', 'period_type', name='uq_city_period'),
        Index('idx_city_metrics_lookup', 'state', 'city', 'period_type', 'period_start'),
    )


class StateTimelineMetrics(Base):
    """Pre-computed timeline metrics for states"""
    __tablename__ = "state_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('state', 'period_start', 'period_type', name='uq_state_period'),
        Index('idx_state_metrics_lookup', 'state', 'period_type', 'period_start'),
    )


class CityCategoryTimelineMetrics(Base):
    """Pre-computed timeline metrics for categories within cities"""
    __tablename__ = "city_category_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('state', 'city', 'category', 'period_start', 'period_type',
                        name='uq_city_category_period'),
        Index('idx_city_category_metrics_lookup', 'state', 'city', 'category',
              'period_type', 'period_start'),
    )


class StateCategoryTimelineMetrics(Base):
    """Pre-computed timeline metrics for categories within states"""
    __tablename__ = "state_category_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('state', 'category', 'period_start', 'period_type',
                        name='uq_state_category_period'),
        Index('idx_state_category_metrics_lookup', 'state', 'category',
              'period_type', 'period_start'),
    )


class NeighborhoodTimelineMetrics(Base):
    """Pre-computed timeline metrics for neighborhoods"""
    __tablename__ = "neighborhood_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(2), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    neighborhood: Mapped[str] = mapped_column(String(100), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('state', 'city', 'neighborhood', 'period_start', 'period_type',
                        name='uq_neighborhood_period'),
        Index('idx_neighborhood_metrics_lookup', 'state', 'city', 'neighborhood',
              'period_type', 'period_start'),
    )


class ClusterTimelineMetrics(Base):
    """Pre-computed timeline metrics for clusters"""
    __tablename__ = "cluster_timeline_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cluster_id: Mapped[int] = mapped_column(Integer, ForeignKey("clusters.cluster_id"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_type: Mapped[str] = mapped_column(String(10))  # 'month' or 'year'
    avg_rating: Mapped[float] = mapped_column(Float)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_expected: Mapped[float] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer)
    business_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint('cluster_id', 'period_start', 'period_type', name='uq_cluster_period'),
        Index('idx_cluster_metrics_lookup', 'cluster_id', 'period_type', 'period_start'),
    )
