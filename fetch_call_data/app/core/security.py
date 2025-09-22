"""
Security configuration and JWT Bearer authentication schema.
"""

from fastapi.security import HTTPBearer
from fastapi.openapi.models import HTTPBearer as HTTPBearerModel

# JWT Bearer security scheme for FastAPI
jwt_bearer = HTTPBearer(
    bearerFormat="JWT",
    scheme_name="JWT Bearer Token",
    description="Enter JWT token (the 'Bearer ' prefix will be added automatically)",
    auto_error=True
)

# Security schema for OpenAPI documentation
SECURITY_SCHEMA = {
    "JWTBearer": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter JWT token in the format: your-jwt-token (Bearer prefix is automatic)"
    }
}

# Security requirement for protected endpoints
SECURITY_REQUIREMENT = [{"JWTBearer": []}]
