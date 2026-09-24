import pytest
from sqlalchemy import inspect
from backend.app.db.session import engine
from backend.app.db.init_db import init_db
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.models.segment import TranscriptSegment
from backend.app.models.frame import VisualFrame
from backend.app.models.index_meta import IndexMetadata


def test_database_initialization():
    """Verify that all required tables are created in the SQLite database."""
    init_db()
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    assert "videos" in tables
    assert "processing_jobs" in tables
    assert "transcript_segments" in tables
    assert "visual_frames" in tables
    assert "index_metadata" in tables
