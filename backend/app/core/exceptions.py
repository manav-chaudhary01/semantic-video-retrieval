from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.app.core.logging import logger


class AppError(Exception):
    """Base exception for application-specific operational errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class VideoNotFoundError(AppError):
    def __init__(self, video_id: str):
        super().__init__(
            message=f"Video with ID '{video_id}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"video_id": video_id},
        )


class InvalidFileError(AppError):
    def __init__(self, reason: str):
        super().__init__(
            message=f"Invalid file: {reason}",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"reason": reason},
        )


class ProcessingError(AppError):
    def __init__(self, stage: str, reason: str):
        super().__init__(
            message=f"Processing failed during '{stage}': {reason}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"stage": stage, "reason": reason},
        )


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"reason": message},
        )


class SearchError(AppError):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=status_code, details=details)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handles custom domain AppError exceptions."""
    logger.error(
        f"AppError [{exc.status_code}] on {request.method} {request.url.path}: {exc.message}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "extra": exc.details},
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Handles standard HTTPExceptions."""
    logger.warning(
        f"HTTPException [{exc.status_code}] on {request.method} {request.url.path}: {exc.detail}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)},
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handles Pydantic request validation errors."""
    logger.warning(
        f"Validation error on {request.method} {request.url.path}: {exc.errors()}"
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": exc.errors()},
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catches all unhandled exceptions."""
    logger.exception(
        f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )
