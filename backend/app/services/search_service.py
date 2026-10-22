import time
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from backend.app.core.logging import logger
from backend.app.core.exceptions import ValidationError
from backend.app.ml.text_embeddings import text_embedder
from backend.app.ml.vector_index import text_vector_index
from backend.app.models.segment import TranscriptSegment
from backend.app.models.video import Video
from backend.app.schemas.search import SearchRequest, SearchResponse, SearchResultItem


class SearchService:
    """Provides semantic vector search across indexed video transcripts."""

    def search(self, db: Session, req: SearchRequest) -> SearchResponse:
        """Executes semantic search against indexed video speech segments."""
        start_time = time.perf_counter()

        query_text = req.query.strip()
        if not query_text:
            raise ValidationError("Search query cannot be empty or blank.")

        if req.modality not in ("text", "visual", "multimodal"):
            raise ValidationError(f"Unsupported search modality '{req.modality}'. Supported: 'text', 'visual', 'multimodal'.")

        if req.modality in ("visual", "multimodal"):
            # Informative message for future phases
            raise ValidationError(
                f"Modality '{req.modality}' is scheduled for introduction in Phase 5/6. "
                "Current Phase 4 semantic retrieval supports 'text' dialogue search."
            )

        # Early return if index has no vectors yet
        if text_vector_index.total_vectors == 0:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality=req.modality,
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        # 1. Embed query into 384-d normalized dense vector
        query_vector = text_embedder.embed_texts([query_text])[0]

        # 2. Query FAISS index for candidate nearest segments
        candidate_k = min(
            max(req.top_k * 10 if req.video_id else req.top_k * 3, 20),
            text_vector_index.total_vectors,
        )
        raw_matches = text_vector_index.search(query_vector, top_k=candidate_k)
        if not raw_matches:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality=req.modality,
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        # 3. Retrieve segment metadata from SQLite
        candidate_ids = [seg_id for seg_id, _ in raw_matches]
        query = (
            db.query(TranscriptSegment)
            .options(joinedload(TranscriptSegment.video))
            .filter(TranscriptSegment.id.in_(candidate_ids))
        )
        if req.video_id:
            query = query.filter(TranscriptSegment.video_id == req.video_id)

        segments_by_id = {seg.id: seg for seg in query.all()}

        # 4. Assemble ranked results preserving FAISS similarity ranking
        ranked_items: List[SearchResultItem] = []
        for seg_id, score in raw_matches:
            if seg_id not in segments_by_id:
                continue

            seg = segments_by_id[seg_id]

            if req.threshold is not None and score < req.threshold:
                continue

            confidence = round(max(0.0, min(1.0, score)) * 100, 1)
            video_title = seg.video.original_filename if seg.video else "Unknown Video"

            ranked_items.append(
                SearchResultItem(
                    segment_id=seg.id,
                    video_id=seg.video_id,
                    video_title=video_title,
                    start_time=seg.start_time,
                    end_time=seg.end_time,
                    text=seg.text,
                    score=round(score, 4),
                    confidence_percent=confidence,
                    modality="text",
                    stream_url=f"/api/videos/{seg.video_id}/stream",
                )
            )

            if len(ranked_items) >= req.top_k:
                break

        latency = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Search completed for '{query_text}' -> {len(ranked_items)} result(s) in {latency:.2f}ms"
        )

        return SearchResponse(
            query=query_text,
            modality=req.modality,
            total_results=len(ranked_items),
            results=ranked_items,
            latency_ms=round(latency, 2),
        )


search_service = SearchService()
