"""
Pagination dependencies for FastAPI.
"""

from fastapi import Query
from app.core.config import settings


async def get_pagination_params(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(
        settings.api.default_page_size, 
        ge=1, 
        le=settings.api.max_page_size, 
        description="Items per page"
    )
) -> dict:
    """Get pagination parameters."""
    offset = (page - 1) * limit
    return {"page": page, "limit": limit, "offset": offset}
