import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import VideoNotFoundError, InvalidFileError
from backend.app.db.session import get_db
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.schemas.video import (
    VideoUploadResponse,
    VideoResponse,
    VideoListResponse,
    JobStatusResponse,
)
from backend.app.services.job_service import job_service
from backend.app.services.stream_service import create_media_stream_response

router = APIRouter(tags=["Videos"])


@router.post("", response_model=VideoUploadResponse, status_code=status.HTTP_202_ACCEPTED, summary="Upload a Video")
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Uploads a video file, validates constraints, and enqueues an asynchronous processing job."""
    if not file.filename:
        raise InvalidFileError("Filename cannot be empty.")

    filename = Path(file.filename).name
    ext = Path(filename).suffix.lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise InvalidFileError(
            f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Generate server-side UUID identifiers
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    storage_filename = f"{video_id}{ext}"
    relative_storage_path = Path("data/videos") / storage_filename
    absolute_storage_path = settings.get_absolute_path(relative_storage_path)
    absolute_storage_path.parent.mkdir(parents=True, exist_ok=True)

    # Stream file to disk in chunks to avoid loading large files into RAM
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    total_written = 0

    try:
        with open(absolute_storage_path, "wb") as destination:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_written += len(chunk)
                if total_written > max_bytes:
                    raise InvalidFileError(
                        f"Uploaded file exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                    )
                destination.write(chunk)
    except Exception as exc:
        if absolute_storage_path.exists():
            absolute_storage_path.unlink(missing_ok=True)
        if isinstance(exc, InvalidFileError):
            raise exc
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(exc)}")
    finally:
        await file.close()

    if total_written == 0:
        if absolute_storage_path.exists():
            absolute_storage_path.unlink(missing_ok=True)
        raise InvalidFileError("Uploaded file is empty (0 bytes).")

    # Persist Video and Initial Processing Job records in SQLite
    new_video = Video(
        id=video_id,
        original_filename=filename,
        storage_path=str(relative_storage_path).replace("\\", "/"),
        file_size=total_written,
        mime_type=file.content_type or f"video/{ext.lstrip('.')}",
        status="UPLOADED",
    )
    new_job = ProcessingJob(
        id=job_id,
        video_id=video_id,
        stage="VALIDATING",
        status="PENDING",
        progress=0.0,
    )

    db.add(new_video)
    db.add(new_job)
    db.commit()
    db.refresh(new_video)

    # Dispatch asynchronous background worker
    job_service.submit_job(video_id, job_id)

    logger.info(f"Accepted video upload: id={video_id}, name='{filename}', size={total_written} bytes")

    return VideoUploadResponse(
        video_id=video_id,
        filename=filename,
        status="UPLOADED",
        message="Video uploaded successfully. Ingestion job queued.",
        job_id=job_id,
    )


@router.get("", response_model=VideoListResponse, summary="List Videos")
def list_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieves a paginated list of all uploaded videos ordered by creation date."""
    total = db.query(Video).count()
    videos = (
        db.query(Video)
        .order_by(Video.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return VideoListResponse(total=total, items=videos)


@router.get("/{video_id}", response_model=VideoResponse, summary="Get Video Metadata")
def get_video(video_id: str, db: Session = Depends(get_db)):
    """Retrieves comprehensive metadata for a specific video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)
    return video


@router.get("/{video_id}/status", response_model=JobStatusResponse, summary="Get Video Ingestion Status")
def get_video_status(video_id: str, db: Session = Depends(get_db)):
    """Retrieves the active or latest ingestion job status for a given video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)

    job = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.video_id == video_id)
        .order_by(ProcessingJob.started_at.desc())
        .first()
    )
    if not job:
        return JobStatusResponse(
            video_id=video_id,
            job_id="",
            status=video.status,
            stage="UNKNOWN",
            progress=100.0 if video.status == "READY" else 0.0,
            error_message=video.error_message,
        )

    return JobStatusResponse(
        video_id=video_id,
        job_id=job.id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        error_message=job.error_message or video.error_message,
    )


@router.get("/{video_id}/stream", summary="Stream Video (HTTP Partial Content)")
def stream_video(video_id: str, request: Request, db: Session = Depends(get_db)):
    """Streams video file supporting range requests for timeline seeking and scrubbing."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)

    video_path = settings.get_absolute_path(Path(video.storage_path))
    media_type = video.mime_type or "video/mp4"
    return create_media_stream_response(video_path, request, media_type)


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Video")
def delete_video(video_id: str, db: Session = Depends(get_db)):
    """Deletes video database record and disk artifacts."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise VideoNotFoundError(video_id)

    # Delete video file and audio file
    video_path = settings.get_absolute_path(Path(video.storage_path))
    audio_path = settings.get_absolute_path(settings.AUDIO_DIR) / f"{video_id}.wav"

    if video_path.exists():
        video_path.unlink(missing_ok=True)
    if audio_path.exists():
        audio_path.unlink(missing_ok=True)

    db.delete(video)
    db.commit()
    logger.info(f"Deleted video {video_id} and its associated artifacts.")
    return None
