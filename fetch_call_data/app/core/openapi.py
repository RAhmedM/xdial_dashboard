"""
OpenAPI configuration for FastAPI with JWT Bearer authentication.
"""

from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.core.security import SECURITY_SCHEMA, SECURITY_REQUIREMENT


def custom_openapi_schema(app):
    """Generate custom OpenAPI schema with JWT Bearer authentication support."""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=settings.api.title,
        version=settings.api.version,
        description=settings.api.description,
        routes=app.routes,
    )
    
    # add jwt bearer authentication to security schemes
    openapi_schema["components"]["securitySchemes"] = SECURITY_SCHEMA
    
    
    
    # add custom info
    openapi_schema["info"]["contact"] = {
        "name": "API Support",
        "email": "support@xdialnetworks.com"
    }
    
    openapi_schema["info"]["license"] = {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }
    
    # add servers information
    openapi_schema["servers"] = [
        {
            "url": "https://fetchapi.dashboard.xdialnetworks.com",
            "description": "Production server"
        },
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        }
    ]
    
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def setup_openapi(app):
    """Setup custom OpenAPI schema for the application."""
    app.openapi = lambda: custom_openapi_schema(app)
