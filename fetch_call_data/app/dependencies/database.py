"""
Database dependencies for FastAPI.
"""

from databases import Database
from app.models.database import database


async def get_database() -> Database:
    """Get database connection dependency."""
    return database
