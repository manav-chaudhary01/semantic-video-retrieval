from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class GroundTruthInterval(BaseModel):
    video_id: str = Field(..., description="Target video identifier")
    start_time: float = Field(..., description="Ground truth interval start time in seconds")
    end_time: float = Field(..., description="Ground truth interval end time in seconds")
    description: Optional[str] = Field(None, description="Human description of the ground truth moment")


class BenchmarkQuery(BaseModel):
    query_id: str = Field(..., description="Unique query identifier, e.g. Q01")
    query: str = Field(..., description="Natural language search query text")
    query_type: str = Field(
        ...,
        description="Query category: 'dialogue_only', 'visual_only', 'multimodal', or 'unanswerable'",
    )
    expected_relevant_video_ids: List[str] = Field(
        default_factory=list,
        description="List of video IDs that contain ground-truth matches",
    )
    ground_truth_intervals: List[GroundTruthInterval] = Field(
        default_factory=list,
        description="Ground-truth temporal intervals where the query concept is demonstrated",
    )
    is_unanswerable: bool = Field(
        False,
        description="True if the query represents an out-of-domain / non-existent concept",
    )
    notes: Optional[str] = Field(None, description="Annotation rationale and notes")


class BenchmarkDataset(BaseModel):
    version: str = "1.0.0"
    dataset_name: str = "Semantic Video Retrieval Benchmark (Exploratory)"
    description: str = (
        "Version-controlled academic evaluation dataset containing dialogue-only, "
        "visual-only, multimodal, and unanswerable queries with ground-truth temporal intervals."
    )
    created_at: str = "2026-10-22"
    corpus_video_ids: List[str] = Field(default_factory=list)
    queries: List[BenchmarkQuery] = Field(default_factory=list)


class QueryEvaluationRecord(BaseModel):
    query_id: str
    query_text: str
    query_type: str
    configuration_name: str
    latency_ms: float
    total_results: int
    is_unanswerable: bool
    retrieved_moments: List[Dict[str, Any]]
    metrics: Dict[str, float]


class ConfigurationSummary(BaseModel):
    configuration_name: str
    description: str
    modality: str
    alpha: float
    beta: float
    fusion_method: str
    temporal_window_sec: float
    aggregate_metrics: Dict[str, float]
    metrics_by_query_type: Dict[str, Dict[str, float]]
    latency_stats: Dict[str, float]
