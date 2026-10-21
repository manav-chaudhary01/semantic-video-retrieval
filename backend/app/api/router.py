from fastapi import APIRouter
from backend.app.api.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)

# Future phase routers will be registered here:
# api_router.include_router(videos_router, prefix="/videos", tags=["Videos"])
# api_router.include_router(search_router, prefix="/search", tags=["Search"])
