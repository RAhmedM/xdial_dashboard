"""
CORS middleware configuration for FastAPI.
"""

from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings


def add_cors_middleware(app):
    """Add CORS middleware to FastAPI app."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allowed_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=settings.cors.allow_methods,
        allow_headers=settings.cors.allow_headers,
    )
