"""
Application configuration settings.
"""
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load environment variables from .env file
# Look for .env in the project root (parent of backend directory)
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(ENV_FILE)


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic-settings for validation and type safety.
    """

    # API Configuration
    PROJECT_NAME: str = "Yelp Business Analytics API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://yelp_user:yelp_password@localhost:5432/yelp_analytics"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # PostgreSQL Connection Details (used by Docker Compose)
    POSTGRES_DB: str = "yelp_analytics"
    POSTGRES_USER: str = "yelp_user"
    POSTGRES_PASSWORD: str = "yelp_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic migrations)."""
        return self.DATABASE_URL.replace("+asyncpg", "")


# Instantiate settings singleton
settings = Settings()

# Export commonly used settings for convenience
PROJECT_NAME = settings.PROJECT_NAME
VERSION = settings.VERSION
ALLOWED_ORIGINS = settings.allowed_origins_list
API_V1_PREFIX = settings.API_V1_PREFIX
