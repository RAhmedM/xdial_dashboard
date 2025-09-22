"""
Configuration settings for the FastAPI application.
"""

import os
from typing import Optional, List
from pydantic import BaseSettings, validator


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""
    
    user: str = "admin"
    password: str = "admin8686"
    host: str = "localhost"
    port: int = 5432
    database: str = "xlite"
    ssl: bool = False
    min_connections: int = 5
    max_connections: int = 20
    connection_timeout: int = 10
    idle_timeout: int = 30
    max_uses: int = 7500
    
    @property
    def url(self) -> str:
        """Get the database URL."""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"
    
    class Config:
        env_prefix = "DB_"


class SecuritySettings(BaseSettings):
    """Security configuration settings."""
    
    secret_key: str = "this-is-a-secret-key-that-is-even-more-secure-lol"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    class Config:
        env_prefix = "SECURITY_"


class CorsSettings(BaseSettings):
    """CORS configuration settings."""
    
    allowed_origins: List[str] = [
        "https://dashboard.xdialnetworks.com",
        "https://fetchapi.dashboard.xdialnetworks.com"
    ]
    allow_credentials: bool = True
    allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE"]
    allow_headers: List[str] = ["*"]
    
    @validator("allowed_origins", pre=True)
    def parse_origins(cls, v):
        """Parse origins from environment variable."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    class Config:
        env_prefix = "CORS_"


class APISettings(BaseSettings):
    """API configuration settings."""
    
    title: str = "Xdial Client Dashboard API"
    description: str = "REST API for Xdial client Dashboard"
    version: str = "2.0.0"
    max_batch_size: int = 1000
    default_page_size: int = 50
    max_page_size: int = 1000
    
    class Config:
        env_prefix = "API_"


class DevelopmentSettings(BaseSettings):
    """Development environment settings."""
    
    debug: bool = True
    reload: bool = True
    host: str = "127.0.0.1"
    port: int = 8000
    
    database: DatabaseSettings = DatabaseSettings()
    security: SecuritySettings = SecuritySettings(
        secret_key="dev-secret-key-not-for-production"
    )
    cors: CorsSettings = CorsSettings(
        allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    api: APISettings = APISettings()


class ProductionSettings(BaseSettings):
    """Production environment settings."""
    
    debug: bool = False
    reload: bool = False
    host: str = "127.0.0.1"
    port: int = 8001  # Different port to avoid conflicts with development server
    
    database: DatabaseSettings = DatabaseSettings()
    security: SecuritySettings = SecuritySettings()
    cors: CorsSettings = CorsSettings()
    api: APISettings = APISettings()




def get_settings() -> BaseSettings:
    """Get settings based on environment."""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionSettings()
    else:
        return DevelopmentSettings()


# Global settings instance
settings = get_settings()
