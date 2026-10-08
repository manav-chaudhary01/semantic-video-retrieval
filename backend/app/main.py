import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from backend.app.db.init_db import init_db
from backend.app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown routines."""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    
    # Ensure all local storage directories exist
    for dir_path in [
        settings.DATA_DIR,
        settings.VIDEOS_DIR,
        settings.AUDIO_DIR,
        settings.INDEXES_DIR,
        settings.TEMP_DIR,
    ]:
        abs_path = settings.get_absolute_path(dir_path)
        abs_path.mkdir(parents=True, exist_ok=True)
    
    # Initialize database tables
    init_db()

    # Pre-warm text embedding model in a background thread to prevent blocking Uvicorn socket binding
    def _warmup_worker():
        try:
            from backend.app.ml.text_embeddings import text_embedder
            text_embedder.embed_texts(["warmup query"])
            logger.info("Text embedding model warmed up successfully in background.")
        except Exception as e:
            logger.warning(f"Embedding warmup skipped: {e}")

    threading.Thread(target=_warmup_worker, daemon=True).start()
    
    yield
    
    logger.info("Shutting down Semantic Video Retrieval backend.")


def create_application() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Centralized Exception Handlers
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Mount consolidated API router
    app.include_router(api_router, prefix=settings.API_PREFIX)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "docs": "/docs",
        }

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
