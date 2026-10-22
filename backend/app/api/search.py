from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.search import SearchRequest, SearchResponse
from backend.app.services.search_service import search_service

router = APIRouter(tags=["Search"])


@router.post("", response_model=SearchResponse, summary="Semantic Video Retrieval")
def search_videos(
    request: SearchRequest,
    db: Session = Depends(get_db),
) -> SearchResponse:
    """Executes semantic search against indexed video speech segments using dense vector embeddings."""
    return search_service.search(db, request)
