from typing import Optional, List
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., max_length=500, description="Natural-language search query")
    video_id: Optional[str] = Field(None, description="Optional video ID to filter search to a single video")
    top_k: int = Field(5, ge=1, le=50, description="Maximum number of results to return")
    modality: str = Field("text", description="Search modality: 'text', 'visual', or 'multimodal'")
    threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum similarity score threshold")
    alpha: float = Field(0.5, ge=0.0, le=1.0, description="Weight for text modality in multimodal fusion (alpha)")
    beta: float = Field(0.5, ge=0.0, le=1.0, description="Weight for visual modality in multimodal fusion (beta)")
    fusion_method: str = Field("linear", description="Fusion algorithm: 'linear' or 'rrf'")
    temporal_window_sec: float = Field(10.0, ge=1.0, le=60.0, description="Window in seconds for grouping temporal evidence")


class SearchResultItem(BaseModel):
    segment_id: Optional[str] = None
    frame_id: Optional[str] = None
    video_id: str
    video_title: str
    start_time: float
    end_time: float
    peak_time: Optional[float] = None
    text: str
    score: float
    confidence_percent: float
    text_score: Optional[float] = None
    visual_score: Optional[float] = None
    fused_score: Optional[float] = None
    modality: str = "text"
    preview_url: Optional[str] = None
    stream_url: str


class SearchResponse(BaseModel):
    query: str
    modality: str
    total_results: int
    results: List[SearchResultItem]
    latency_ms: float
