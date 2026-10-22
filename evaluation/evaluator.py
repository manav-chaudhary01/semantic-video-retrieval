import time
from typing import List, Dict, Any, Optional, Tuple

from backend.app.db.session import SessionLocal
from backend.app.services.search_service import search_service
from backend.app.schemas.search import SearchRequest
from evaluation.schema import (
    BenchmarkDataset,
    BenchmarkQuery,
    QueryEvaluationRecord,
    ConfigurationSummary,
)
from evaluation.metrics import (
    compute_retrieval_metrics,
    compute_latency_statistics,
    aggregate_query_metrics,
)


EVALUATION_CONFIGURATIONS = [
    {
        "name": "Text-Only (all-MiniLM-L6-v2)",
        "modality": "text",
        "alpha": 1.0,
        "beta": 0.0,
        "fusion_method": "linear",
        "temporal_window_sec": 10.0,
        "description": "Baseline dialogue-only retrieval using Sentence Transformers 384-d FAISS index.",
    },
    {
        "name": "Visual-Only (CLIP ViT-B-32)",
        "modality": "visual",
        "alpha": 0.0,
        "beta": 1.0,
        "fusion_method": "linear",
        "temporal_window_sec": 10.0,
        "description": "Baseline visual scene retrieval using OpenAI CLIP 512-d FAISS index.",
    },
    {
        "name": "Multimodal Balanced (50/50 Linear)",
        "modality": "multimodal",
        "alpha": 0.5,
        "beta": 0.5,
        "fusion_method": "linear",
        "temporal_window_sec": 10.0,
        "description": "Equal-weight linear fusion with calibrated min-max score normalization.",
    },
    {
        "name": "Multimodal Dialogue-Focused (70/30 Linear)",
        "modality": "multimodal",
        "alpha": 0.7,
        "beta": 0.3,
        "fusion_method": "linear",
        "temporal_window_sec": 10.0,
        "description": "Linear score fusion with 70% dialogue weight and 30% visual weight.",
    },
    {
        "name": "Multimodal Visual-Focused (30/70 Linear)",
        "modality": "multimodal",
        "alpha": 0.3,
        "beta": 0.7,
        "fusion_method": "linear",
        "temporal_window_sec": 10.0,
        "description": "Linear score fusion with 30% dialogue weight and 70% visual weight.",
    },
    {
        "name": "Multimodal Reciprocal Rank Fusion (RRF)",
        "modality": "multimodal",
        "alpha": 0.5,
        "beta": 0.5,
        "fusion_method": "rrf",
        "temporal_window_sec": 10.0,
        "description": "Scale-invariant Reciprocal Rank Fusion over candidate ranks.",
    },
]


class BenchmarkEvaluator:
    """Executes benchmark evaluations across search configurations and calculates formal metrics."""

    def __init__(self, tiou_threshold: float = 0.25, midpoint_tolerance_sec: float = 3.0):
        self.tiou_threshold = tiou_threshold
        self.midpoint_tolerance_sec = midpoint_tolerance_sec

    def evaluate_query(
        self,
        query: BenchmarkQuery,
        cfg: Dict[str, Any],
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> QueryEvaluationRecord:
        """Evaluates a single query against a given retrieval configuration."""
        req = SearchRequest(
            query=query.query,
            modality=cfg["modality"],
            alpha=cfg["alpha"],
            beta=cfg["beta"],
            fusion_method=cfg["fusion_method"],
            temporal_window_sec=cfg["temporal_window_sec"],
            top_k=top_k,
            threshold=threshold,
        )

        with SessionLocal() as db:
            start_t = time.perf_counter()
            resp = search_service.search(db, req)
            latency = (time.perf_counter() - start_t) * 1000.0

        retrieved_moments = [
            {
                "video_id": item.video_id,
                "start_time": item.start_time,
                "end_time": item.end_time,
                "score": item.score,
                "modality": item.modality,
                "text": item.text,
            }
            for item in resp.results
        ]

        metrics = compute_retrieval_metrics(
            retrieved_moments=retrieved_moments,
            ground_truths=query.ground_truth_intervals,
            is_unanswerable=query.is_unanswerable,
            ks=[1, 3, 5],
            tiou_threshold=self.tiou_threshold,
            midpoint_tolerance_sec=self.midpoint_tolerance_sec,
        )

        return QueryEvaluationRecord(
            query_id=query.query_id,
            query_text=query.query,
            query_type=query.query_type,
            configuration_name=cfg["name"],
            latency_ms=round(latency, 2),
            total_results=len(retrieved_moments),
            is_unanswerable=query.is_unanswerable,
            retrieved_moments=retrieved_moments,
            metrics=metrics,
        )

    def evaluate_configuration(
        self,
        dataset: BenchmarkDataset,
        cfg: Dict[str, Any],
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> Tuple[ConfigurationSummary, List[QueryEvaluationRecord]]:
        """Evaluates all queries in the benchmark dataset for a single configuration."""
        query_records: List[QueryEvaluationRecord] = []
        latencies: List[float] = []

        for q in dataset.queries:
            rec = self.evaluate_query(q, cfg, top_k=top_k, threshold=threshold)
            query_records.append(rec)
            latencies.append(rec.latency_ms)

        aggregate = aggregate_query_metrics(query_records)
        lat_stats = compute_latency_statistics(latencies)

        # Compute breakdown by query type
        by_type: Dict[str, List[QueryEvaluationRecord]] = {}
        for r in query_records:
            by_type.setdefault(r.query_type, []).append(r)

        metrics_by_type: Dict[str, Dict[str, float]] = {}
        for q_type, recs in by_type.items():
            metrics_by_type[q_type] = aggregate_query_metrics(recs)

        summary = ConfigurationSummary(
            configuration_name=cfg["name"],
            description=cfg["description"],
            modality=cfg["modality"],
            alpha=cfg["alpha"],
            beta=cfg["beta"],
            fusion_method=cfg["fusion_method"],
            temporal_window_sec=cfg["temporal_window_sec"],
            aggregate_metrics=aggregate,
            metrics_by_query_type=metrics_by_type,
            latency_stats=lat_stats,
        )

        return summary, query_records
