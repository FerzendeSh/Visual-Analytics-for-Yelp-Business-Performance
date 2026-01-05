"""
Pydantic schemas for cluster-related API requests and responses.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ClusterRunDTO(BaseModel):
    """Cluster run metadata"""
    run_id: int = Field(..., description="Unique run identifier")
    level: str = Field(..., description="Clustering level (city/neighborhood/global)")
    created_at: datetime = Field(..., description="When clustering was performed")
    feature_variant: str = Field(..., description="Feature engineering approach used")
    dimred_method: Optional[str] = Field(None, description="Dimensionality reduction method")
    total_entities_processed: int = Field(..., description="Number of cities/neighborhoods processed")
    total_clusters_created: int = Field(..., description="Total clusters generated")
    avg_composite_score: Optional[float] = Field(None, description="Average quality score")
    execution_time_seconds: Optional[float] = Field(None, description="Clustering runtime")

    class Config:
        json_schema_extra = {
            "example": {
                "run_id": 1,
                "level": "city",
                "created_at": "2026-01-05T10:00:00Z",
                "feature_variant": "embeddings+geo+categories+sentiment",
                "dimred_method": "UMAP",
                "total_entities_processed": 1,
                "total_clusters_created": 43,
                "avg_composite_score": 0.72,
                "execution_time_seconds": 245.3
            }
        }


class ClusterSummaryDTO(BaseModel):
    """Cluster summary for listings"""
    cluster_id: int = Field(..., description="Unique cluster identifier")
    run_id: int = Field(..., description="Parent run identifier")
    city: str = Field(..., description="City context")
    neighborhood: Optional[str] = Field(None, description="Neighborhood context if applicable")
    cluster_label: int = Field(..., description="Cluster number (-1 for noise)")
    method: str = Field(..., description="Clustering algorithm used")
    size: int = Field(..., description="Number of businesses in cluster")
    avg_stars: Optional[float] = Field(None, description="Average rating")
    avg_review_count: Optional[float] = Field(None, description="Average review count")
    centroid_lat: Optional[float] = Field(None, description="Geographic center latitude")
    centroid_lon: Optional[float] = Field(None, description="Geographic center longitude")
    ai_label: Optional[str] = Field(None, description="Human-readable cluster label")
    ai_description: Optional[str] = Field(None, description="Cluster description")
    top_categories: Optional[List[Dict[str, Any]]] = Field(None, description="Top business categories")

    class Config:
        json_schema_extra = {
            "example": {
                "cluster_id": 1,
                "run_id": 1,
                "city": "GLOBAL",
                "neighborhood": None,
                "cluster_label": 0,
                "method": "hdbscan",
                "size": 154,
                "avg_stars": 3.86,
                "avg_review_count": 109.9,
                "centroid_lat": 53.5258,
                "centroid_lon": -113.5114,
                "ai_label": "Edmonton Casual Dining Scene",
                "ai_description": "Diverse restaurant cluster in Edmonton featuring trendy cafes...",
                "top_categories": [
                    {"category": "Restaurants", "count": 154},
                    {"category": "Nightlife", "count": 55}
                ]
            }
        }


class ClusterDetailDTO(ClusterSummaryDTO):
    """Detailed cluster information"""
    ai_key_characteristics: Optional[List[str]] = Field(None, description="Key defining features")
    attribute_patterns: Optional[Dict[str, Any]] = Field(None, description="Business attribute distributions")
    silhouette_score: Optional[float] = Field(None, description="Cluster cohesion metric")
    davies_bouldin_score: Optional[float] = Field(None, description="Cluster separation metric")
    calinski_harabasz_score: Optional[float] = Field(None, description="Variance ratio metric")
    composite_score: Optional[float] = Field(None, description="Overall quality metric")
    method_params: Optional[Dict[str, Any]] = Field(None, description="Algorithm parameters used")
    avg_price_range: Optional[float] = Field(None, description="Average price level")

    class Config:
        json_schema_extra = {
            "example": {
                "cluster_id": 1,
                "run_id": 1,
                "city": "GLOBAL",
                "neighborhood": None,
                "cluster_label": 0,
                "method": "hdbscan",
                "size": 154,
                "avg_stars": 3.86,
                "avg_review_count": 109.9,
                "centroid_lat": 53.5258,
                "centroid_lon": -113.5114,
                "ai_label": "Edmonton Casual Dining Scene",
                "ai_description": "Diverse restaurant cluster in Edmonton...",
                "ai_key_characteristics": [
                    "Urban/trendy atmosphere",
                    "nightlife integration",
                    "Canadian New cuisine emphasis"
                ],
                "top_categories": [{"category": "Restaurants", "count": 154}],
                "attribute_patterns": {"price_range": {"1": 20, "2": 80, "3": 40}},
                "silhouette_score": 0.68,
                "davies_bouldin_score": 0.82,
                "calinski_harabasz_score": 450.2,
                "composite_score": 0.71,
                "method_params": {"min_cluster_size": 15, "min_samples": 5},
                "avg_price_range": 2.1
            }
        }


class ClusterTimelinePointDTO(BaseModel):
    """Single point in cluster timeline"""
    period_start: str = Field(..., description="Period start date (ISO format)")
    avg_rating: float = Field(..., description="Average rating for period")
    avg_sentiment_score: float = Field(..., description="Average sentiment")
    avg_sentiment_expected: float = Field(..., description="Expected sentiment baseline")
    review_count: int = Field(..., description="Total reviews in period")
    business_count: int = Field(..., description="Active businesses in period")

    class Config:
        json_schema_extra = {
            "example": {
                "period_start": "2020-01-01",
                "avg_rating": 4.1,
                "avg_sentiment_score": 0.72,
                "avg_sentiment_expected": 0.68,
                "review_count": 284,
                "business_count": 38
            }
        }


class ClusterTimelineDTO(BaseModel):
    """Time series data for a cluster"""
    cluster_id: int = Field(..., description="Cluster identifier")
    cluster_label: Optional[str] = Field(None, description="Human-readable label")
    period: str = Field(..., description="Aggregation period (month/year)")
    data: List[ClusterTimelinePointDTO] = Field(..., description="Timeline data points")
    statistics: Dict[str, Any] = Field(..., description="Overall statistics")

    class Config:
        json_schema_extra = {
            "example": {
                "cluster_id": 1,
                "cluster_label": "Edmonton Casual Dining Scene",
                "period": "month",
                "data": [
                    {
                        "period_start": "2020-01-01",
                        "avg_rating": 4.1,
                        "avg_sentiment_score": 0.72,
                        "avg_sentiment_expected": 0.68,
                        "review_count": 284,
                        "business_count": 38
                    }
                ],
                "statistics": {
                    "overall_avg_rating": 4.18,
                    "overall_avg_sentiment": 0.73,
                    "total_reviews": 8456,
                    "date_range": {"start": "2020-01-01", "end": "2023-12-01"}
                }
            }
        }


class ClusterCatalogResponse(BaseModel):
    """Response containing available cluster runs"""
    runs: List[ClusterRunDTO] = Field(..., description="All available runs")
    latest_run: Optional[ClusterRunDTO] = Field(None, description="Most recent run")

    class Config:
        json_schema_extra = {
            "example": {
                "runs": [
                    {
                        "run_id": 1,
                        "level": "city",
                        "created_at": "2026-01-05T10:00:00Z",
                        "feature_variant": "embeddings+geo+categories+sentiment",
                        "total_entities_processed": 1,
                        "total_clusters_created": 43
                    }
                ],
                "latest_run": {
                    "run_id": 1,
                    "level": "city",
                    "created_at": "2026-01-05T10:00:00Z",
                    "feature_variant": "embeddings+geo+categories+sentiment",
                    "total_entities_processed": 1,
                    "total_clusters_created": 43
                }
            }
        }


class ClusterListResponse(BaseModel):
    """Paginated cluster list response"""
    clusters: List[ClusterSummaryDTO] = Field(..., description="Cluster summaries")
    total: int = Field(..., description="Total count")
    skip: int = Field(..., description="Offset used")
    limit: int = Field(..., description="Limit used")

    class Config:
        json_schema_extra = {
            "example": {
                "clusters": [],
                "total": 43,
                "skip": 0,
                "limit": 50
            }
        }
