from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.api.videos import router as videos_router
from backend.app.api.transcripts import router as transcripts_router
from backend.app.api.frames import router as frames_router
from backend.app.api.search import router as search_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(videos_router, prefix="/videos")
api_router.include_router(transcripts_router, prefix="/videos")
api_router.include_router(frames_router, prefix="/videos")
api_router.include_router(search_router, prefix="/search")
