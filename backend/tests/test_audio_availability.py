import io
import uuid
import sqlite3
from pathlib import Path
from unittest.mock import patch
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.exceptions import InvalidFileError, ProcessingError
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.services.job_service import job_service
from backend.app.services.temporal_consolidator import (
    temporal_consolidator,
    VisualMatch,
)


@pytest.mark.asyncio
async def test_1_new_upload_starts_with_has_audio_none():
    """Scenario 1: Newly created Video records have has_audio=None before probing."""
    video_id = str(uuid.uuid4())
    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="pending_upload.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            mime_type="video/mp4",
            status="UPLOADED",
        )
        db.add(video)
        db.commit()
        try:
            db.refresh(video)
            assert video.has_audio is None
        finally:
            db.delete(video)
            db.commit()


def test_2_successful_probe_with_audio_stores_true():
    """Scenario 2: Successful probe confirming an audio stream explicitly stores has_audio=True."""
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="with_audio.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            status="UPLOADED",
        )
        job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(video)
        db.add(job)
        db.commit()

    try:
        mock_meta = {
            "duration": 5.0,
            "width": 640,
            "height": 480,
            "fps": 30.0,
            "file_size": 1024,
            "has_audio": True,
        }

        with patch("backend.app.services.job_service.video_extractor.probe_video", return_value=mock_meta), \
             patch("backend.app.services.job_service.video_extractor.extract_audio"), \
             patch("backend.app.services.job_service.whisper_service.transcribe", return_value=([], "en")), \
             patch("backend.app.services.job_service.frame_extractor.sample_frames", return_value=[]):
            job_service._run_pipeline(video_id, job_id, Path("data/videos/dummy.mp4"))

        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            assert v.status == "READY"
            assert v.has_audio is True
    finally:
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            if v:
                db.delete(v)
                db.commit()


def test_3_successful_probe_without_audio_stores_false():
    """Scenario 3: Successful probe confirming no audio stream explicitly stores has_audio=False."""
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="silent.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            status="UPLOADED",
        )
        job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(video)
        db.add(job)
        db.commit()

    try:
        mock_meta = {
            "duration": 5.0,
            "width": 640,
            "height": 480,
            "fps": 30.0,
            "file_size": 1024,
            "has_audio": False,
        }

        with patch("backend.app.services.job_service.video_extractor.probe_video", return_value=mock_meta), \
             patch("backend.app.services.job_service.frame_extractor.sample_frames", return_value=[]):
            job_service._run_pipeline(video_id, job_id, Path("data/videos/dummy.mp4"))

        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            assert v.status == "READY"
            assert v.has_audio is False
    finally:
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            if v:
                db.delete(v)
                db.commit()


def test_4_ffprobe_failure_leaves_has_audio_none_and_marks_failed():
    """Scenario 4: When FFprobe fails, has_audio remains None and video status is marked FAILED."""
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="corrupted.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            status="UPLOADED",
        )
        job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(video)
        db.add(job)
        db.commit()

    try:
        with patch(
            "backend.app.services.job_service.video_extractor.probe_video",
            side_effect=InvalidFileError("ffprobe execution failed: corrupted file header"),
        ):
            job_service._run_pipeline(video_id, job_id, Path("data/videos/dummy.mp4"))

        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            assert v.status == "FAILED"
            assert v.has_audio is None
            assert "corrupted file header" in v.error_message
    finally:
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            if v:
                db.delete(v)
                db.commit()


@pytest.mark.parametrize("invalid_audio_val", [
    None,       # Missing key or None value
    "true",     # String 'true'
    1,          # Integer 1 (must be strict bool, not int)
    0,          # Integer 0
    [],         # List
])
def test_5_missing_or_invalid_has_audio_probe_metadata_fails_explicitly(invalid_audio_val):
    """Scenario 5: Missing or non-bool has_audio in probe metadata raises ProcessingError and marks FAILED."""
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="invalid_meta.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            status="UPLOADED",
        )
        job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(video)
        db.add(job)
        db.commit()

    try:
        mock_meta = {
            "duration": 5.0,
            "width": 640,
            "height": 480,
            "fps": 30.0,
            "file_size": 1024,
        }
        if invalid_audio_val is not None:
            mock_meta["has_audio"] = invalid_audio_val

        with patch("backend.app.services.job_service.video_extractor.probe_video", return_value=mock_meta):
            job_service._run_pipeline(video_id, job_id, Path("data/videos/dummy.mp4"))

        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            assert v.status == "FAILED"
            assert v.has_audio is None
            assert "missing valid boolean 'has_audio'" in v.error_message
    finally:
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            if v:
                db.delete(v)
                db.commit()


