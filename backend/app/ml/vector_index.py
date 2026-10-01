import json
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np

from backend.app.core.config import settings
from backend.app.core.logging import logger


class BaseVectorStore(ABC):
    """Abstract interface for vector stores (FAISS, Qdrant, Chroma)."""

    @abstractmethod
    def add(self, entity_ids: List[str], vectors: np.ndarray) -> List[int]:
        """Adds normalized vectors and binds them to external entity IDs."""
        pass

    @abstractmethod
    def search(self, query_vector: np.ndarray, top_k: int = 5) -> List[Tuple[str, float]]:
        """Searches vector space and returns list of (entity_id, similarity_score)."""
        pass

    @abstractmethod
    def save(self) -> None:
        """Persists index and ID mappings to storage."""
        pass

    @abstractmethod
    def load(self) -> None:
        """Loads index and ID mappings from storage."""
        pass

    @property
    @abstractmethod
    def total_vectors(self) -> int:
        pass


class FaissTextIndex(BaseVectorStore):
    """FAISS exact inner-product (cosine similarity) index with persistent ID mapping."""

    def __init__(
        self,
        dimension: int = settings.TEXT_EMBEDDING_DIM,
        index_file: Optional[Path] = None,
        id_map_file: Optional[Path] = None,
    ):
        self.dimension = dimension
        self.index_file = settings.get_absolute_path(index_file or settings.TEXT_INDEX_FILE)
        self.id_map_file = settings.get_absolute_path(id_map_file or settings.TEXT_ID_MAP_FILE)

        self._lock = threading.Lock()
        self._id_map: Dict[int, str] = {}  # faiss_int_id -> entity_uuid
        self._reverse_map: Dict[str, int] = {}  # entity_uuid -> faiss_int_id
        self._index = None

        self._initialize()

    def _initialize(self) -> None:
        """Loads existing index from disk or creates a new IndexFlatIP."""
        try:
            import faiss
        except ImportError:
            logger.error("FAISS package is not installed.")
            return

        with self._lock:
            if self.index_file.exists() and self.id_map_file.exists():
                try:
                    logger.info(f"Loading persistent FAISS index from {self.index_file.name}")
                    self._index = faiss.read_index(str(self.index_file))
                    with open(self.id_map_file, "r", encoding="utf-8") as f:
                        raw_map = json.load(f)
                        self._id_map = {int(k): v for k, v in raw_map.items()}
                        self._reverse_map = {v: int(k) for k, v in raw_map.items()}
                    logger.info(f"Loaded FAISS text index with {self._index.ntotal} vectors.")
                    return
                except Exception as e:
                    logger.warning(f"Failed to load existing index: {e}. Reinitializing a fresh index.")

            logger.info(f"Initializing fresh FAISS IndexFlatIP(dim={self.dimension})")
            self._index = faiss.IndexFlatIP(self.dimension)
            self._id_map = {}
            self._reverse_map = {}

    @property
    def total_vectors(self) -> int:
        return self._index.ntotal if self._index is not None else 0

    def add(self, entity_ids: List[str], vectors: np.ndarray) -> List[int]:
        """Adds L2-normalized vectors and assigns sequential integer references."""
        if len(entity_ids) == 0:
            return []

        import faiss

        if vectors.ndim == 1:
            vectors = np.expand_dims(vectors, axis=0)

        # Ensure float32 dtype
        vectors = vectors.astype(np.float32)

        # L2-normalize vectors so Inner Product == Cosine Similarity
        faiss.normalize_L2(vectors)

        assigned_indices: List[int] = []

        with self._lock:
            start_idx = self._index.ntotal
            self._index.add(vectors)

            for i, entity_id in enumerate(entity_ids):
                idx = start_idx + i
                self._id_map[idx] = entity_id
                self._reverse_map[entity_id] = idx
                assigned_indices.append(idx)

            self.save()

        return assigned_indices

    def search(self, query_vector: np.ndarray, top_k: int = 5) -> List[Tuple[str, float]]:
        """Searches index for nearest vectors, returning (entity_id, similarity_score)."""
        if self._index is None or self._index.ntotal == 0:
            return []

        import faiss

        if query_vector.ndim == 1:
            query_vector = np.expand_dims(query_vector, axis=0)

        query_vector = query_vector.astype(np.float32)
        faiss.normalize_L2(query_vector)

        with self._lock:
            actual_k = min(top_k, self._index.ntotal)
            scores, indices = self._index.search(query_vector, actual_k)

        results: List[Tuple[str, float]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx in self._id_map:
                results.append((self._id_map[idx], float(score)))

        return results

    def save(self) -> None:
        """Persists the FAISS index binary and ID map JSON to disk."""
        if self._index is None:
            return

        import faiss

        self.index_file.parent.mkdir(parents=True, exist_ok=True)
        temp_index = self.index_file.with_suffix(".tmp")
        faiss.write_index(self._index, str(temp_index))
        temp_index.replace(self.index_file)

        temp_map = self.id_map_file.with_suffix(".tmp")
        with open(temp_map, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in self._id_map.items()}, f, indent=2)
        temp_map.replace(self.id_map_file)

    def load(self) -> None:
        """Explicitly reloads index from disk."""
        self._initialize()


text_vector_index = FaissTextIndex()
