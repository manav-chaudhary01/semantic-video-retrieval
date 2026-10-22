from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.exceptions import VideoNotFoundError
from backend.app.core.security import validate_uuid, safe_resolve_path
from backend.app.db.session import get_db
from backend.app.models.video import Video
from backend.app.models.frame import VisualFrame
from backend.app.schemas.frame import VisualFrameResponse, VisualFrameListResponse

router = APIRouter(tags=["Visual Frames"])


@router.get(
    "/{video_id}/frames",
    response_model=VisualFrameListResponse,
    summary="List all sampled visual frames for a video",
)
def list_video_frames(
    video_id: str,
    db: Session = Depends(get_db),
) -> VisualFrameListResponse:
    """Returns metadata for all sampled frames belonging to a video."""
    safe_video_id = validate_uuid(video_id, "Video ID")

    video = db.query(Video).filter(Video.id == safe_video_id).first()
    if not video:
        raise VideoNotFoundError(safe_video_id)

    frames = (
        db.query(VisualFrame)
        .filter(VisualFrame.video_id == safe_video_id)
        .order_by(VisualFrame.timestamp.asc())
        .all()
    )

    items: List[VisualFrameResponse] = []
    for f in frames:
        items.append(
            VisualFrameResponse(
                id=f.id,
                video_id=f.video_id,
                timestamp=f.timestamp,
                frame_path=f.frame_path,
                preview_url=f"/api/videos/{f.video_id}/frames/{f.id}",
                index_reference=f.index_reference,
            )
        )

    return VisualFrameListResponse(
        video_id=safe_video_id,
        total_frames=len(items),
        frames=items,
    )


@router.get(
    "/{video_id}/frames/{frame_id}",
    response_class=FileResponse,
    summary="Retrieve visual frame thumbnail JPEG image",
)
def get_frame_image(
    video_id: str,
    frame_id: str,
    db: Session = Depends(get_db),
):
    """Serves the JPEG image file for a sampled video frame with path security validation."""
    safe_video_id = validate_uuid(video_id, "Video ID")
    safe_frame_id = validate_uuid(frame_id, "Frame ID")

    frame = (
        db.query(VisualFrame)
        .filter(VisualFrame.id == safe_frame_id, VisualFrame.video_id == safe_video_id)
        .first()
    )
    if not frame or not frame.frame_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frame '{safe_frame_id}' not found for video '{safe_video_id}'",
        )

    raw_disk_path = settings.get_absolute_path(Path(frame.frame_path))
    # Validate that the file is strictly contained within FRAMES_DIR
    safe_disk_path = safe_resolve_path(raw_disk_path, settings.get_absolute_path(settings.FRAMES_DIR))

    if not safe_disk_path.exists() or not safe_disk_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frame image file missing on disk at {safe_disk_path.name}",
        )

    return FileResponse(
        path=str(safe_disk_path),
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )
