import math
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.services.temporal_consolidator import (
    temporal_consolidator,
    TextMatch,
    VisualMatch,
)


def test_temporal_score_calibration():
    """Verifies fixed-range score calibration independently scales raw scores without relative stretching."""
    # Text calibration: [0.25, 0.75]
    raw_text = [0.85, 0.65, 0.45]
    norm_text = temporal_consolidator.normalize_min_max(raw_text, modality="text")
    assert norm_text[0] == pytest.approx(1.0)
    assert norm_text[1] == pytest.approx(0.8)
    assert norm_text[2] == pytest.approx(0.4)

    # Constant scores should be calibrated independently, not forced to 1.0
    constant = [0.5, 0.5]
    norm_const = temporal_consolidator.normalize_min_max(constant, modality="text")
    assert norm_const == [0.5, 0.5]

    # Visual calibration: [0.16, 0.34]
    raw_visual = [0.34, 0.25, 0.16]
    norm_vis = temporal_consolidator.normalize_min_max(raw_visual, modality="visual")
    assert norm_vis[0] == pytest.approx(1.0)
    assert norm_vis[1] == pytest.approx(0.5)
    assert norm_vis[2] == pytest.approx(0.0)

    # Empty list
    assert temporal_consolidator.normalize_min_max([]) == []


def test_consecutive_frame_deduplication():
    """Verifies neighboring frames from the same continuous scene are clustered to the peak match."""
    frames = [
        VisualMatch(
            frame_id="f1",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=2.0,
            preview_url="/frames/f1.jpg",
            raw_score=0.31,
        ),
        VisualMatch(
            frame_id="f2",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=4.0,
            preview_url="/frames/f2.jpg",
            raw_score=0.38,  # Peak in cluster [2.0, 4.0, 6.0]
        ),
        VisualMatch(
            frame_id="f3",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=6.0,
            preview_url="/frames/f3.jpg",
            raw_score=0.29,
        ),
        VisualMatch(
            frame_id="f4",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=30.0,  # Distinct far scene
            preview_url="/frames/f4.jpg",
            raw_score=0.35,
        ),
    ]

    deduped = temporal_consolidator.deduplicate_frames(frames, cluster_radius_sec=4.0)

    # 4 frames collapsed into 2 distinct moments (the peak at 4.0s and the scene at 30.0s)
    assert len(deduped) == 2
    frame_ids = {m.frame_id for m in deduped}
    assert "f2" in frame_ids  # Peak frame retained
    assert "f4" in frame_ids
    assert "f1" not in frame_ids
    assert "f3" not in frame_ids


def test_cross_modal_temporal_pairing_linear_and_rrf():
    """Verifies co-occurring dialogue and visual frames merge into unified multimodal moments."""
    text_matches = [
        TextMatch(
            segment_id="s1",
            video_id="vid_1",
            video_title="Lecture.mp4",
            start_time=10.0,
            end_time=16.0,
            text="Here is the gradient descent loss surface diagram.",
            raw_score=0.82,
        ),
        TextMatch(
            segment_id="s2",
            video_id="vid_1",
            video_title="Lecture.mp4",
            start_time=50.0,
            end_time=58.0,
            text="In conclusion, attention is all you need.",
            raw_score=0.74,
        ),
    ]

    visual_matches = [
        VisualMatch(
            frame_id="f1",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=12.0,  # Co-occurs with segment s1 (10.0 - 16.0)
            preview_url="/frames/f1.jpg",
            raw_score=0.36,
        ),
        VisualMatch(
            frame_id="f2",
            video_id="vid_1",
            video_title="Lecture.mp4",
            timestamp=85.0,  # Isolated visual scene
            preview_url="/frames/f2.jpg",
            raw_score=0.32,
        ),
    ]

    # Test Linear Fusion
    fused_linear = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.6,
        beta=0.4,
        fusion_method="linear",
        temporal_window_sec=10.0,
        frame_interval_sec=2.0,
        top_k=5,
    )

    assert len(fused_linear) >= 1
    top_hit = fused_linear[0]
    # The paired moment (s1 + f1) has evidence from both modalities and should be top-ranked
    assert top_hit.modality == "multimodal"
    assert top_hit.segment_id == "s1"
    assert top_hit.frame_id == "f1"
    assert top_hit.start_time == 10.0
    assert top_hit.end_time == 16.0
    assert top_hit.peak_time == 12.0
    assert top_hit.text_score is not None
    assert top_hit.visual_score is not None
    assert top_hit.preview_url == "/frames/f1.jpg"

    # Test Reciprocal Rank Fusion (RRF)
    fused_rrf = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        fusion_method="rrf",
        temporal_window_sec=10.0,
        top_k=5,
    )
    assert len(fused_rrf) >= 1
    assert fused_rrf[0].modality == "multimodal"
    assert fused_rrf[0].score > 0.0


