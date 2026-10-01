import numpy as np
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.services.chunking_service import TranscriptChunker
from backend.app.ml.vector_index import FaissTextIndex
from backend.app.ml.text_embeddings import text_embedder
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.segment import TranscriptSegment


def test_transcript_chunking_logic():
    chunker = TranscriptChunker(target_duration=10.0, max_words=20, max_pause=2.0)

    raw_segments = [
        {"start": 0.0, "end": 2.5, "text": "Welcome to the lecture."},
        {"start": 2.8, "end": 5.2, "text": "Today we discuss neural networks."},
        {"start": 5.5, "end": 9.8, "text": "Specifically deep backpropagation models."},
        # Long pause of 3.2 seconds (13.0 - 9.8 > 2.0 max_pause) -> should trigger split
        {"start": 13.0, "end": 16.5, "text": "Moving to the second topic."},
        {"start": 16.8, "end": 20.0, "text": "We evaluate loss gradients."},
    ]

    chunks = chunker.chunk_segments(raw_segments)

    assert len(chunks) == 2
    # Chunk 1
    assert chunks[0]["start_time"] == 0.0
    assert chunks[0]["end_time"] == 9.8
    assert "neural networks" in chunks[0]["text"]
    assert "backpropagation" in chunks[0]["text"]

    # Chunk 2
    assert chunks[1]["start_time"] == 13.0
    assert chunks[1]["end_time"] == 20.0
    assert "second topic" in chunks[1]["text"]


def test_faiss_vector_index_lifecycle(tmp_path):
    index_file = tmp_path / "test_faiss.index"
    id_map_file = tmp_path / "test_id_map.json"

    index = FaissTextIndex(dimension=384, index_file=index_file, id_map_file=id_map_file)
    assert index.total_vectors == 0

    # Create synthetic normalized embeddings for 3 segments
    rng = np.random.RandomState(42)
    vectors = rng.randn(3, 384).astype(np.float32)
    entity_ids = ["seg-uuid-1", "seg-uuid-2", "seg-uuid-3"]

    assigned = index.add(entity_ids, vectors)
    assert len(assigned) == 3
    assert assigned == [0, 1, 2]
    assert index.total_vectors == 3

    # Search with the first vector (should match seg-uuid-1 with score ~1.0)
    results = index.search(vectors[0], top_k=2)
    assert len(results) == 2
    top_id, top_score = results[0]
    assert top_id == "seg-uuid-1"
    assert top_score > 0.99  # Cosine similarity with self is ~1.0

    # Test persistence and reloading after restart
    reloaded_index = FaissTextIndex(dimension=384, index_file=index_file, id_map_file=id_map_file)
    assert reloaded_index.total_vectors == 3
    reloaded_results = reloaded_index.search(vectors[0], top_k=1)
    assert reloaded_results[0][0] == "seg-uuid-1"


def test_text_embedding_model_semantic_ranking():
    # Embed semantic sentences
    query = "deep learning neural network architectures"
    doc_relevant = "Convolutional and recurrent deep neural networks for computer vision"
    doc_irrelevant = "A quick culinary guide to baking authentic Italian sourdough bread"

    embeddings = text_embedder.embed_texts([query, doc_relevant, doc_irrelevant])
    assert embeddings.shape == (3, settings.TEXT_EMBEDDING_DIM)

    # Verify L2 normalization: norm of each vector should equal 1.0
    for vec in embeddings:
        norm = np.linalg.norm(vec)
        assert np.isclose(norm, 1.0, atol=1e-3)

    # Cosine similarities
    score_rel = float(np.dot(embeddings[0], embeddings[1]))
    score_irrel = float(np.dot(embeddings[0], embeddings[2]))

    assert score_rel > score_irrel
    assert score_rel > 0.40


@pytest.mark.asyncio
async def test_transcript_endpoints_with_database():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a test video and transcript segments in DB
        with SessionLocal() as db:
            video = Video(
                id="test-transcription-vid",
                original_filename="ai_lecture.mp4",
                storage_path="data/videos/test.mp4",
                duration=60.0,
                file_size=1024,
                has_audio=True,
                status="READY",
            )
            seg1 = TranscriptSegment(
                id="seg-1",
                video_id=video.id,
                start_time=0.0,
                end_time=15.0,
                text="Introduction to backpropagation and gradient calculation.",
                language="en",
                embedding_model="all-MiniLM-L6-v2",
                index_reference=0,
            )
            seg2 = TranscriptSegment(
                id="seg-2",
                video_id=video.id,
                start_time=15.0,
                end_time=30.0,
                text="The chain rule allows computing derivatives across hidden layers.",
                language="en",
                embedding_model="all-MiniLM-L6-v2",
                index_reference=1,
            )
            db.merge(video)
            db.merge(seg1)
            db.merge(seg2)
            db.commit()

        # Test GET /api/videos/{id}/transcript
        res = await client.get(f"{settings.API_PREFIX}/videos/test-transcription-vid/transcript")
        assert res.status_code == 200
        data = res.json()
        assert data["video_id"] == "test-transcription-vid"
        assert data["language"] == "en"
        assert data["total_segments"] == 2
        assert len(data["segments"]) == 2
        assert data["segments"][0]["start_time"] == 0.0
        assert data["segments"][1]["end_time"] == 30.0

        # Test GET /api/videos/{id}/segments pagination
        seg_res = await client.get(
            f"{settings.API_PREFIX}/videos/test-transcription-vid/segments?skip=0&limit=1"
        )
        assert seg_res.status_code == 200
        seg_data = seg_res.json()
        assert seg_data["total"] == 2
        assert len(seg_data["items"]) == 1
        assert seg_data["items"][0]["id"] == "seg-1"

        # Cleanup test entities
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == "test-transcription-vid").first()
            if v:
                db.delete(v)
                db.commit()
