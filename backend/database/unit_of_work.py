"""
Unit of Work pattern for managing database transactions.
Provides explicit transaction control across multiple repositories.
"""
from sqlalchemy.ext.asyncio import AsyncSession


class UnitOfWork:
    """
    Unit of Work manages database transactions.

    Allows services to coordinate operations across multiple repositories
    with explicit transaction control (commit/rollback).
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize Unit of Work with database session.

        Args:
            session: Async database session
        """
        self.session = session

    async def commit(self) -> None:
        """
        Commit the current transaction.

        Persists all changes made within this unit of work to the database.
        """
        await self.session.commit()

    async def rollback(self) -> None:
        """
        Rollback the current transaction.

        Discards all changes made within this unit of work.
        """
        await self.session.rollback()

    async def flush(self) -> None:
        """
        Flush pending changes to the database without committing.

        Useful for ensuring database constraints are checked before commit.
        """
        await self.session.flush()

    async def refresh(self, instance) -> None:
        """
        Refresh an instance from the database.

        Args:
            instance: ORM model instance to refresh
        """
        await self.session.refresh(instance)
