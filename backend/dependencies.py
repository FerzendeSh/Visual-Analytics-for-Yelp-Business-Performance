"""
Centralized dependency injection for FastAPI.
Provides all service dependencies with proper wiring.
"""
from functools import lru_cache
from pathlib import Path
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_async_session
from repositories.business_repository import BusinessRepository
from repositories.review_repository import ReviewRepository
from repositories.cluster_repository import ClusterRepository
from repositories.interfaces import BusinessRepositoryInterface, ReviewRepositoryInterface, ClusterRepositoryInterface
from services.business_service import BusinessService
from services.analytics_service import AnalyticsService
from services.forecast_service import ForecastService
from services.keyword_service import KeywordService, EmbeddingStore
from services.cluster_service import ClusterService
from services.interfaces import BusinessServiceInterface, AnalyticsServiceInterface


# ============================================================================
# Paths
# ============================================================================

BACKEND_DIR = Path(__file__).parent
PUBLIC_DIR = BACKEND_DIR / "public"
EMBEDDINGS_PATH = PUBLIC_DIR / "review_embeddings.npy"
METADATA_PATH = PUBLIC_DIR / "review_metadata.parquet"


# ============================================================================
# Singleton ML Model Loaders
# ============================================================================

@lru_cache(maxsize=1)
def get_embedding_store() -> EmbeddingStore:
    """
    Load EmbeddingStore as a singleton.
    Uses memory-mapped numpy array for efficient embedding lookup.
    """
    return EmbeddingStore(
        embeddings_path=EMBEDDINGS_PATH,
        metadata_path=METADATA_PATH
    )


# ============================================================================
# Repository Dependencies
# ============================================================================

def get_business_repository(
    db: AsyncSession = Depends(get_async_session)
) -> BusinessRepositoryInterface:
    """Get business repository instance."""
    return BusinessRepository(db)


def get_review_repository(
    db: AsyncSession = Depends(get_async_session)
) -> ReviewRepositoryInterface:
    """Get review repository instance."""
    return ReviewRepository(db)


def get_cluster_repository(
    db: AsyncSession = Depends(get_async_session)
) -> ClusterRepositoryInterface:
    """Get cluster repository instance."""
    return ClusterRepository(db)


# ============================================================================
# Service Dependencies
# ============================================================================

def get_business_service(
    business_repository: BusinessRepositoryInterface = Depends(get_business_repository)
) -> BusinessServiceInterface:
    """Get business service instance."""
    return BusinessService(business_repository)


def get_analytics_service(
    review_repository: ReviewRepositoryInterface = Depends(get_review_repository),
    business_repository: BusinessRepositoryInterface = Depends(get_business_repository),
    db: AsyncSession = Depends(get_async_session)
) -> AnalyticsServiceInterface:
    """Get analytics service instance."""
    return AnalyticsService(review_repository, business_repository, db)


def get_cluster_service(
    cluster_repository: ClusterRepositoryInterface = Depends(get_cluster_repository),
    db: AsyncSession = Depends(get_async_session)
) -> ClusterService:
    """Get cluster service instance."""
    return ClusterService(cluster_repository, db)


# ============================================================================
# Phase 2 Service Dependencies
# ============================================================================

@lru_cache(maxsize=1)
def get_forecast_service() -> ForecastService:
    return ForecastService()


@lru_cache(maxsize=1)
def get_keyword_service() -> KeywordService:
    embedding_store = get_embedding_store()
    return KeywordService(embedding_store=embedding_store)


def preload_ml_models():
    """Pre-load ML models at startup to avoid cold-start latency."""
    store = get_embedding_store()
    store._load()
    _ = get_forecast_service()
    _ = get_keyword_service()
