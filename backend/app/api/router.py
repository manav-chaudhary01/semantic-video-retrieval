from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.api.videos import router as videos_router
from backend.app.api.transcripts import router as transcripts_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(videos_router, prefix="/videos")
api_router.include_router(transcripts_router, prefix="/videos")

# Future phase routers will be registered here:
# api_router.include_router(search_router, prefix="/search")