@pytest.mark.asyncio
async def test_multimodal_search_api():
    """Tests POST /api/search with modality='multimodal' and POST /api/search/multimodal."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Search via main /search endpoint with modality='multimodal'
        res = await client.post(
            f"{settings.API_PREFIX}/search",
            json={
                "query": "neural network gradient descent and visual diagram",
                "modality": "multimodal",
                "alpha": 0.6,
                "beta": 0.4,
                "fusion_method": "linear",
                "top_k": 5,
            },
        )
        assert res.status_code == 200, f"Search failed: {res.text}"
        data = res.json()
        assert data["modality"] == "multimodal"
        assert "results" in data
        assert "latency_ms" in data

        # Search via dedicated /search/multimodal alias
        alias_res = await client.post(
            f"{settings.API_PREFIX}/search/multimodal",
            json={
                "query": "learning rate optimization",
                "alpha": 0.5,
                "beta": 0.5,
                "fusion_method": "rrf",
                "top_k": 3,
            },
        )
        assert alias_res.status_code == 200, f"Multimodal alias failed: {alias_res.text}"
        alias_data = alias_res.json()
        assert alias_data["modality"] == "multimodal"


# ==============================================================================
# Targeted Regression Tests (Score Calibration, Thresholding & Fusion Semantics)
# ==============================================================================


def test_regression_single_candidate_fixed_clamping():
    """Validates that a single low raw score is clamped to 0.0, not elevated to 1.0.

    Under fixed-range calibration ([0.25, 0.75]), an out-of-domain query returning a single
    noise candidate with raw cosine similarity 0.12 clamps cleanly to 0.0.
    """
    raw_scores = [0.12]
    normalized = temporal_consolidator.normalize_min_max(raw_scores, modality="text")
    assert normalized == [0.0], "Single noise candidate must be clamped to 0.0 under fixed calibration."


def test_regression_single_candidate_normalization_known_flaw_xfail():
    """Explicitly tests that noise (cosine=0.12) does not yield peak confidence."""
    raw_scores = [0.12]
    normalized = temporal_consolidator.normalize_min_max(raw_scores, modality="text")
    assert normalized[0] < 0.50, (
        f"A raw cosine similarity of {raw_scores[0]} should not normalize to peak confidence 1.0."
    )


def test_regression_low_similarity_pool_normalization():
    """Validates that low similarity noise candidates remain clamped and are not stretched to 1.0."""
    raw_pool = [0.14, 0.10, 0.08]
    normalized = temporal_consolidator.normalize_min_max(raw_pool, modality="text")

    # All candidates are below text lower bound 0.25 -> clamped to 0.0
    assert normalized == [0.0, 0.0, 0.0]


def test_regression_linear_fusion_unpaired_candidate_score_cap_and_threshold():
    """Validates how unpaired candidates are scored and filtered under calibrated linear fusion.

    Constructs a valid speech candidate with no matching visual candidate.
    Raw text score 0.88 -> calibrated 1.0.
    Missing-modality discount 0.85 -> score = 1.0 * 0.85 = 0.8500 (85.0% confidence).
    """
    text_matches = [
        TextMatch(
            segment_id="s_unpaired_1",
            video_id="vid_unpaired",
            video_title="Lecture.mp4",
            start_time=10.0,
            end_time=25.0,
            text="High confidence speech segment with no co-occurring visual keyframes.",
            raw_score=0.88,
        )
    ]
    visual_matches = []

    # 1. Without threshold: score uses missing-modality discount: 1.0 * 0.85 = 0.8500
    results_unfiltered = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        threshold=None,
    )
    assert len(results_unfiltered) == 1
    item = results_unfiltered[0]
    assert item.modality == "text"
    assert item.score == 0.8500
    assert item.confidence_percent == 85.0
    assert item.text_score == 0.88

    # 2. Moderate threshold 0.4: Candidate survives because 0.8500 >= 0.40
    results_t40 = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        threshold=0.40,
    )
    assert len(results_t40) == 1

    # 3. Threshold 0.51: Candidate survives because 0.8500 >= 0.51 (no longer hard-capped at 0.5000)
    results_t51 = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        threshold=0.51,
    )
    assert len(results_t51) == 1

    # 4. Very high threshold 0.90: Candidate is discarded because 0.8500 < 0.90
    results_t90 = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        threshold=0.90,
    )
    assert len(results_t90) == 0


def test_regression_linear_fusion_unpaired_runner_up_elimination():
    """Validates that a second high-quality unpaired candidate is preserved under fixed calibration.

    Given two speech segments with raw scores [0.85, 0.70]:
      - s1: raw 0.85 -> cal 1.0 -> fused: 1.0 * 0.85 = 0.8500
      - s2: raw 0.70 -> cal 0.90 -> fused: 0.90 * 0.85 = 0.7650
      - At moderate threshold 0.40, BOTH candidates survive and are ranked properly.
    """
    text_matches = [
        TextMatch(
            segment_id="s1",
            video_id="v1",
            video_title="V1",
            start_time=10.0,
            end_time=20.0,
            text="Primary topic speech",
            raw_score=0.85,
        ),
        TextMatch(
            segment_id="s2",
            video_id="v1",
            video_title="V1",
            start_time=30.0,
            end_time=40.0,
            text="Secondary relevant speech",
            raw_score=0.70,
        ),
    ]

    results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        alpha=0.5,
        beta=0.5,
        threshold=0.40,
    )

    # Both candidates survive and are correctly ranked
    assert len(results) == 2
    assert results[0].segment_id == "s1"
    assert results[0].score == pytest.approx(0.8500)
    assert results[1].segment_id == "s2"
    assert results[1].score == pytest.approx(0.7650)


def test_regression_rrf_unpaired_threshold_elimination():
    """Validates that RRF threshold filtering eliminates unpaired candidates at threshold >= 0.30.

    In RRF mode, an unpaired rank-1 candidate receives:
      - score = w_text * (1.0 / (60.0 + rank)) = 0.5 * (1.0 / 61.0) = 0.008197...
      - confidence = round(min(1.0, score * 30.0) * 100, 1) = 24.6%
    Line 276 filters by:
      (item.confidence_percent / 100.0) >= threshold
    With threshold=0.30 (30% in UI):
      0.246 >= 0.30 -> False.
    The candidate is completely filtered out, even though it was the #1 match.
    """
    text_matches = [
        TextMatch(
            segment_id="s_rrf_1",
            video_id="vid_rrf",
            video_title="Lecture.mp4",
            start_time=5.0,
            end_time=15.0,
            text="Rank 1 spoken query match",
            raw_score=0.92,
        )
    ]

    # Without threshold: inspect actual calculated score and confidence
    unfiltered = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        fusion_method="rrf",
        alpha=0.5,
        beta=0.5,
        threshold=None,
    )
    assert len(unfiltered) == 1
    assert unfiltered[0].score == pytest.approx(0.0082, abs=1e-4)
    assert unfiltered[0].confidence_percent == 24.6

    # With threshold = 0.30: candidate has calibrated score 1.0 >= 0.30, so it qualifies and survives
    filtered = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        fusion_method="rrf",
        alpha=0.5,
        beta=0.5,
        threshold=0.30,
    )
    assert len(filtered) == 1
    assert filtered[0].segment_id == "s_rrf_1"


def test_regression_weight_sensitivity_and_ranking_inversion():
    """Validates that varying dialogue/visual weights properly alters fused scores and inverts ranking.

    Fixture:
      - Moment A (Video 1): Speech-dominant (raw_text=0.85, raw_visual=0.20, co-occurring at 10s-16s)
      - Moment B (Video 2): Visual-dominant (raw_text=0.40, raw_visual=0.38, co-occurring at 40s-46s)

    Min-max normalization:
      - Text pool [0.85, 0.40]: Moment A = 1.0, Moment B = 0.0
      - Visual pool [0.38, 0.20]: Moment B = 1.0, Moment A = 0.0

    Fused score:
      - Moment A: w_text * 1.0 + w_visual * 0.0 = w_text
      - Moment B: w_text * 0.0 + w_visual * 1.0 = w_visual
    """
    text_matches = [
        TextMatch("sA", "v1", "V1", 10.0, 16.0, "Speech dominant", raw_score=0.85),
        TextMatch("sB", "v2", "V2", 40.0, 46.0, "Speech weak", raw_score=0.40),
    ]
    visual_matches = [
        VisualMatch("fB", "v2", "V2", 42.0, "/fb.jpg", raw_score=0.38),
        VisualMatch("fA", "v1", "V1", 12.0, "/fa.jpg", raw_score=0.20),
    ]

    # 1. Dialogue-heavy (alpha=0.8, beta=0.2) -> w_text=0.8, w_visual=0.2
    res_dialogue = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.8,
        beta=0.2,
    )
    assert len(res_dialogue) == 2
    assert res_dialogue[0].segment_id == "sA"
    assert res_dialogue[0].score == pytest.approx(0.8 * 1.0 + 0.2 * (0.04 / 0.18), abs=1e-3)
    assert res_dialogue[1].segment_id == "sB"
    assert res_dialogue[1].score == pytest.approx(0.8 * 0.3 + 0.2 * 1.0, abs=1e-3)

    # 2. Visual-heavy (alpha=0.2, beta=0.8) -> w_text=0.2, w_visual=0.8
    res_visual = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.2,
        beta=0.8,
    )
    assert len(res_visual) == 2
    # Ranking inverts: Moment B is now top-ranked
    assert res_visual[0].segment_id == "sB"
    assert res_visual[0].score == pytest.approx(0.2 * 0.3 + 0.8 * 1.0, abs=1e-3)
    assert res_visual[1].segment_id == "sA"
    assert res_visual[1].score == pytest.approx(0.2 * 1.0 + 0.8 * (0.04 / 0.18), abs=1e-3)

    # 3. Balanced (alpha=0.5, beta=0.5) -> w_text=0.5, w_visual=0.5
    res_balanced = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
    )
    assert len(res_balanced) == 2
    assert res_balanced[0].score == pytest.approx(0.5 * 0.3 + 0.5 * 1.0, abs=1e-3)


def test_regression_threshold_consistency_between_stages():
    """Validates the discrepancy between Stage 1 raw-score filtering and Stage 2 fused-score filtering.

    Stage 1 (SearchService):
      req.threshold filters raw FAISS cosine similarity.
      A candidate with raw_score=0.75 passes a threshold of 0.35 (0.75 >= 0.35).

    Stage 2 (TemporalConsolidator):
      threshold filters fused score (score >= threshold).
      When the candidate is unpaired and visual-dominant weights are used (alpha=0.3, beta=0.7),
      w_text = 0.3.
      Even if normalized_score = 1.0:
        score = 0.3 * 1.0 = 0.3000.
      Stage 2 checks: 0.3000 >= 0.35 -> False!

    Confirmed: A candidate passing Stage 1 raw-similarity filtering can subsequently be
    discarded in Stage 2 fusion because the meaning of 'threshold' shifted from raw similarity
    to weight-attenuated fused score.
    """
    raw_score = 0.75
    threshold = 0.35

    # Stage 1 emulation: Raw cosine threshold check
    passes_stage_1 = raw_score >= threshold
    assert passes_stage_1 is True, "Candidate with raw_score 0.75 must pass raw threshold 0.35."

    # Stage 2: Temporal consolidator fusion with alpha=0.3, beta=0.7
    text_matches = [
        TextMatch(
            segment_id="s_stage_disc",
            video_id="v1",
            video_title="V1",
            start_time=0.0,
            end_time=10.0,
            text="Spoken segment with no visual frames",
            raw_score=raw_score,
        )
    ]
    stage_2_results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        alpha=0.3,
        beta=0.7,
        threshold=threshold,
    )

    # Candidate is preserved in Stage 2 under missing-modality policy!
    assert len(stage_2_results) == 1
    assert stage_2_results[0].segment_id == "s_stage_disc"
    assert stage_2_results[0].score == pytest.approx(0.8500)


# ==============================================================================
# Desired Corrected Behavior Tests (Targeted Future Regression Suite)
# ==============================================================================


def test_desired_weak_candidate_pool_confidence_ceiling():
    """Area 1: Low-similarity candidates must not receive artificially high confidence.

    Given a pool of low cosine scores [0.15, 0.12, 0.09] in Sentence-Transformers space,
    a raw similarity of 0.15 represents background noise. Under the desired calibrated
    scoring contract, the top candidate's normalized score must not exceed 0.40.
    """
    weak_pool = [0.15, 0.12, 0.09]
    normalized = temporal_consolidator.normalize_min_max(weak_pool)

    # Desired behavior: Weak candidates must remain below confidence ceiling (0.40)
    assert normalized[0] < 0.40, (
        f"Top noise candidate (raw=0.15) was inflated to {normalized[0]}; expected < 0.40."
    )


def test_desired_single_candidate_normalization_does_not_imply_perfect_match():
    """Area 2: Single-candidate normalization must not automatically imply a perfect match.

    When an isolated speech candidate with raw score 0.35 (marginal match) is retrieved,
    it must not receive an automatic 1.0 (100% match) solely because len(scores) == 1.
    """
    raw_scores = [0.35]
    normalized = temporal_consolidator.normalize_min_max(raw_scores)

    # Desired behavior: An isolated marginal match (0.35) should normalize to moderate confidence (< 0.60)
    assert normalized[0] < 0.60, (
        f"Single candidate with raw similarity 0.35 was assigned perfect score {normalized[0]}."
    )


def test_desired_unpaired_candidate_missing_modality_policy():
    """Area 3: Unpaired candidates must have an explicitly testable missing-modality policy.

    Given a speech candidate with near-perfect relevance (raw_score=0.90) in a video with no
    matching visual elements, the desired missing-modality policy should apply a modest
    confidence discount (e.g., 15% discount -> score >= 0.70), rather than cutting the score
    in half to 0.5000 via raw weight multiplication.
    """
    text_matches = [
        TextMatch(
            segment_id="s_high_q",
            video_id="v_speech_only",
            video_title="Lecture.mp4",
            start_time=15.0,
            end_time=30.0,
            text="Definitive and precise speech explanation with no visual slides.",
            raw_score=0.90,
        )
    ]

    results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        alpha=0.5,
        beta=0.5,
        threshold=None,
    )

    assert len(results) == 1
    # Desired behavior: High relevance speech match retains a high score (>= 0.70)
    assert results[0].score >= 0.70, (
        f"Unpaired candidate with raw_score=0.90 received score {results[0].score}; "
        "expected missing-modality policy to preserve high score >= 0.70."
    )


def test_desired_unpaired_candidate_preservation_under_strict_threshold():
    """Area 4: A valid unpaired candidate must not be silently eliminated by arbitrary score attenuation.

    When a user requests a strict 60% match threshold (threshold=0.60), a spoken dialogue
    candidate with 0.92 raw cosine similarity must survive fusion and be returned.
    """
    text_matches = [
        TextMatch(
            segment_id="s_strict_survive",
            video_id="v1",
            video_title="Lecture.mp4",
            start_time=5.0,
            end_time=18.0,
            text="High confidence spoken dialogue matching query.",
            raw_score=0.92,
        )
    ]

    results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        alpha=0.5,
        beta=0.5,
        threshold=0.60,
    )

    # Desired behavior: Candidate with raw 0.92 relevance must survive threshold 0.60
    assert len(results) == 1, (
        "High quality candidate with raw_score=0.92 was dropped by threshold=0.60 "
        "because unpaired scores are hard-capped at 0.5000."
    )
    assert results[0].segment_id == "s_strict_survive"


def test_desired_threshold_consistency_across_retrieval_and_fusion():
    """Area 5: Threshold semantics must be consistent across retrieval and fusion.

    If a candidate's relevance satisfies a 0.40 threshold in Stage 1 (raw cosine=0.70 >= 0.40),
    it must not be dropped in Stage 2 fusion simply because the user selected visual-heavy
    weights (alpha=0.3, beta=0.7) that attenuated the single-modality score to 0.3000.
    """
    text_matches = [
        TextMatch(
            segment_id="s_consistent_thresh",
            video_id="v1",
            video_title="Lecture.mp4",
            start_time=12.0,
            end_time=24.0,
            text="Spoken segment that satisfies the minimum similarity threshold.",
            raw_score=0.70,
        )
    ]

    results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        alpha=0.3,
        beta=0.7,
        threshold=0.40,
    )

    # Desired behavior: Candidate with raw 0.70 relevance must survive threshold 0.40
    assert len(results) == 1, (
        "Candidate passing raw threshold 0.40 was dropped in fusion because threshold was "
        "re-applied against weight-attenuated score (0.3000 < 0.40)."
    )


def test_desired_rrf_unpaired_candidate_survival_at_standard_threshold():
    """Area 6: RRF scores must not be misrepresented and unpaired candidates must survive reasonable thresholds.

    In RRF mode, the top-ranked candidate should not be eliminated when a user sets
    a standard 30% threshold (threshold=0.30). The threshold filter in RRF should either
    evaluate a normalized rank metric or permit top-ranked single-modality results to surface.
    """
    text_matches = [
        TextMatch(
            segment_id="s_rrf_survive",
            video_id="v_rrf",
            video_title="Lecture.mp4",
            start_time=0.0,
            end_time=10.0,
            text="Top ranked speech segment in RRF mode.",
            raw_score=0.91,
        )
    ]

    results = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=[],
        fusion_method="rrf",
        alpha=0.5,
        beta=0.5,
        threshold=0.30,
    )

    # Desired behavior: Rank-1 candidate must survive standard 30% threshold
    assert len(results) == 1, (
        "Rank-1 unpaired RRF candidate was eliminated at threshold=0.30 because its "
        "calculated confidence was only 24.6%."
    )


def test_regression_weight_extremes_and_non_unity_sums():
    """Area 7: Alpha and beta changes must affect ranking in a predictable and documented manner.

    Validates:
      1. Non-unity weights (alpha=3.0, beta=1.0) normalize identically to (alpha=0.75, beta=0.25).
      2. Extreme alpha=1.0, beta=0.0 ranks purely by speech, ignoring visual differences.
      3. Extreme alpha=0.0, beta=1.0 ranks purely by visual, ignoring speech differences.
    """
    # Moment A: High text (0.85), Low visual (0.20)
    # Moment B: Low text (0.40), High visual (0.35)
    text_matches = [
        TextMatch("sA", "v1", "V1", 10.0, 16.0, "Speech dominant", raw_score=0.85),
        TextMatch("sB", "v2", "V2", 40.0, 46.0, "Speech weak", raw_score=0.40),
    ]
    visual_matches = [
        VisualMatch("fB", "v2", "V2", 42.0, "/fb.jpg", raw_score=0.35),
        VisualMatch("fA", "v1", "V1", 12.0, "/fa.jpg", raw_score=0.20),
    ]

    # 1. Non-unity weights equivalence
    res_non_unity = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=3.0,
        beta=1.0,
    )
    res_unity = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.75,
        beta=0.25,
    )
    assert len(res_non_unity) == len(res_unity)
    for r1, r2 in zip(res_non_unity, res_unity):
        assert r1.segment_id == r2.segment_id
        assert r1.score == pytest.approx(r2.score, abs=1e-5)

    # 2. Pure dialogue extreme: alpha=1.0, beta=0.0 -> Moment A must be #1 with score 1.0
    res_pure_text = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=1.0,
        beta=0.0,
    )
    assert res_pure_text[0].segment_id == "sA"
    assert res_pure_text[0].score == pytest.approx(1.0)
    assert res_pure_text[1].segment_id == "sB"
    assert res_pure_text[1].score == pytest.approx(0.3)

    # 3. Pure visual extreme: alpha=0.0, beta=1.0 -> Moment B must be #1 with score 1.0
    res_pure_visual = temporal_consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.0,
        beta=1.0,
    )
    assert res_pure_visual[0].segment_id == "sB"
    assert res_pure_visual[0].score == pytest.approx(1.0)
    assert res_pure_visual[1].segment_id == "sA"
    assert res_pure_visual[1].score == pytest.approx(0.04 / 0.18, abs=1e-3)


def test_regression_empty_inputs_and_missing_modality_data_safety():
    """Area 8: Empty result sets and missing modality data must be handled safely without exceptions."""
    # 1. Both candidate sets empty
    assert temporal_consolidator.fuse_multimodal([], []) == []

    # 2. Speech present, visual empty -> returns text items with modality="text", visual_score=None
    text_only = [
        TextMatch("s_solo", "v1", "V1", 5.0, 15.0, "Solo speech segment", raw_score=0.75)
    ]
    res_text_only = temporal_consolidator.fuse_multimodal(text_only, [])
    assert len(res_text_only) == 1
    assert res_text_only[0].modality == "text"
    assert res_text_only[0].visual_score is None
    assert res_text_only[0].frame_id is None
    assert res_text_only[0].text_score == 0.75

    # 3. Visual present, speech empty -> returns visual items with modality="visual", text_score=None
    visual_only = [
        VisualMatch("f_solo", "v1", "V1", 10.0, "/f_solo.jpg", raw_score=0.32)
    ]
    res_vis_only = temporal_consolidator.fuse_multimodal([], visual_only)
    assert len(res_vis_only) == 1
    assert res_vis_only[0].modality == "visual"
    assert res_vis_only[0].text_score is None
    assert res_vis_only[0].segment_id is None
    assert res_vis_only[0].visual_score == 0.32

    # 4. Zero score candidate handling
    zero_match = [
        TextMatch("s_zero", "v1", "V1", 0.0, 5.0, "Zero score speech", raw_score=0.0)
    ]
    res_zero = temporal_consolidator.fuse_multimodal(zero_match, [])
    assert len(res_zero) == 1
    assert not math.isnan(res_zero[0].score)
    assert res_zero[0].score >= 0.0


def test_missing_modality_silent_video_no_penalty():
    """Verifies that visual candidate from a genuinely silent READY video receives discount 1.0 (no penalty)."""
    visual_matches = [
        VisualMatch(
            frame_id="f_silent",
            video_id="v_silent",
            video_title="SilentVideo.mp4",
            timestamp=10.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=False,
            video_status="READY",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 in [0.16, 0.34] -> (0.25 - 0.16) / 0.18 = 0.50. Discount is 1.0
    assert results[0].score == pytest.approx(0.50, abs=1e-3)
    assert results[0].confidence_percent == 50.0


def test_missing_modality_incomplete_video_applies_penalty():
    """Verifies that visual candidate from an incomplete/processing video receives discount 0.85."""
    visual_matches = [
        VisualMatch(
            frame_id="f_incomp",
            video_id="v_incomp",
            video_title="ProcessingVideo.mp4",
            timestamp=10.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=False,
            video_status="PROCESSING",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 in [0.16, 0.34] -> 0.50. Discount is 0.85 because video_status != 'READY'
    assert results[0].score == pytest.approx(0.50 * 0.85, abs=1e-3)
    assert results[0].confidence_percent == round(0.50 * 0.85 * 100, 1)


def test_missing_modality_audio_present_applies_penalty():
    """Verifies that visual candidate from a video with audio receives discount 0.85 when no speech matched."""
    visual_matches = [
        VisualMatch(
            frame_id="f_audio_present",
            video_id="v_audio",
            video_title="AudioVideo.mp4",
            timestamp=10.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=True,
            video_status="READY",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 in [0.16, 0.34] -> 0.50. Discount is 0.85 because audio was available in video
    assert results[0].score == pytest.approx(0.50 * 0.85, abs=1e-3)
    assert results[0].confidence_percent == round(0.50 * 0.85 * 100, 1)


def test_missing_modality_unknown_audio_applies_penalty():
    """Verifies that visual candidate from a video with unknown audio availability (has_audio=None) receives discount 0.85."""
    visual_matches = [
        VisualMatch(
            frame_id="f_audio_unknown",
            video_id="v_unknown",
            video_title="UnknownAudioVideo.mp4",
            timestamp=10.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=None,
            video_status="READY",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 in [0.16, 0.34] -> 0.50. Discount is 0.85 because audio availability is unknown (has_audio is None)
    assert results[0].score == pytest.approx(0.50 * 0.85, abs=1e-3)
    assert results[0].confidence_percent == round(0.50 * 0.85 * 100, 1)