def test_6_audio_extraction_failure_preserves_has_audio_true():
    """Scenario 6: Audio extraction failure must never overwrite previously confirmed has_audio=True."""
    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    with SessionLocal() as db:
        video = Video(
            id=video_id,
            original_filename="audio_extract_fail.mp4",
            storage_path="data/videos/dummy.mp4",
            file_size=1024,
            status="UPLOADED",
        )
        job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(video)
        db.add(job)
        db.commit()

    try:
        mock_meta = {
            "duration": 5.0,
            "width": 640,
            "height": 480,
            "fps": 30.0,
            "file_size": 1024,
            "has_audio": True,
        }

        with patch("backend.app.services.job_service.video_extractor.probe_video", return_value=mock_meta), \
             patch(
                 "backend.app.services.job_service.video_extractor.extract_audio",
                 side_effect=ProcessingError("EXTRACTING_AUDIO", "FFmpeg audio decode error"),
             ):
            job_service._run_pipeline(video_id, job_id, Path("data/videos/dummy.mp4"))

        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            # Stage 1 committed has_audio=True. Extraction failure in Stage 2 marked FAILED, but preserved has_audio=True.
            assert v.status == "FAILED"
            assert v.has_audio is True
            assert "FFmpeg audio decode error" in v.error_message
    finally:
        with SessionLocal() as db:
            v = db.query(Video).filter(Video.id == video_id).first()
            if v:
                db.delete(v)
                db.commit()


