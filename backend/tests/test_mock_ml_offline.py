import unittest.mock as mock
from pathlib import Path
import numpy as np
import pytest

from backend.app.schemas.search import SearchRequest
from backend.app.services.temporal_consolidator import TextMatch, VisualMatch, TemporalConsolidator
from backend.app.ml.text_embeddings import TextEmbeddingService
from backend.app.ml.visual_embeddings import VisualEmbeddingService
from backend.app.services.chunking_service import TranscriptChunker


def test_offline_text_embedder_mock():
    """Verifies that TextEmbeddingService operates properly when the underlying model is mocked offline."""
    mock_model = mock.MagicMock()
    # Mock model encoding 2 texts into normalized 384-d vectors (as SentenceTransformer does with normalize_embeddings=True)
    raw_vecs = np.random.randn(2, 384).astype(np.float32)
    normalized_vecs = raw_vecs / np.linalg.norm(raw_vecs, axis=1, keepdims=True)
    mock_model.encode.return_value = normalized_vecs

    embedder = TextEmbeddingService()
    embedder._model = mock_model

    texts = ["First test query", "Second test query"]
    embeddings = embedder.embed_texts(texts)

    assert embeddings.shape == (2, 384)
    # Verify embeddings are unit-normalized
    norms = np.linalg.norm(embeddings, axis=1)
    np.testing.assert_allclose(norms, [1.0, 1.0], atol=1e-5)
    mock_model.encode.assert_called_once_with(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )


def test_offline_visual_embedder_mock():
    """Verifies that VisualEmbeddingService operates properly with mocked CLIP weights offline."""
    import torch

    mock_clip = mock.MagicMock()
    mock_processor = mock.MagicMock()

    # Mock 512-d text feature tensor
    text_feat = torch.randn(1, 512)
    mock_clip.get_text_features.return_value = text_feat

    embedder = VisualEmbeddingService()
    embedder._model = mock_clip
    embedder._processor = mock_processor

    vec = embedder.embed_text("A red sports car")
    assert vec.shape == (1, 512)
    norm = np.linalg.norm(vec[0])
    assert abs(norm - 1.0) < 1e-4


def test_offline_temporal_fusion_rrf_and_linear():
    """Verifies temporal consolidator offline without FAISS or neural models."""
    consolidator = TemporalConsolidator()

    text_matches = [
        TextMatch(
            segment_id="seg1",
            video_id="vid1",
            video_title="Lecture 1",
            start_time=2.0,
            end_time=6.0,
            text="Explaining neural nets",
            raw_score=0.85,
        ),
        TextMatch(
            segment_id="seg2",
            video_id="vid1",
            video_title="Lecture 1",
            start_time=12.0,
            end_time=16.0,
            text="Gradient descent steps",
            raw_score=0.45,
        ),
    ]

    visual_matches = [
        VisualMatch(
            frame_id="frm1",
            video_id="vid1",
            video_title="Lecture 1",
            timestamp=4.0,
            preview_url="/api/videos/vid1/frames/frm1",
            raw_score=0.78,
        ),
        VisualMatch(
            frame_id="frm2",
            video_id="vid1",
            video_title="Lecture 1",
            timestamp=14.0,
            preview_url="/api/videos/vid1/frames/frm2",
            raw_score=0.35,
        ),
    ]

    # Test Linear Fusion
    fused_linear = consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        fusion_method="linear",
        temporal_window_sec=5.0,
        top_k=5,
    )
    assert len(fused_linear) == 2
    assert fused_linear[0].segment_id == "seg1"
    assert fused_linear[0].frame_id == "frm1"
    assert fused_linear[0].score >= fused_linear[1].score

    # Test Reciprocal Rank Fusion (RRF)
    fused_rrf = consolidator.fuse_multimodal(
        text_matches=text_matches,
        visual_matches=visual_matches,
        alpha=0.5,
        beta=0.5,
        fusion_method="rrf",
        temporal_window_sec=5.0,
        top_k=5,
    )
    assert len(fused_rrf) == 2
    assert fused_rrf[0].segment_id == "seg1"
    assert fused_rrf[0].score > fused_rrf[1].score


def test_offline_whisper_transcription_parsing():
    """Verifies Whisper result parsing and timestamp extraction using mock segment dataclasses."""
    from dataclasses import dataclass
    from typing import List

    @dataclass
    class MockWord:
        word: str
        start: float
        end: float
        probability: float

    @dataclass
    class MockSegment:
        id: int
        start: float
        end: float
        text: str
        words: List[MockWord]

    mock_segments = [
        MockSegment(
            id=0,
            start=0.0,
            end=4.5,
            text=" Welcome to deep learning.",
            words=[
                MockWord(word="Welcome", start=0.0, end=0.8, probability=0.99),
                MockWord(word="to", start=0.8, end=1.0, probability=0.99),
                MockWord(word="deep", start=1.0, end=1.5, probability=0.98),
                MockWord(word="learning.", start=1.5, end=2.2, probability=0.99),
            ],
        ),
        MockSegment(
            id=1,
            start=4.8,
            end=9.2,
            text=" We study neural networks.",
            words=[
                MockWord(word="We", start=4.8, end=5.2, probability=0.97),
                MockWord(word="study", start=5.2, end=5.8, probability=0.99),
                MockWord(word="neural", start=5.8, end=6.4, probability=0.98),
                MockWord(word="networks.", start=6.4, end=7.1, probability=0.99),
            ],
        ),
    ]

    raw_dicts = [
        {"id": s.id, "start": s.start, "end": s.end, "text": s.text.strip(), "words": [{"word": w.word, "start": w.start, "end": w.end} for w in s.words]}
        for s in mock_segments
    ]

    chunker = TranscriptChunker(target_duration=20.0, max_words=60)
    chunks = chunker.chunk_segments(raw_dicts)
    assert len(chunks) == 1
    assert "deep learning" in chunks[0]["text"]
    assert "neural networks" in chunks[0]["text"]
    assert chunks[0]["start_time"] == 0.0
    assert chunks[0]["end_time"] == 9.2
