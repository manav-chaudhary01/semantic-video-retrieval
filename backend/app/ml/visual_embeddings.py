import threading
from typing import List, Union, Optional
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from backend.app.core.config import settings
from backend.app.core.logging import logger


class VisualEmbeddingService:
    """Extracts dense normalized 512-d embeddings for visual frames and text queries using CLIP."""

    def __init__(self, model_name: Optional[str] = None):
        target = model_name or settings.VISION_MODEL
        if target in ("ViT-B-32", "vit-b-32", "clip-vit-base-patch32"):
            target = "openai/clip-vit-base-patch32"
        self.model_name = target
        self._lock = threading.Lock()
        self._model = None
        self._processor = None
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

    def _ensure_loaded(self) -> None:
        """Loads CLIP model and processor into memory."""
        if self._model is not None and self._processor is not None:
            return

        with self._lock:
            if self._model is not None and self._processor is not None:
                return

            try:
                logger.info(f"Loading CLIP model '{self.model_name}' on device='{self._device}'...")
                self._model = CLIPModel.from_pretrained(self.model_name).to(self._device)
                self._processor = CLIPProcessor.from_pretrained(self.model_name)
                self._model.eval()
                logger.info(f"CLIP model '{self.model_name}' loaded successfully (dim={settings.VISION_EMBEDDING_DIM}).")
            except Exception as e:
                logger.error(f"Failed to load CLIP vision model: {e}")
                raise

    def embed_images(self, images: List[Image.Image]) -> np.ndarray:
        """Computes L2-normalized 512-dimensional embeddings for a batch of PIL images."""
        if not images:
            return np.empty((0, settings.VISION_EMBEDDING_DIM), dtype=np.float32)

        self._ensure_loaded()

        with torch.no_grad():
            inputs = self._processor(images=images, return_tensors="pt").to(self._device)
            features = self._model.get_image_features(**inputs)
            if hasattr(features, "pooler_output") and features.pooler_output is not None:
                features = features.pooler_output

            # L2 normalization for exact cosine similarity in FAISS IndexFlatIP
            norm = features.norm(p=2, dim=-1, keepdim=True)
            norm = torch.clamp(norm, min=1e-12)
            normalized = features / norm

            return normalized.cpu().numpy().astype(np.float32)

    def embed_text(self, text: str) -> np.ndarray:
        """Computes L2-normalized 512-dimensional embedding for a text query in the shared vision-language space."""
        self._ensure_loaded()

        cleaned_text = text.strip()
        if not cleaned_text:
            return np.zeros((1, settings.VISION_EMBEDDING_DIM), dtype=np.float32)

        with torch.no_grad():
            inputs = self._processor(text=[cleaned_text], return_tensors="pt", padding=True).to(self._device)
            features = self._model.get_text_features(**inputs)
            if hasattr(features, "pooler_output") and features.pooler_output is not None:
                features = features.pooler_output

            # L2 normalization
            norm = features.norm(p=2, dim=-1, keepdim=True)
            norm = torch.clamp(norm, min=1e-12)
            normalized = features / norm

            return normalized.cpu().numpy().astype(np.float32)


visual_embedder = VisualEmbeddingService()
