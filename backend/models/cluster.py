"""
Cluster models for storing business clustering results at city and neighborhood levels.
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import String, Float, Integer, JSON, DateTime, Text, Index, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
import enum

from models.base import Base

if TYPE_CHECKING:
    from models.business import Business


class ClusterLevel(str, enum.Enum):
    """Enum for cluster geographic level."""
    CITY = "city"
    NEIGHBORHOOD = "neighborhood"


class ClusterMethod(str, enum.Enum):
    """Enum for clustering algorithm used."""
    HDBSCAN = "hdbscan"
    KMEANS = "kmeans"
    GMM = "gmm"
    AGGLOMERATIVE = "agglomerative"
    RULE_BASED = "rule_based"


class ClusterRun(Base):
    """
    Stores metadata about each clustering run.
    Each run generates clusters for either all cities or all neighborhoods.
    """
    __tablename__ = "cluster_runs"

    # Primary key
    run_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Run metadata
    level: Mapped[ClusterLevel] = mapped_column(SQLEnum(ClusterLevel), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Configuration used
    feature_variant: Mapped[str] = mapped_column(String(100), nullable=False)
    dimred_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dimred_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Statistics
    total_entities_processed: Mapped[int] = mapped_column(Integer, default=0)
    total_clusters_created: Mapped[int] = mapped_column(Integer, default=0)
    avg_composite_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Execution info
    execution_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    clusters: Mapped[list["Cluster"]] = relationship(
        back_populates="cluster_run",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('idx_cluster_run_level_created', 'level', 'created_at'),
    )

    def __repr__(self):
        return f"<ClusterRun(run_id={self.run_id}, level={self.level}, created_at={self.created_at})>"


class Cluster(Base):
    """
    Stores information about each individual cluster within a run.
    A cluster is a group of businesses in a specific city or neighborhood.
    """
    __tablename__ = "clusters"

    # Primary key
    cluster_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to cluster run
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("cluster_runs.run_id"), nullable=False, index=True)

    # Geographic context
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    neighborhood: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Cluster identification within this geographic area
    cluster_label: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g., 0, 1, 2, -1 (noise for HDBSCAN)

    # Clustering metadata
    method: Mapped[ClusterMethod] = mapped_column(SQLEnum(ClusterMethod), nullable=False)
    method_params: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Cluster statistics
    size: Mapped[int] = mapped_column(Integer, default=0)  # Number of businesses

    # Quality metrics
    silhouette_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    davies_bouldin_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calinski_harabasz_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    composite_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Cluster characteristics (computed from member businesses)
    avg_stars: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_review_count: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_price_range: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Centroid location
    centroid_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    centroid_lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # LLM-generated label and description
    ai_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ai_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_key_characteristics: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # List of key features

    # Top categories in this cluster
    top_categories: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [{"category": "Restaurants", "count": 45}, ...]

    # Business attribute patterns for competitive analysis
    attribute_patterns: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Price ranges, parking, delivery, etc.

    # Relationships
    cluster_run: Mapped["ClusterRun"] = relationship(back_populates="clusters")

    business_clusters: Mapped[list["BusinessCluster"]] = relationship(
        back_populates="cluster",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('idx_cluster_location', 'city', 'neighborhood'),
        Index('idx_cluster_run_location', 'run_id', 'city', 'neighborhood'),
        Index('idx_cluster_label', 'run_id', 'city', 'cluster_label'),
    )

    def __repr__(self):
        location = f"{self.neighborhood}, {self.city}" if self.neighborhood else self.city
        return f"<Cluster(cluster_id={self.cluster_id}, location={location}, label={self.cluster_label})>"


class BusinessCluster(Base):
    """
    Junction table linking businesses to their assigned clusters.
    Stores the assignment with confidence/probability scores.
    """
    __tablename__ = "business_clusters"

    # Composite primary key
    business_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("businesses.business_id"),
        primary_key=True
    )
    cluster_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clusters.cluster_id"),
        primary_key=True
    )

    # Assignment metadata
    distance_to_centroid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cluster_probability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # For probabilistic methods
    outlier_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # For HDBSCAN
    
    # Visualization coordinates
    umap_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    umap_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Is this a noise/outlier point?
    is_noise: Mapped[bool] = mapped_column(Integer, default=0)  # SQLite uses Integer for boolean

    # Relationships
    business: Mapped["Business"] = relationship()
    cluster: Mapped["Cluster"] = relationship(back_populates="business_clusters")

    __table_args__ = (
        Index('idx_business_cluster_business', 'business_id'),
        Index('idx_business_cluster_cluster', 'cluster_id'),
    )

    def __repr__(self):
        return f"<BusinessCluster(business_id={self.business_id}, cluster_id={self.cluster_id})>"
