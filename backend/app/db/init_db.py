from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.core.logging import logger
import backend.app.models  # Ensure all models are registered with Base.metadata


def migrate_db() -> None:
    """Migrates SQLite schema for videos table if has_audio has a NOT NULL constraint.

    Preserves all existing records, column values, and foreign-key relationships.
    """
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='videos'")
        if not cursor.fetchone():
            return

        cursor.execute("PRAGMA table_info(videos)")
        cols = cursor.fetchall()
        has_audio_col = next((c for c in cols if c[1] == "has_audio"), None)
        if not has_audio_col or has_audio_col[3] == 0:
            # Column is already nullable (notnull == 0) or does not exist
            return

        logger.info("Migrating SQLite schema: converting videos.has_audio to nullable...")
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute("""
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
        cursor.execute("""
            INSERT INTO videos_new (
                id, original_filename, storage_path, duration, width, height, fps,
                file_size, mime_type, has_audio, status, error_message, created_at, updated_at
            )
            SELECT
                id, original_filename, storage_path, duration, width, height, fps,
                file_size, mime_type, has_audio, status, error_message, created_at, updated_at
            FROM videos
        """)
        cursor.execute("DROP TABLE videos")
        cursor.execute("ALTER TABLE videos_new RENAME TO videos")
        raw_conn.commit()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA foreign_key_check")
        fk_errors = cursor.fetchall()
        if fk_errors:
            raise RuntimeError(f"Foreign key integrity check failed after migration: {fk_errors}")
        logger.info("Successfully migrated videos table: has_audio is now nullable.")
    finally:
        raw_conn.close()


def init_db() -> None:
    """Creates database tables defined in SQLAlchemy models if they do not exist, and runs migrations."""
    logger.info("Initializing SQLite database tables...")
    Base.metadata.create_all(bind=engine)
    migrate_db()
    logger.info("SQLite database tables initialized successfully.")


if __name__ == "__main__":
    init_db()
