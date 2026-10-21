from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class VideoUploadResponse(BaseModel):
    """Response returned upon accepting a video upload."""
    video_id: str
    filename: str
    status: str
    message: str
    job_id: str


class VideoResponse(BaseModel):
    """Detailed metadata for a stored video."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    file_size: int
    mime_type: Optional[str] = None
    has_audio: bool
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VideoListResponse(BaseModel):
    """Paginated list of videos."""
    total: int
    items: List[VideoResponse]


class JobStatusResponse(BaseModel):
    """Current processing job stage and progress."""
    video_id: str
    job_id: str
    status: str
    stage: str
    progress: float = Field(ge=0.0, le=100.0)
    error_message: Optional[str] = None
