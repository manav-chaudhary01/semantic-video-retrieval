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
    """Verifies min-max normalization properly scales uncalibrated raw scores."""
    raw_text = [0.85, 0.65, 0.45]
    norm_text = temporal_consolidator.normalize_min_max(raw_text)
    assert norm_text[0] == pytest.approx(1.0)
    assert norm_text[1] == pytest.approx(0.5)
    assert norm_text[2] == pytest.approx(0.0)

    # Constant scores should avoid division by zero
    constant = [0.5, 0.5]
    norm_const = temporal_consolidator.normalize_min_max(constant)
    assert norm_const == [1.0, 1.0]

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