def test_7_has_audio_none_receives_0_85_visual_discount():
    """Scenario 7: has_audio=None (unknown availability) receives conservative 0.85 discount."""
    visual_matches = [
        VisualMatch(
            frame_id="f_none",
            video_id="v_none",
            video_title="UnknownAudio.mp4",
            timestamp=5.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=None,
            video_status="READY",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 -> calibrated 0.50. Unknown audio receives discount 0.85 -> 0.425
    assert results[0].score == pytest.approx(0.50 * 0.85, abs=1e-3)
    assert results[0].confidence_percent == round(0.50 * 0.85 * 100, 1)


def test_8_has_audio_false_and_ready_receives_1_0_discount():
    """Scenario 8: has_audio=False and READY receives 1.0 discount (no penalty for silent video)."""
    visual_matches = [
        VisualMatch(
            frame_id="f_silent",
            video_id="v_silent",
            video_title="SilentVideo.mp4",
            timestamp=5.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=False,
            video_status="READY",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 -> calibrated 0.50. Confirmed silent READY video receives discount 1.0 -> 0.50
    assert results[0].score == pytest.approx(0.50 * 1.0, abs=1e-3)
    assert results[0].confidence_percent == 50.0


def test_9_has_audio_false_and_processing_receives_0_85_discount():
    """Scenario 9: has_audio=False and PROCESSING receives 0.85 discount (incomplete video penalty)."""
    visual_matches = [
        VisualMatch(
            frame_id="f_proc",
            video_id="v_proc",
            video_title="ProcessingVideo.mp4",
            timestamp=5.0,
            preview_url="/f.jpg",
            raw_score=0.25,
            has_audio=False,
            video_status="PROCESSING",
        )
    ]
    results = temporal_consolidator.fuse_multimodal([], visual_matches)
    assert len(results) == 1
    # raw 0.25 -> calibrated 0.50. Incomplete processing receives discount 0.85 -> 0.425
    assert results[0].score == pytest.approx(0.50 * 0.85, abs=1e-3)
    assert results[0].confidence_percent == round(0.50 * 0.85 * 100, 1)


def test_10_existing_ready_video_records_survive_migration_unchanged():
    """Scenario 10: Existing READY video records survive SQLite table rebuild migration unchanged."""
    test_db_path = settings.get_absolute_path(settings.TEMP_DIR) / f"test_migration_{uuid.uuid4().hex[:8]}.db"
    test_db_path.parent.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(str(test_db_path))
    cur = con.cursor()
    # Create old schema with NOT NULL constraint
    cur.execute("""
        CREATE TABLE videos (
            id VARCHAR(36) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            storage_path VARCHAR(512) NOT NULL,
            duration FLOAT,
            width INTEGER,
            height INTEGER,
            fps FLOAT,
            file_size BIGINT NOT NULL,
            mime_type VARCHAR(100),
            has_audio BOOLEAN NOT NULL,
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    cur.execute("""
        CREATE TABLE processing_jobs (
            id VARCHAR(36) NOT NULL,
            video_id VARCHAR(36) NOT NULL,
            stage VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            progress FLOAT NOT NULL,
            error_message TEXT,
            started_at DATETIME NOT NULL,
            completed_at DATETIME,
            PRIMARY KEY (id),
            FOREIGN KEY(video_id) REFERENCES videos (id) ON DELETE CASCADE
        )
    """)
    # Insert existing records: one True, one False
    cur.execute("""
        INSERT INTO videos VALUES
        ('v_ready_1', 'lecture.mp4', 'data/videos/v1.mp4', 120.0, 1920, 1080, 30.0, 5000000, 'video/mp4', 1, 'READY', NULL, '2026-01-01', '2026-01-01'),
        ('v_ready_2', 'silent_clip.mp4', 'data/videos/v2.mp4', 45.0, 1280, 720, 24.0, 2000000, 'video/mp4', 0, 'READY', NULL, '2026-01-01', '2026-01-01')
    """)
    cur.execute("""
        INSERT INTO processing_jobs VALUES
        ('j1', 'v_ready_1', 'COMPLETED', 'COMPLETED', 100.0, NULL, '2026-01-01', '2026-01-01'),
        ('j2', 'v_ready_2', 'COMPLETED', 'COMPLETED', 100.0, NULL, '2026-01-01', '2026-01-01')
    """)
    con.commit()

    # Verify NOT NULL before migration
    cur.execute("PRAGMA table_info(videos)")
    cols = cur.fetchall()
    ha_col = next(c for c in cols if c[1] == "has_audio")
    assert ha_col[3] == 1, "Expected has_audio to be NOT NULL initially"

    # Run table rebuild migration directly on test db
    cur.execute("PRAGMA foreign_keys=OFF")
    cur.execute("""
        CREATE TABLE videos_new (
            id VARCHAR(36) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            storage_path VARCHAR(512) NOT NULL,
            duration FLOAT,
            width INTEGER,
            height INTEGER,
            fps FLOAT,
            file_size BIGINT NOT NULL,
            mime_type VARCHAR(100),
            has_audio BOOLEAN,
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    cur.execute("""
        INSERT INTO videos_new (
            id, original_filename, storage_path, duration, width, height, fps,
            file_size, mime_type, has_audio, status, error_message, created_at, updated_at
            )
        SELECT
            id, original_filename, storage_path, duration, width, height, fps,
            file_size, mime_type, has_audio, status, error_message, created_at, updated_at
        FROM videos
    """)
    cur.execute("DROP TABLE videos")
    cur.execute("ALTER TABLE videos_new RENAME TO videos")
    con.commit()
    cur.execute("PRAGMA foreign_keys=ON")

    # Verify foreign key check passes
    cur.execute("PRAGMA foreign_key_check")
    assert cur.fetchall() == [], "Foreign key constraints violated after migration"

    # Verify column is now nullable
    cur.execute("PRAGMA table_info(videos)")
    cols = cur.fetchall()
    ha_col = next(c for c in cols if c[1] == "has_audio")
    assert ha_col[3] == 0, "Expected has_audio to be nullable after migration"

    # Verify existing records are intact and unchanged
    cur.execute("SELECT id, original_filename, has_audio, status FROM videos ORDER BY id")
    rows = cur.fetchall()
    assert len(rows) == 2
    assert rows[0] == ("v_ready_1", "lecture.mp4", 1, "READY")
    assert rows[1] == ("v_ready_2", "silent_clip.mp4", 0, "READY")

    # Verify new row with NULL has_audio can be inserted
    cur.execute("""
        INSERT INTO videos VALUES
        ('v_new_null', 'new_upload.mp4', 'data/videos/v3.mp4', NULL, NULL, NULL, NULL, 1000, 'video/mp4', NULL, 'UPLOADED', NULL, '2026-01-02', '2026-01-02')
    """)
    con.commit()
    cur.execute("SELECT has_audio FROM videos WHERE id='v_new_null'")
    assert cur.fetchone()[0] is None

    con.close()
    if test_db_path.exists():
        test_db_path.unlink()
