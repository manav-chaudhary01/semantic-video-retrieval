from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class VisualFrameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    timestamp: float
    frame_path: Optional[str] = None
    preview_url: str
    index_reference: Optional[int] = None


class VisualFrameListResponse(BaseModel):
    video_id: str
    total_frames: int
    frames: List[VisualFrameResponse]
