import pytest
import numpy as np
from pathlib import Path
from PIL import Image
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.frame import VisualFrame
from backend.app.ml.visual_embeddings import visual_embedder
from backend.app.ml.vector_index import FaissTextIndex, visual_vector_index
from backend.app.services.frame_extractor import frame_extractor


def test_clip_cross_modal_alignment():
    """Verifies that CLIP text embeddings semantically align with matching visual frame images."""
    # Create two synthetic 224x224 RGB images: one pure red, one pure blue
    red_img = Image.new("RGB", (224, 224), color=(255, 0, 0))
    blue_img = Image.new("RGB", (224, 224), color=(0, 0, 255))

    img_embeddings = visual_embedder.embed_images([red_img, blue_img])
    assert img_embeddings.shape == (2, settings.VISION_EMBEDDING_DIM)

    # Check L2 normalization of visual embeddings
    for emb in img_embeddings:
        assert np.isclose(np.linalg.norm(emb), 1.0, atol=1e-3)

    # Embed text queries using CLIP text encoder
    red_text_emb = visual_embedder.embed_text("a bright red image")[0]
    blue_text_emb = visual_embedder.embed_text("a deep blue color")[0]

    assert red_text_emb.shape == (settings.VISION_EMBEDDING_DIM,)
    assert blue_text_emb.shape == (settings.VISION_EMBEDDING_DIM,)
    assert np.isclose(np.linalg.norm(red_text_emb), 1.0, atol=1e-3)

    # Compute cross-modal cosine similarities
    sim_red_to_red = float(np.dot(red_text_emb, img_embeddings[0]))
    sim_red_to_blue = float(np.dot(red_text_emb, img_embeddings[1]))

    sim_blue_to_blue = float(np.dot(blue_text_emb, img_embeddings[1]))
    sim_blue_to_red = float(np.dot(blue_text_emb, img_embeddings[0]))

    # Cross-modal alignment check
    assert sim_red_to_red > sim_red_to_blue, f"Red text should match red image better ({sim_red_to_red} vs {sim_red_to_blue})"
    assert sim_blue_to_blue > sim_blue_to_red, f"Blue text should match blue image better ({sim_blue_to_blue} vs {sim_blue_to_red})"


def test_visual_faiss_lifecycle(tmp_path):
    """Verifies 512-d FAISS index creation, persistence, search, and reloading."""
    index_file = tmp_path / "test_visual_faiss.index"
    id_map_file = tmp_path / "test_visual_id_map.json"

    index = FaissTextIndex(dimension=512, index_file=index_file, id_map_file=id_map_file)
    assert index.total_vectors == 0

    rng = np.random.RandomState(42)
    vectors = rng.randn(3, 512).astype(np.float32)
    entity_ids = ["frame-uuid-1", "frame-uuid-2", "frame-uuid-3"]

    assigned = index.add(entity_ids, vectors)
    assert len(assigned) == 3
    assert index.total_vectors == 3

    # Search with first vector
    results = index.search(vectors[0], top_k=2)
    assert len(results) == 2
    assert results[0][0] == "frame-uuid-1"
    assert results[0][1] > 0.99

    # Reload from disk
    reloaded = FaissTextIndex(dimension=512, index_file=index_file, id_map_file=id_map_file)
    assert reloaded.total_vectors == 3
    rel_results = reloaded.search(vectors[0], top_k=1)
    assert rel_results[0][0] == "frame-uuid-1"


@pytest.mark.asyncio
async def test_frame_api_and_visual_search(tmp_path):
    """Verifies visual frames listing, frame JPEG serving, and visual modality search."""
    # 1. Create a synthetic test video and visual frames in DB
    test_video_id = "test-vid-visual-1"
    frame_dir = settings.get_absolute_path(settings.FRAMES_DIR) / test_video_id
    frame_dir.mkdir(parents=True, exist_ok=True)

    frame_path_1 = frame_dir / "frame_0000_0.00s.jpg"
    frame_path_2 = frame_dir / "frame_0001_2.00s.jpg"

    red_img = Image.new("RGB", (320, 240), color=(255, 0, 0))
    blue_img = Image.new("RGB", (320, 240), color=(0, 0, 255))
    red_img.save(frame_path_1, "JPEG")
    blue_img.save(frame_path_2, "JPEG")

    rel_path_1 = str(Path(settings.FRAMES_DIR) / test_video_id / "frame_0000_0.00s.jpg").replace("\\", "/")
    rel_path_2 = str(Path(settings.FRAMES_DIR) / test_video_id / "frame_0001_2.00s.jpg").replace("\\", "/")

    with SessionLocal() as db:
        v = Video(
            id=test_video_id,
            original_filename="color_scenes.mp4",
            storage_path="data/videos/test.mp4",
            duration=4.0,
            file_size=1024,
            has_audio=False,
            status="READY",
        )
        f1 = VisualFrame(
            id="frame-red-0",
            video_id=v.id,
            timestamp=0.0,
            frame_path=rel_path_1,
            embedding_model="openai/clip-vit-base-patch32",
        )
        f2 = VisualFrame(
            id="frame-blue-2",
            video_id=v.id,
            timestamp=2.0,
            frame_path=rel_path_2,
            embedding_model="openai/clip-vit-base-patch32",
        )
        db.merge(v)
        db.merge(f1)
        db.merge(f2)
        db.commit()

        # Compute embeddings & add to visual_vector_index
        embs = visual_embedder.embed_images([red_img, blue_img])
        assigned = visual_vector_index.add([f1.id, f2.id], embs)
        f1.index_reference = assigned[0]
        f2.index_reference = assigned[1]
        db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. Test GET /api/videos/{video_id}/frames
        res_frames = await client.get(f"{settings.API_PREFIX}/videos/{test_video_id}/frames")
        assert res_frames.status_code == 200
        data_frames = res_frames.json()
        assert data_frames["total_frames"] == 2
        assert data_frames["frames"][0]["id"] == "frame-red-0"
        assert data_frames["frames"][0]["timestamp"] == 0.0

        # 3. Test GET /api/videos/{video_id}/frames/{frame_id} (serving image)
        res_img = await client.get(f"{settings.API_PREFIX}/videos/{test_video_id}/frames/frame-red-0")
        assert res_img.status_code == 200
        assert res_img.headers.get("content-type") == "image/jpeg"
        assert len(res_img.content) > 0

        # 4. Test POST /api/search with modality="visual"
        search_res = await client.post(
            f"{settings.API_PREFIX}/search",
            json={"query": "a vibrant red visual scene", "modality": "visual", "top_k": 2},
        )
        assert search_res.status_code == 200
        search_data = search_res.json()
        assert search_data["total_results"] >= 1
        assert search_data["modality"] == "visual"
        top_match = search_data["results"][0]
        assert top_match["frame_id"] == "frame-red-0"
        assert top_match["modality"] == "visual"
        assert top_match["preview_url"] == f"/api/videos/{test_video_id}/frames/frame-red-0"
        assert top_match["score"] > 0.15

    # Cleanup test entities
    with SessionLocal() as db:
        v = db.query(Video).filter(Video.id == test_video_id).first()
        if v:
            db.delete(v)
            db.commit()
