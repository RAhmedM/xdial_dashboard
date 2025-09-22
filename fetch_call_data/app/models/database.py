"""
Database connection management for existing database.
"""

from databases import Database
from app.core.config import settings

# Create database instance with connection pooling
database = Database(
    settings.database.url,
    min_size=settings.database.min_connections,
    max_size=settings.database.max_connections,
    max_queries=settings.database.max_uses,
    max_inactive_connection_lifetime=settings.database.idle_timeout,
    command_timeout=settings.database.connection_timeout
)


async def connect_db():
    """Connect to the database."""
    await database.connect()


async def disconnect_db():
    """Disconnect from the database."""
    await database.disconnect()
