"""
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn

from app.core.config import settings
from app.core.openapi import setup_openapi
from app.models.database import connect_db, disconnect_db
from app.api.v1.router import api_router
from app.middleware.cors import add_cors_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application lifespan events."""
    # startup
    await connect_db()
    yield
    # shutdown
    await disconnect_db()


def create_application() -> FastAPI:
    """Create and configure FastAPI application."""
    
    # create fastapi instance
    application = FastAPI(
        title=settings.api.title,
        description=settings.api.description,
        version=settings.api.version,
        debug=settings.debug,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )
    
    # add cors middleware
    add_cors_middleware(application)
    
    # database events now handled by lifespan context manager
    
    # setup custom openapi schema
    setup_openapi(application)
    
    # include api routes
    application.include_router(api_router, prefix="/api/v1")
    
    # add exception handlers
    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        """Handle validation errors."""
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation error",
                "details": exc.errors()
            }
        )
    
    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request, exc):
        """Handle HTTP exceptions."""
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    
    @application.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        """Handle general exceptions."""
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    
    return application


# create app instance
app = create_application()


if __name__ == "__main__":
    # run with uvicorn
    uvicorn.run(
        "trunk:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        access_log=settings.debug
    )
