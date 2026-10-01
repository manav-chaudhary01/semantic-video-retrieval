import threading
from typing import List, Optional
import numpy as np

from backend.app.core.config import settings
from backend.app.core.logging import logger


class TextEmbeddingService:
    """Computes semantic text embeddings using Sentence Transformers."""

    def __init__(
        self,
        model_name: str = settings.TEXT_EMBEDDING_MODEL,
        device: Optional[str] = None,
    ):
        self.model_name = model_name
        self.device = device or self._detect_device()
        self._model = None
        self._lock = threading.Lock()

    def _detect_device(self) -> str:
        """Determines optimal computation device."""
        if settings.WHISPER_DEVICE == "cpu":
            return "cpu"
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except ImportError:
            pass
        return "cpu"

    def _get_model(self):
        """Lazy-loads the Sentence Transformer model once."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer
                    logger.info(f"Loading SentenceTransformer model '{self.model_name}' on device '{self.device}'...")
                    self._model = SentenceTransformer(self.model_name, device=self.device)
                    logger.info(f"SentenceTransformer '{self.model_name}' loaded successfully.")
        return self._model

    def embed_texts(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generates L2-normalized embeddings for a list of text strings."""
        if not texts:
            return np.empty((0, settings.TEXT_EMBEDDING_DIM), dtype=np.float32)

        model = self._get_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return embeddings.astype(np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        """Generates a single L2-normalized embedding for a search query."""
        embeddings = self.embed_texts([query])
        return embeddings[0]


text_embedder = TextEmbeddingService()
