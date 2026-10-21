from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.rate_limiter import RateLimitDependency
from backend.app.db.session import get_db
from backend.app.schemas.search import SearchRequest, SearchResponse
from backend.app.services.search_service import search_service

router = APIRouter(tags=["Search"])

search_rate_limiter = RateLimitDependency(settings.RATE_LIMIT_SEARCH_PER_MIN, tier_name="search")


@router.post("", response_model=SearchResponse, summary="Semantic Video Retrieval")
def search_videos(
    request: SearchRequest,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(search_rate_limiter),
) -> SearchResponse:
    """Executes semantic search against indexed video speech segments or frames."""
    return search_service.search(db, request)


@router.post("/multimodal", response_model=SearchResponse, summary="Multimodal Fused Search")
def search_multimodal(
    request: SearchRequest,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(search_rate_limiter),
) -> SearchResponse:
    """Executes fused cross-modal retrieval combining spoken dialogue and visual scene frames."""
    request.modality = "multimodal"
    return search_service.search(db, request)
