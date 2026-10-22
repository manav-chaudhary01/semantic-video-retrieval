import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.segment import TranscriptSegment
from backend.app.ml.text_embeddings import text_embedder
from backend.app.ml.vector_index import text_vector_index


@pytest.fixture(scope="module")
def setup_search_dataset():
    """Sets up two test videos with distinct transcript segments in DB and FAISS."""
    with SessionLocal() as db:
        # Video 1: AI / Deep Learning Lecture
        v1 = Video(
            id="test-vid-ai-search",
            original_filename="ai_lecture.mp4",
            storage_path="data/videos/ai_lecture.mp4",
            duration=120.0,
            file_size=5000,
            has_audio=True,
            status="READY",
        )
        s1 = TranscriptSegment(
            id="seg-ai-1",
            video_id=v1.id,
            start_time=10.0,
            end_time=30.0,
            text="Today we explain convolutional neural network architectures for computer vision and image classification.",
            language="en",
            embedding_model="all-MiniLM-L6-v2",
        )
        s2 = TranscriptSegment(
            id="seg-ai-2",
            video_id=v1.id,
            start_time=35.0,
            end_time=55.0,
            text="Gradient descent minimizes the cross entropy loss by updating weights via backpropagation.",
            language="en",
            embedding_model="all-MiniLM-L6-v2",
        )

        # Video 2: Climate & Meteorology Documentary
        v2 = Video(
            id="test-vid-climate-search",
            original_filename="climate_doc.mp4",
            storage_path="data/videos/climate_doc.mp4",
            duration=90.0,
            file_size=4000,
            has_audio=True,
            status="READY",
        )
        s3 = TranscriptSegment(
            id="seg-climate-1",
            video_id=v2.id,
            start_time=5.0,
            end_time=25.0,
            text="Global atmospheric temperatures and greenhouse gas emissions affect ocean currents and Arctic ice caps.",
            language="en",
            embedding_model="all-MiniLM-L6-v2",
        )

        db.merge(v1)
        db.merge(v2)
        db.merge(s1)
        db.merge(s2)
        db.merge(s3)
        db.commit()

        # Compute embeddings and index in FAISS
        texts = [s1.text, s2.text, s3.text]
        embeddings = text_embedder.embed_texts(texts)
        entity_ids = [s1.id, s2.id, s3.id]
        assigned_refs = text_vector_index.add(entity_ids, embeddings)

        s1.index_reference = assigned_refs[0]
        s2.index_reference = assigned_refs[1]
        s3.index_reference = assigned_refs[2]
        db.commit()

    yield {
        "v1_id": "test-vid-ai-search",
        "v2_id": "test-vid-climate-search",
        "seg_ai_1": "seg-ai-1",
        "seg_ai_2": "seg-ai-2",
        "seg_climate_1": "seg-climate-1",
    }

    # Teardown
    with SessionLocal() as db:
        for vid_id in ["test-vid-ai-search", "test-vid-climate-search"]:
            v = db.query(Video).filter(Video.id == vid_id).first()
            if v:
                db.delete(v)
        db.commit()


@pytest.mark.asyncio
async def test_semantic_search_ranking(setup_search_dataset):
    """Verifies that natural-language queries return the semantically relevant video moments."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Search for deep learning concepts
        res = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "convolutional image classification networks", "top_k": 3},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_results"] >= 1
        top_hit = data["results"][0]
        assert top_hit["segment_id"] == "seg-ai-1"
        assert top_hit["video_title"] == "ai_lecture.mp4"
        assert top_hit["score"] > 0.40
        assert top_hit["start_time"] == 10.0
        assert top_hit["end_time"] == 30.0
        assert top_hit["stream_url"] == "/api/videos/test-vid-ai-search/stream"

        # 2. Search for climate concepts
        res_climate = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "global warming and greenhouse gas emissions", "top_k": 3},
        )
        assert res_climate.status_code == 200
        data_climate = res_climate.json()
        assert data_climate["total_results"] >= 1
        assert data_climate["results"][0]["segment_id"] == "seg-climate-1"
        assert data_climate["results"][0]["video_title"] == "climate_doc.mp4"


@pytest.mark.asyncio
async def test_search_video_id_filtering(setup_search_dataset):
    """Verifies that searching with a video_id filter restricts results exclusively to that video."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query about neural networks, but filter by climate video
        res = await client.post(
            f"{settings.API_PREFIX}/search",
            json={
                "query": "neural network backpropagation",
                "video_id": "test-vid-climate-search",
                "top_k": 5,
            },
        )
        assert res.status_code == 200
        data = res.json()
        # All returned results must belong to the filtered video
        for item in data["results"]:
            assert item["video_id"] == "test-vid-climate-search"


@pytest.mark.asyncio
async def test_search_top_k_and_threshold(setup_search_dataset):
    """Verifies top_k limits and score threshold cutoffs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test top_k = 1
        res_k1 = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "deep neural networks", "top_k": 1},
        )
        assert res_k1.status_code == 200
        assert len(res_k1.json()["results"]) == 1

        # Test impossibly high threshold (0.99) -> 0 results
        res_thresh = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "deep neural networks", "threshold": 0.99},
        )
        assert res_thresh.status_code == 200
        assert len(res_thresh.json()["results"]) == 0


@pytest.mark.asyncio
async def test_search_validation_errors():
    """Verifies validation on empty query and unsupported modalities."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty query
        res_empty = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "   "},
        )
        assert res_empty.status_code == 400

        # Unsupported modality
        res_invalid_mod = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "test query", "modality": "unknown_modality"},
        )
        assert res_invalid_mod.status_code == 400
