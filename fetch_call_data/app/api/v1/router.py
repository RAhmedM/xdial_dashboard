"""
API v1 router configuration.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import calls

# Create API v1 router
api_router = APIRouter()

# Include endpoint routers
api_router.include_router(calls.router, prefix="/calls", tags=["calls"])
