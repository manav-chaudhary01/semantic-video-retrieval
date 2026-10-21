import asyncio
import io
import os
import subprocess
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.services.health_service import ensure_ffmpeg_path


@pytest.fixture(scope="module")
def sample_video_path():
    """Generates a small 2-second valid synthetic MP4 video with audio tone for testing."""
    ensure_ffmpeg_path()
    temp_dir = settings.get_absolute_path(settings.TEMP_DIR)
    temp_dir.mkdir(parents=True, exist_ok=True)
    video_path = temp_dir / "pytest_fixture_sample.mp4"

    cmd = [
        "ffmpeg",
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=2:size=320x240:rate=15",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:duration=2",
        "-pix_fmt", "yuv420p",
        "-c:v", "libx264",
        "-c:a", "aac",
        str(video_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    assert result.returncode == 0, f"FFmpeg failed: {result.stderr}"
    assert video_path.exists() and video_path.stat().st_size > 0

    yield video_path

    if video_path.exists():
        video_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_upload_invalid_extension():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("document.txt", b"plain text content", "text/plain")}
        response = await client.post(f"{settings.API_PREFIX}/videos", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "Unsupported file extension" in data["detail"]


@pytest.mark.asyncio
async def test_upload_corrupted_video():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("corrupt.mp4", b"\x00\x00\x00\x18ftypmp42corruptdata", "video/mp4")}
        response = await client.post(f"{settings.API_PREFIX}/videos", files=files)
        assert response.status_code == 202
        video_id = response.json()["video_id"]

        # Wait briefly for background worker to fail the corrupted video
        for _ in range(15):
            await asyncio.sleep(0.3)
            status_res = await client.get(f"{settings.API_PREFIX}/videos/{video_id}/status")
            if status_res.status_code == 200 and status_res.json()["status"] == "FAILED":
                break

        final_res = await client.get(f"{settings.API_PREFIX}/videos/{video_id}")
        assert final_res.status_code == 200
        assert final_res.json()["status"] == "FAILED"
        assert final_res.json()["error_message"] is not None

        # Clean up corrupted video record
        await client.delete(f"{settings.API_PREFIX}/videos/{video_id}")


@pytest.mark.asyncio
async def test_upload_valid_video_and_lifecycle(sample_video_path):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(sample_video_path, "rb") as f:
            video_bytes = f.read()

        files = {"file": ("sample_lecture.mp4", io.BytesIO(video_bytes), "video/mp4")}
        upload_res = await client.post(f"{settings.API_PREFIX}/videos", files=files)
        assert upload_res.status_code == 202
        upload_data = upload_res.json()
        video_id = upload_data["video_id"]
        assert upload_data["status"] == "UPLOADED"
        assert upload_data["job_id"] is not None

        # Poll until background processing completes
        max_retries = 20
        completed = False
        for _ in range(max_retries):
            await asyncio.sleep(0.4)
            status_res = await client.get(f"{settings.API_PREFIX}/videos/{video_id}/status")
            assert status_res.status_code == 200
            status_data = status_res.json()
            if status_data["status"] == "COMPLETED":
                completed = True
                assert status_data["progress"] == 100.0
                break
            elif status_data["status"] == "FAILED":
                pytest.fail(f"Ingestion failed: {status_data['error_message']}")

        assert completed, "Video processing did not complete within timeout."

        # Verify metadata extraction in GET /api/videos/{video_id}
        meta_res = await client.get(f"{settings.API_PREFIX}/videos/{video_id}")
        assert meta_res.status_code == 200
        meta = meta_res.json()
        assert meta["status"] == "READY"
        assert meta["duration"] is not None
        assert 1.5 <= meta["duration"] <= 2.5
        assert meta["width"] == 320
        assert meta["height"] == 240
        assert meta["fps"] == 15.0
        assert meta["has_audio"] is True

        # Verify audio extraction produced 16kHz WAV file on disk
        extracted_audio_path = settings.get_absolute_path(settings.AUDIO_DIR) / f"{video_id}.wav"
        assert extracted_audio_path.exists()
        assert extracted_audio_path.stat().st_size > 0

        # Verify video list includes the video
        list_res = await client.get(f"{settings.API_PREFIX}/videos")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert any(item["id"] == video_id for item in list_data["items"])

        # Verify Range Streaming (HTTP 206 Partial Content)
        stream_res = await client.get(
            f"{settings.API_PREFIX}/videos/{video_id}/stream",
            headers={"Range": "bytes=0-100"},
        )
        assert stream_res.status_code == 206
        assert "Content-Range" in stream_res.headers
        assert stream_res.headers["Content-Range"].startswith("bytes 0-100/")
        assert len(stream_res.content) == 101

        # Verify video deletion
        delete_res = await client.delete(f"{settings.API_PREFIX}/videos/{video_id}")
        assert delete_res.status_code == 204

        # Confirm 404 after deletion
        after_delete = await client.get(f"{settings.API_PREFIX}/videos/{video_id}")
        assert after_delete.status_code == 404
        assert not extracted_audio_path.exists()
