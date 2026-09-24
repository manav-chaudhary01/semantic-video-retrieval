from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General
    PROJECT_NAME: str = "Semantic Video Retrieval"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_PREFIX: str = "/api"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Storage Paths (resolved relative to workspace root)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Path = Field(default=Path("data"))
    VIDEOS_DIR: Path = Field(default=Path("data/videos"))
    AUDIO_DIR: Path = Field(default=Path("data/audio"))
    INDEXES_DIR: Path = Field(default=Path("data/indexes"))
    TEMP_DIR: Path = Field(default=Path("data/temp"))
    DATABASE_URL: str = "sqlite:///./data/metadata.db"

    # Ingestion Constraints
    MAX_UPLOAD_SIZE_MB: int = 500
    ALLOWED_EXTENSIONS: List[str] = [".mp4", ".mkv", ".mov", ".avi", ".webm"]

    # Model Defaults (configured for later phases)
    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "auto"
    TEXT_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    VISION_MODEL: str = "ViT-B-32"

    def get_absolute_path(self, path: Path) -> Path:
        """Resolve a storage path relative to workspace BASE_DIR if not absolute."""
        if path.is_absolute():
            return path
        return self.BASE_DIR / path


settings = Settings()
