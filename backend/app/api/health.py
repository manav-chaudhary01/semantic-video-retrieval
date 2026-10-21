from fastapi import APIRouter
from backend.app.schemas.health import HealthResponse
from backend.app.services.health_service import health_service

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="System Health Status")
async def check_health() -> HealthResponse:
    """Returns runtime health status, version, and dependency availability."""
    return health_service.get_health()
