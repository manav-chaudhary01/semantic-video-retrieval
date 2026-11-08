from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IndexMetadata(Base):
    __tablename__ = "index_metadata"

    index_name: Mapped[str] = mapped_column(String(50), primary_key=True)
    index_type: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    total_vectors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
