"""
Repository interfaces (Abstract Base Classes).
Define contracts for data access layer.
"""
from abc import ABC, abstractmethod
from typing import List, Optional

from models.business import Business


class BusinessRepositoryInterface(ABC):
    """Abstract interface for business data access operations."""

    @abstractmethod
    async def get_by_id(self, business_id: str) -> Optional[Business]:
        """Get a single business by ID."""
        pass

    @abstractmethod
    async def get_all(
        self,
        state: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Business]:
        """Get list of businesses with optional filtering and pagination."""
        pass

    @abstractmethod
    async def get_in_viewport(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        limit: int = 1000
    ) -> List[Business]:
        """Get businesses within a geographic viewport."""
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Business]:
        """Search businesses using fuzzy matching."""
        pass

    @abstractmethod
    async def get_states(self) -> List[str]:
        """Get list of unique states."""
        pass

    @abstractmethod
    async def get_cities_by_state(self, state: str) -> List[str]:
        """Get list of unique cities in a state."""
        pass
