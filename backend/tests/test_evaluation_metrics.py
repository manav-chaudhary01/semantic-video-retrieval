import os
from pathlib import Path
import pytest

from evaluation.metrics import (
    calculate_tiou,
    is_interval_match,
    compute_retrieval_metrics,
    compute_latency_statistics,
    aggregate_query_metrics,
)
from evaluation.schema import (
    GroundTruthInterval,
    BenchmarkDataset,
    BenchmarkQuery,
    ConfigurationSummary,
    QueryEvaluationRecord,
)
from evaluation.run_benchmark import generate_evaluation_report


def test_tiou_calculation_edge_cases():
    """Validates Temporal IoU computation across edge cases and interval configurations."""
    # 1. Exact identical overlap
    assert calculate_tiou(2.0, 6.0, 2.0, 6.0) == pytest.approx(1.0)

    # 2. Completely disjoint intervals
    assert calculate_tiou(1.0, 3.0, 5.0, 7.0) == pytest.approx(0.0)

    # 3. Partial overlap: [0, 4] and [2, 6] -> inter=2, union=6, tIoU=1/3
    assert calculate_tiou(0.0, 4.0, 2.0, 6.0) == pytest.approx(1.0 / 3.0)

    # 4. Subset: [2, 4] inside [0, 6] -> inter=2, union=6, tIoU=1/3
    assert calculate_tiou(2.0, 4.0, 0.0, 6.0) == pytest.approx(1.0 / 3.0)

    # 5. Inverted boundaries: auto-corrected
    assert calculate_tiou(6.0, 2.0, 6.0, 2.0) == pytest.approx(1.0)

    # 6. Zero length intervals (no union)
    assert calculate_tiou(3.0, 3.0, 3.0, 3.0) == pytest.approx(0.0)


def test_is_interval_match_logic():
    """Validates interval matching criteria including video ID isolation, tIoU, and midpoint tolerance."""
    gt = [
        GroundTruthInterval(
            video_id="vid_1",
            start_time=10.0,
            end_time=20.0,
            description="Ground truth interval",
        )
    ]

    # 1. Matching video and high tIoU ([10, 20] vs [11, 19])
    assert is_interval_match("vid_1", 11.0, 19.0, gt, tiou_threshold=0.25) is True

    # 2. Different video ID: must fail even if timestamps match exactly
    assert is_interval_match("vid_2", 10.0, 20.0, gt, tiou_threshold=0.25) is False

    # 3. Low tIoU but midpoint is close ([14, 16], mid=15 is inside [10, 20])
    assert is_interval_match("vid_1", 14.0, 16.0, gt, tiou_threshold=0.5, midpoint_tolerance_sec=2.0) is True

    # 4. Completely outside interval: mid=35 is far from [10, 20]
    assert is_interval_match("vid_1", 30.0, 40.0, gt, tiou_threshold=0.25, midpoint_tolerance_sec=3.0) is False


def test_compute_retrieval_metrics():
    """Validates Precision@K, Recall@K, and MRR calculations."""
    gt = [
        GroundTruthInterval(video_id="v1", start_time=10.0, end_time=20.0),
        GroundTruthInterval(video_id="v1", start_time=50.0, end_time=60.0),
    ]

    # Scenario A: Top-1 hit
    results_a = [
        {"video_id": "v1", "start_time": 11.0, "end_time": 19.0},  # Hit
        {"video_id": "v1", "start_time": 70.0, "end_time": 80.0},  # Miss
    ]
    m_a = compute_retrieval_metrics(results_a, gt, ks=[1, 3, 5])
    assert m_a["recall@1"] == 0.5  # 1 hit out of 2 ground truths
    assert m_a["precision@1"] == 1.0
    assert m_a["mrr"] == 1.0

    # Scenario B: Second-rank hit (first hit at rank 2)
    results_b = [
        {"video_id": "v1", "start_time": 1.0, "end_time": 5.0},    # Miss
        {"video_id": "v1", "start_time": 10.0, "end_time": 20.0},  # Hit at rank 2
        {"video_id": "v1", "start_time": 50.0, "end_time": 60.0},  # Hit at rank 3
    ]
    m_b = compute_retrieval_metrics(results_b, gt, ks=[1, 3, 5])
    assert m_b["recall@1"] == 0.0
    assert m_b["precision@1"] == 0.0
    assert m_b["mrr"] == pytest.approx(0.5)  # 1 / 2
    assert m_b["recall@3"] == 1.0  # both hits found in top 3
    assert m_b["precision@3"] == pytest.approx(2.0 / 3.0, abs=1e-3)

    # Scenario C: Empty predictions
    m_c = compute_retrieval_metrics([], gt, ks=[1, 3, 5])
    assert m_c["recall@1"] == 0.0
    assert m_c["precision@1"] == 0.0
    assert m_c["mrr"] == 0.0


