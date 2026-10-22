import math
from typing import List, Dict, Any, Optional
from evaluation.schema import GroundTruthInterval, QueryEvaluationRecord


def calculate_tiou(r_start: float, r_end: float, g_start: float, g_end: float) -> float:
    """Computes Temporal Intersection-over-Union (tIoU) between a retrieved interval and a ground-truth interval."""
    # Ensure valid interval orders
    r1, r2 = min(r_start, r_end), max(r_start, r_end)
    g1, g2 = min(g_start, g_end), max(g_start, g_end)

    intersection = max(0.0, min(r2, g2) - max(r1, g1))
    union = max(r2, g2) - min(r1, g1)

    if union <= 1e-6:
        return 0.0

    return intersection / union


def is_interval_match(
    retrieved_video_id: str,
    retrieved_start: float,
    retrieved_end: float,
    ground_truths: List[GroundTruthInterval],
    tiou_threshold: float = 0.25,
    midpoint_tolerance_sec: float = 3.0,
) -> bool:
    """Checks if a retrieved video interval matches any ground-truth interval.
    
    A match is verified if:
    1. Video ID matches, AND
    2. EITHER Temporal IoU >= tiou_threshold OR retrieved interval midpoint falls within
       ground-truth window expanded by midpoint_tolerance_sec.
    """
    r_mid = (retrieved_start + retrieved_end) / 2.0

    for gt in ground_truths:
        if gt.video_id != retrieved_video_id:
            continue

        # Check tIoU
        tiou = calculate_tiou(retrieved_start, retrieved_end, gt.start_time, gt.end_time)
        if tiou >= tiou_threshold:
            return True

        # Check midpoint containment with tolerance
        if (gt.start_time - midpoint_tolerance_sec) <= r_mid <= (gt.end_time + midpoint_tolerance_sec):
            return True

    return False


def compute_retrieval_metrics(
    retrieved_moments: List[Dict[str, Any]],
    ground_truths: List[GroundTruthInterval],
    is_unanswerable: bool = False,
    ks: List[int] = [1, 3, 5],
    tiou_threshold: float = 0.25,
    midpoint_tolerance_sec: float = 3.0,
) -> Dict[str, float]:
    """Computes Recall@K, Precision@K, and MRR for a single query."""
    max_k = max(ks) if ks else 5
    metrics: Dict[str, float] = {}

    # Handle unanswerable / negative queries
    if is_unanswerable:
        # If no results returned (or filtered by threshold), perfect rejection
        if len(retrieved_moments) == 0:
            for k in ks:
                metrics[f"recall@{k}"] = 1.0
                metrics[f"precision@{k}"] = 1.0
            metrics["mrr"] = 1.0
        else:
            # False positive hits on non-existent content
            for k in ks:
                metrics[f"recall@{k}"] = 0.0
                metrics[f"precision@{k}"] = 0.0
            metrics["mrr"] = 0.0
        return metrics

    # Normal relevant query with ground-truth moments
    if not ground_truths:
        for k in ks:
            metrics[f"recall@{k}"] = 0.0
            metrics[f"precision@{k}"] = 0.0
        metrics["mrr"] = 0.0
        return metrics

    # Check relevance for each retrieved item in ranked order
    is_relevant: List[bool] = []
    first_hit_rank: Optional[int] = None

    for rank_idx, item in enumerate(retrieved_moments[:max_k]):
        vid = item.get("video_id", "")
        start = float(item.get("start_time", 0.0))
        end = float(item.get("end_time", 0.0))

        match = is_interval_match(
            retrieved_video_id=vid,
            retrieved_start=start,
            retrieved_end=end,
            ground_truths=ground_truths,
            tiou_threshold=tiou_threshold,
            midpoint_tolerance_sec=midpoint_tolerance_sec,
        )
        is_relevant.append(match)
        if match and first_hit_rank is None:
            first_hit_rank = rank_idx + 1

    total_gt = len(ground_truths)

    for k in ks:
        k_hits = is_relevant[:k]
        num_relevant = sum(1 for h in k_hits if h)
        metrics[f"precision@{k}"] = round(num_relevant / float(k), 4)
        metrics[f"recall@{k}"] = round(min(1.0, num_relevant / float(total_gt)), 4)

    metrics["mrr"] = round(1.0 / first_hit_rank, 4) if first_hit_rank is not None else 0.0
    return metrics


def compute_latency_statistics(latencies_ms: List[float]) -> Dict[str, float]:
    """Computes mean, median, p95, min, and max latency statistics in milliseconds."""
    if not latencies_ms:
        return {"mean": 0.0, "median": 0.0, "p95": 0.0, "min": 0.0, "max": 0.0}

    sorted_lats = sorted(latencies_ms)
    n = len(sorted_lats)

    mean_val = sum(sorted_lats) / n
    # Median
    if n % 2 == 1:
        median_val = sorted_lats[n // 2]
    else:
        median_val = (sorted_lats[n // 2 - 1] + sorted_lats[n // 2]) / 2.0

    # 95th percentile
    p95_idx = min(int(math.ceil(0.95 * n)) - 1, n - 1)
    p95_val = sorted_lats[max(0, p95_idx)]

    return {
        "mean": round(mean_val, 2),
        "median": round(median_val, 2),
        "p95": round(p95_val, 2),
        "min": round(sorted_lats[0], 2),
        "max": round(sorted_lats[-1], 2),
    }


def aggregate_query_metrics(records: List[QueryEvaluationRecord]) -> Dict[str, float]:
    """Computes the mean across all per-query evaluation metrics."""
    if not records:
        return {}

    metric_keys = list(records[0].metrics.keys())
    aggregated: Dict[str, float] = {}

    for k in metric_keys:
        vals = [r.metrics[k] for r in records if k in r.metrics]
        aggregated[k] = round(sum(vals) / len(vals), 4) if vals else 0.0

    return aggregated
