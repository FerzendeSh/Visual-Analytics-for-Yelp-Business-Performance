"""
Centralized dependency injection for FastAPI.
Provides all service dependencies with proper wiring.
"""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_async_session
from repositories.business_repository import BusinessRepository
from repositories.interfaces import BusinessRepositoryInterface
from services.business_service import BusinessService
from services.interfaces import BusinessServiceInterface


# ============================================================================
# Repository Dependencies
# ============================================================================

def get_business_repository(
    db: AsyncSession = Depends(get_async_session)
) -> BusinessRepositoryInterface:
    """
    Get business repository instance.

    Args:
        db: Async database session from dependency

    Returns:
        BusinessRepositoryInterface: Concrete repository implementation
    """
    return BusinessRepository(db)


# ============================================================================
# Service Dependencies
# ============================================================================

def get_business_service(
    business_repository: BusinessRepositoryInterface = Depends(get_business_repository)
) -> BusinessServiceInterface:
    """
    Get business service instance with all dependencies injected.

    Args:
        business_repository: Business repository dependency

    Returns:
        BusinessServiceInterface: Concrete service implementation
    """
    return BusinessService(business_repository)
