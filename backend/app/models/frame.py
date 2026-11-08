import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VisualFrame(Base):
    __tablename__ = "visual_frames"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id: Mapped[str] = mapped_column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    frame_path: Mapped[str] = mapped_column(String(512), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=True)
    index_reference: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    video = relationship("Video", back_populates="visual_frames")
