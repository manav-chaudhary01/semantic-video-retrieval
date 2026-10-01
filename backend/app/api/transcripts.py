from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.exceptions import VideoNotFoundError
from backend.app.db.session import get_db
from backend.app.models.video import Video
from backend.app.models.segment import TranscriptSegment
from backend.app.schemas.transcript import (
    TranscriptResponse,
    TranscriptSegmentResponse,
    SegmentListResponse,
)

router = APIRouter(tags=["Transcripts"])


@router.get("/{video_id}/transcript", response_model=TranscriptResponse, summary="Get Full Video Transcript")
def get_video_transcript(video_id: str, db: Session = Depends(get_db)):
    """Retrieves all timestamped transcript segments for a given video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.video_id == video_id)
        .order_by(TranscriptSegment.start_time.asc())
        .all()
    )

    detected_lang = segments[0].language if segments else None

    return TranscriptResponse(
        video_id=video_id,
        language=detected_lang,
        total_segments=len(segments),
        segments=segments,
    )


@router.get("/{video_id}/segments", response_model=SegmentListResponse, summary="List Paginated Video Segments")
def list_video_segments(
    video_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves paginated timestamped segments for a video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)

    query = db.query(TranscriptSegment).filter(TranscriptSegment.video_id == video_id)
    total = query.count()
    segments = (
        query.order_by(TranscriptSegment.start_time.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return SegmentListResponse(
        video_id=video_id,
        total=total,
        items=segments,
    )
