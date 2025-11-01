"""
Service interfaces (Abstract Base Classes).
Define contracts for business logic layer.
"""
from abc import ABC, abstractmethod
from typing import List, Optional

from models.business import Business


class BusinessServiceInterface(ABC):
    """Abstract interface for business service operations."""

    @abstractmethod
    async def get_business_by_id(self, business_id: str) -> Business:
        """
        Get a single business by ID.

        Args:
            business_id: Unique business identifier

        Returns:
            Business object

        Raises:
            HTTPException: If business not found
        """
        pass

    @abstractmethod
    async def get_businesses(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        """
        Get list of businesses with optional filtering and pagination.

        Args:
            state: Filter by state code (will be normalized to uppercase)
            city: Filter by city name
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Business objects
        """
        pass

    @abstractmethod
    async def get_businesses_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        limit: int = 1000
    ) -> List[Business]:
        """
        Get businesses within a geographic viewport.

        Validates bounds before querying.

        Args:
            south: Southern latitude bound
            north: Northern latitude bound
            west: Western longitude bound
            east: Eastern longitude bound
            limit: Maximum number of businesses to return

        Returns:
            List of Business objects within the viewport

        Raises:
            HTTPException: If bounds are invalid
        """
        pass

    @abstractmethod
    async def search_businesses(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        """
        Search businesses using advanced fuzzy matching.

        Args:
            query: Search query - supports multi-term and fuzzy matching
            skip: Number of records to skip
            limit: Maximum number of results to return

        Returns:
            List of Business objects ranked by relevance
        """
        pass
