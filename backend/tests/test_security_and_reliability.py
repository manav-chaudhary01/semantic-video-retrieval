import io
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.app.main import create_application
from backend.app.core.config import settings
from backend.app.core.security import validate_uuid, sanitize_filename, safe_resolve_path
from backend.app.core.exceptions import SecurityError, ValidationError, RateLimitExceededError
from backend.app.core.rate_limiter import rate_limiter_store, SlidingWindowRateLimiter
from backend.app.services.stream_service import parse_byte_range, create_media_stream_response


@pytest.fixture
def client():
    app = create_application()
    return TestClient(app)


def test_sanitize_filename():
    """Verifies that filename sanitization strips directory traversal components and dangerous chars."""
    assert sanitize_filename("normal_video.mp4") == "normal_video.mp4"
    assert sanitize_filename("../../etc/passwd.mp4") == "passwd.mp4"
    assert sanitize_filename("..\\..\\windows\\system32\\calc.exe.mp4") == "calc.exe.mp4"
    assert sanitize_filename('test"file:name?.mp4') == "test_file_name_.mp4"
    assert sanitize_filename("") == "unnamed_video.mp4"
    assert sanitize_filename("   ") == "unnamed_video.mp4"


def test_validate_uuid():
    """Verifies strict UUID parsing and rejection of injection payloads."""
    valid_uuid = str(uuid.uuid4())
    assert validate_uuid(valid_uuid) == valid_uuid
    assert validate_uuid(f"  {valid_uuid}  ") == valid_uuid

    with pytest.raises(ValidationError):
        validate_uuid("../../etc/passwd")

    with pytest.raises(ValidationError):
        validate_uuid("<script>alert(1)</script>")

    with pytest.raises(ValidationError):
        validate_uuid("'; DROP TABLE videos; --")

    with pytest.raises(ValidationError):
        validate_uuid("")


def test_safe_resolve_path_security():
    """Verifies that safe_resolve_path prevents directory traversal outside allowed parent."""
    base_dir = settings.get_absolute_path(settings.DATA_DIR)
    safe_target = base_dir / "videos" / "test.mp4"

    # Permitted child path
    resolved = safe_resolve_path(safe_target, base_dir)
    assert resolved == safe_target.resolve()

    # Traversal escape attempt
    evil_target = base_dir / ".." / ".." / "Windows" / "win.ini"
    with pytest.raises(SecurityError):
        safe_resolve_path(evil_target, base_dir)


def test_sliding_window_rate_limiter():
    """Verifies thread-safe sliding window rate limiter behavior and retry-after calculation."""
    limiter = SlidingWindowRateLimiter()
    key = "test_user_ip"

    # Allow up to 3 requests in a 60-second window
    allowed1, _ = limiter.is_allowed(key, max_requests=3, window_sec=60.0)
    allowed2, _ = limiter.is_allowed(key, max_requests=3, window_sec=60.0)
    allowed3, _ = limiter.is_allowed(key, max_requests=3, window_sec=60.0)
    assert allowed1 and allowed2 and allowed3

    # 4th request must be rejected with retry_after > 0
    blocked, retry_after = limiter.is_allowed(key, max_requests=3, window_sec=60.0)
    assert not blocked
    assert retry_after > 0

    # Reset clears history
    limiter.reset()
    allowed_again, _ = limiter.is_allowed(key, max_requests=3, window_sec=60.0)
    assert allowed_again


def test_byte_range_parsing():
    """Verifies HTTP byte range parsing and RFC 7233 edge cases."""
    file_size = 1000

    # Full range
    assert parse_byte_range("bytes=0-499", file_size) == (0, 499)
    # Open-ended start
    assert parse_byte_range("bytes=500-", file_size) == (500, 999)
    # Start beyond file size -> unsatisfiable
    assert parse_byte_range("bytes=1500-", file_size) is None
    # Start > end -> unsatisfiable
    assert parse_byte_range("bytes=600-500", file_size) is None
    # Invalid unit -> default full range
    assert parse_byte_range("invalid=0-500", file_size) == (0, 999)


def test_search_input_validation(client):
    """Verifies that search input validation correctly blocks blank queries, bad modalities, and traversal."""
    # Blank query
    res = client.post("/api/search", json={"query": "   ", "modality": "text"})
    assert res.status_code in (400, 422)

    # Invalid modality
    res = client.post("/api/search", json={"query": "valid query", "modality": "invalid_modality"})
    assert res.status_code in (400, 422)

    # Malicious video_id with path traversal
    res = client.post("/api/search", json={"query": "valid query", "video_id": "../../../etc/passwd"})
    assert res.status_code in (400, 422)


def test_media_stream_security_and_range_handling(client, tmp_path):
    """Verifies media streaming with 206 Partial Content, 416 Range Not Satisfiable, and security headers."""
    # Create a small dummy video in the data/videos directory
    videos_dir = settings.get_absolute_path(settings.VIDEOS_DIR)
    videos_dir.mkdir(parents=True, exist_ok=True)
    dummy_video_id = str(uuid.uuid4())
    dummy_path = videos_dir / f"{dummy_video_id}.mp4"
    dummy_path.write_bytes(b"A" * 1024)

    try:
        from backend.app.db.session import SessionLocal
        from backend.app.models.video import Video
        db = SessionLocal()
        v = Video(
            id=dummy_video_id,
            original_filename="dummy.mp4",
            storage_path=f"data/videos/{dummy_video_id}.mp4",
            file_size=1024,
            mime_type="video/mp4",
            status="READY",
        )
        db.add(v)
        db.commit()
        db.close()

        # 1. Full content request (200 OK)
        res = client.get(f"/api/videos/{dummy_video_id}/stream")
        assert res.status_code == 200
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("Accept-Ranges") == "bytes"
        assert len(res.content) == 1024

        # 2. Valid partial range request (206 Partial Content)
        res_partial = client.get(
            f"/api/videos/{dummy_video_id}/stream",
            headers={"Range": "bytes=0-99"},
        )
        assert res_partial.status_code == 206
        assert res_partial.headers.get("Content-Range") == "bytes 0-99/1024"
        assert len(res_partial.content) == 100

        # 3. Invalid out-of-bounds range request (416 Range Not Satisfiable)
        res_invalid = client.get(
            f"/api/videos/{dummy_video_id}/stream",
            headers={"Range": "bytes=5000-6000"},
        )
        assert res_invalid.status_code == 416
        assert res_invalid.headers.get("Content-Range") == "bytes */1024"

    finally:
        if dummy_path.exists():
            dummy_path.unlink()
        from backend.app.db.session import SessionLocal
        from backend.app.models.video import Video
        db = SessionLocal()
        db.query(Video).filter(Video.id == dummy_video_id).delete()
        db.commit()
        db.close()
