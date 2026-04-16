"""
Configuration settings for the SkillLink Matching Service.
Uses pydantic-settings to load environment variables with validation.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://skilllink:skilllink123@postgres:5432/skilllink_db",
        description="PostgreSQL connection URL",
    )

    # JWT
    JWT_SECRET: str = Field(
        default="skilllink-jwt-secret-2026-production",
        description="Secret key for JWT verification",
    )

    # Server
    PORT: int = Field(default=8000, description="Port to run the service on")

    # Application metadata
    APP_NAME: str = "SkillLink Matching Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


# Export a module-level singleton for convenience
settings: Settings = get_settings()
