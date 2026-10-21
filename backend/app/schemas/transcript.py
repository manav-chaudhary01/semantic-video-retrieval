from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class TranscriptSegmentResponse(BaseModel):
    """Timestamped speech transcript segment."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    start_time: float = Field(description="Segment start in seconds from video origin")
    end_time: float = Field(description="Segment end in seconds from video origin")
    text: str = Field(description="Transcribed spoken dialogue")
    language: Optional[str] = None
    embedding_model: Optional[str] = None
    index_reference: Optional[int] = None


class TranscriptResponse(BaseModel):
    """Full transcript for a video."""
    video_id: str
    language: Optional[str] = None
    total_segments: int
    segments: List[TranscriptSegmentResponse]


class SegmentListResponse(BaseModel):
    """Paginated list of transcript segments."""
    video_id: str
    total: int
    items: List[TranscriptSegmentResponse]