def test_unanswerable_query_metrics():
    """Validates metric calculation for unanswerable/negative queries."""
    # 1. Correct rejection (0 moments returned)
    m_clean = compute_retrieval_metrics([], ground_truths=[], is_unanswerable=True)
    assert m_clean["recall@1"] == 1.0
    assert m_clean["precision@1"] == 1.0
    assert m_clean["mrr"] == 1.0

    # 2. False positive (moments erroneously returned)
    m_fp = compute_retrieval_metrics(
        [{"video_id": "v1", "start_time": 0.0, "end_time": 5.0}],
        ground_truths=[],
        is_unanswerable=True,
    )
    assert m_fp["recall@1"] == 0.0
    assert m_fp["precision@1"] == 0.0
    assert m_fp["mrr"] == 0.0


def test_latency_statistics_calculation():
    """Validates mean, median, p95, min, max latency calculations."""
    # Empty
    assert compute_latency_statistics([]) == {"mean": 0.0, "median": 0.0, "p95": 0.0, "min": 0.0, "max": 0.0}

    # Odd length list: [10, 20, 30, 40, 50]
    lats_odd = [10.0, 50.0, 20.0, 40.0, 30.0]
    s_odd = compute_latency_statistics(lats_odd)
    assert s_odd["mean"] == 30.0
    assert s_odd["median"] == 30.0
    assert s_odd["min"] == 10.0
    assert s_odd["max"] == 50.0
    assert s_odd["p95"] == 50.0

    # Even length list: [10, 20, 30, 40]
    lats_even = [10.0, 20.0, 30.0, 40.0]
    s_even = compute_latency_statistics(lats_even)
    assert s_even["mean"] == 25.0
    assert s_even["median"] == 25.0


def test_benchmark_report_generation(tmp_path):
    """Verifies markdown report generator produces complete structured documentation."""
    dataset = BenchmarkDataset(
        version="1.0.0",
        dataset_name="Test Benchmark",
        description="Testing report generator",
        corpus_video_ids=["v1"],
        queries=[
            BenchmarkQuery(
                query_id="Q01",
                query="Test query",
                query_type="dialogue_only",
                expected_relevant_video_ids=["v1"],
                ground_truth_intervals=[
                    GroundTruthInterval(video_id="v1", start_time=0.0, end_time=5.0)
                ],
            )
        ],
    )

    summary = ConfigurationSummary(
        configuration_name="Multimodal Balanced (50/50 Linear)",
        description="Balanced linear fusion",
        modality="multimodal",
        alpha=0.5,
        beta=0.5,
        fusion_method="linear",
        temporal_window_sec=10.0,
        aggregate_metrics={"recall@1": 1.0, "precision@1": 1.0, "mrr": 1.0},
        metrics_by_query_type={"dialogue_only": {"recall@1": 1.0, "mrr": 1.0}},
        latency_stats={"mean": 35.0, "median": 34.0, "p95": 40.0, "min": 30.0, "max": 42.0},
    )

    record = QueryEvaluationRecord(
        query_id="Q01",
        query_text="Test query",
        query_type="dialogue_only",
        configuration_name="Multimodal Balanced (50/50 Linear)",
        latency_ms=35.0,
        total_results=1,
        is_unanswerable=False,
        retrieved_moments=[{"start_time": 0.0, "end_time": 5.0, "score": 0.88}],
        metrics={"recall@1": 1.0, "precision@1": 1.0, "mrr": 1.0},
    )

    report_file = tmp_path / "TEST_REPORT.md"
    generate_evaluation_report(
        dataset=dataset,
        summaries=[summary],
        all_records={"Multimodal Balanced (50/50 Linear)": [record]},
        thresholded_summaries=[summary],
        output_path=report_file,
    )

    assert report_file.exists()
    content = report_file.read_text(encoding="utf-8")
    assert "Evaluation, Benchmarking, and" in content
    assert "Multimodal Balanced (50/50 Linear)" in content
    assert "Mean Lat (ms)" in content
    assert "Q01" in content
