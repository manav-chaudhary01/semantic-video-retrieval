from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.core.logging import logger
import backend.app.models  # Ensure all models are registered with Base.metadata


def init_db() -> None:
    """Creates database tables defined in SQLAlchemy models if they do not exist."""
    logger.info("Initializing SQLite database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("SQLite database tables initialized successfully.")


if __name__ == "__main__":
    init_db()
