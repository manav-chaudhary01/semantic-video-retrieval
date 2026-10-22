import time
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import ValidationError
from backend.app.ml.text_embeddings import text_embedder
from backend.app.ml.visual_embeddings import visual_embedder
from backend.app.ml.vector_index import text_vector_index, visual_vector_index
from backend.app.models.segment import TranscriptSegment
from backend.app.models.frame import VisualFrame
from backend.app.models.video import Video
from backend.app.services.temporal_consolidator import (
    temporal_consolidator,
    TextMatch,
    VisualMatch,
)
from backend.app.schemas.search import SearchRequest, SearchResponse, SearchResultItem


class SearchService:
    """Provides semantic vector search across indexed video transcripts and visual frames."""

    def search(self, db: Session, req: SearchRequest) -> SearchResponse:
        """Executes semantic search against indexed video assets using dense vector embeddings."""
        start_time = time.perf_counter()

        query_text = req.query.strip()
        if not query_text:
            raise ValidationError("Search query cannot be empty or blank.")

        if req.modality not in ("text", "visual", "multimodal"):
            raise ValidationError(
                f"Unsupported search modality '{req.modality}'. Supported: 'text', 'visual', 'multimodal'."
            )

        if req.modality == "multimodal":
            return self._search_multimodal(db, req, query_text, start_time)

        if req.modality == "visual":
            return self._search_visual(db, req, query_text, start_time)

        return self._search_text(db, req, query_text, start_time)

    def _search_text(
        self, db: Session, req: SearchRequest, query_text: str, start_time: float
    ) -> SearchResponse:
        """Executes semantic search over spoken dialogue transcript segments."""
        if text_vector_index.total_vectors == 0:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality=req.modality,
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        # 1. Embed query into 384-d normalized vector
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

        # 4. Assemble ranked results
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
            f"Text search for '{query_text}' -> {len(ranked_items)} result(s) in {latency:.2f}ms"
        )

        return SearchResponse(
            query=query_text,
            modality="text",
            total_results=len(ranked_items),
            results=ranked_items,
            latency_ms=round(latency, 2),
        )

    def _search_visual(
        self, db: Session, req: SearchRequest, query_text: str, start_time: float
    ) -> SearchResponse:
        """Executes cross-modal visual retrieval using CLIP text encoder and visual FAISS index."""
        if visual_vector_index.total_vectors == 0:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality="visual",
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        # 1. Embed text query using CLIP text encoder (512-d normalized)
        query_vector = visual_embedder.embed_text(query_text)[0]

        # 2. Query visual FAISS index
        candidate_k = min(
            max(req.top_k * 10 if req.video_id else req.top_k * 3, 20),
            visual_vector_index.total_vectors,
        )
        raw_matches = visual_vector_index.search(query_vector, top_k=candidate_k)
        if not raw_matches:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality="visual",
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        # 3. Retrieve frame metadata from SQLite
        candidate_ids = [frame_id for frame_id, _ in raw_matches]
        query = (
            db.query(VisualFrame)
            .options(joinedload(VisualFrame.video))
            .filter(VisualFrame.id.in_(candidate_ids))
        )
        if req.video_id:
            query = query.filter(VisualFrame.video_id == req.video_id)

        frames_by_id = {f.id: f for f in query.all()}

        # 4. Assemble ranked visual moments
        ranked_items: List[SearchResultItem] = []
        for frame_id, score in raw_matches:
            if frame_id not in frames_by_id:
                continue

            frame = frames_by_id[frame_id]
            if req.threshold is not None and score < req.threshold:
                continue

            confidence = round(max(0.0, min(1.0, score)) * 100, 1)
            video_title = frame.video.original_filename if frame.video else "Unknown Video"

            ranked_items.append(
                SearchResultItem(
                    frame_id=frame.id,
                    video_id=frame.video_id,
                    video_title=video_title,
                    start_time=frame.timestamp,
                    end_time=frame.timestamp + settings.FRAME_SAMPLE_INTERVAL_SEC,
                    text=f"Visual scene at {frame.timestamp:.1f}s",
                    score=round(score, 4),
                    confidence_percent=confidence,
                    modality="visual",
                    preview_url=f"/api/videos/{frame.video_id}/frames/{frame.id}",
                    stream_url=f"/api/videos/{frame.video_id}/stream",
                )
            )

            if len(ranked_items) >= req.top_k:
                break

        latency = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Visual search for '{query_text}' -> {len(ranked_items)} result(s) in {latency:.2f}ms"
        )

        return SearchResponse(
            query=query_text,
            modality="visual",
            total_results=len(ranked_items),
            results=ranked_items,
            latency_ms=round(latency, 2),
        )

    def _search_multimodal(
        self, db: Session, req: SearchRequest, query_text: str, start_time: float
    ) -> SearchResponse:
        """Executes calibrated multimodal fusion search across text dialogue and visual frames."""
        if text_vector_index.total_vectors == 0 and visual_vector_index.total_vectors == 0:
            latency = (time.perf_counter() - start_time) * 1000
            return SearchResponse(
                query=query_text,
                modality="multimodal",
                total_results=0,
                results=[],
                latency_ms=round(latency, 2),
            )

        text_matches: List[TextMatch] = []
        visual_matches: List[VisualMatch] = []

        # 1. Retrieve Candidate Text Matches
        if text_vector_index.total_vectors > 0 and req.alpha > 0.0:
            query_vector_text = text_embedder.embed_texts([query_text])[0]
            cand_k_text = min(
                max(req.top_k * 10 if req.video_id else req.top_k * 5, 25),
                text_vector_index.total_vectors,
            )
            raw_text = text_vector_index.search(query_vector_text, top_k=cand_k_text)
            if raw_text:
                candidate_ids = [seg_id for seg_id, _ in raw_text]
                q_text = (
                    db.query(TranscriptSegment)
                    .options(joinedload(TranscriptSegment.video))
                    .filter(TranscriptSegment.id.in_(candidate_ids))
                )
                if req.video_id:
                    q_text = q_text.filter(TranscriptSegment.video_id == req.video_id)

                segments_by_id = {s.id: s for s in q_text.all()}
                for seg_id, score in raw_text:
                    if seg_id in segments_by_id:
                        seg = segments_by_id[seg_id]
                        v_title = seg.video.original_filename if seg.video else "Unknown Video"
                        text_matches.append(
                            TextMatch(
                                segment_id=seg.id,
                                video_id=seg.video_id,
                                video_title=v_title,
                                start_time=seg.start_time,
                                end_time=seg.end_time,
                                text=seg.text,
                                raw_score=score,
                            )
                        )

        # 2. Retrieve Candidate Visual Frame Matches
        if visual_vector_index.total_vectors > 0 and req.beta > 0.0:
            query_vector_visual = visual_embedder.embed_text(query_text)[0]
            cand_k_visual = min(
                max(req.top_k * 10 if req.video_id else req.top_k * 5, 25),
                visual_vector_index.total_vectors,
            )
            raw_vis = visual_vector_index.search(query_vector_visual, top_k=cand_k_visual)
            if raw_vis:
                candidate_ids = [frame_id for frame_id, _ in raw_vis]
                q_vis = (
                    db.query(VisualFrame)
                    .options(joinedload(VisualFrame.video))
                    .filter(VisualFrame.id.in_(candidate_ids))
                )
                if req.video_id:
                    q_vis = q_vis.filter(VisualFrame.video_id == req.video_id)

                frames_by_id = {f.id: f for f in q_vis.all()}
                for frame_id, score in raw_vis:
                    if frame_id in frames_by_id:
                        frame = frames_by_id[frame_id]
                        v_title = frame.video.original_filename if frame.video else "Unknown Video"
                        visual_matches.append(
                            VisualMatch(
                                frame_id=frame.id,
                                video_id=frame.video_id,
                                video_title=v_title,
                                timestamp=frame.timestamp,
                                preview_url=f"/api/videos/{frame.video_id}/frames/{frame.id}",
                                raw_score=score,
                            )
                        )

        # 3. Consolidate and Fuse Cross-Modal Evidence
        fused_results = temporal_consolidator.fuse_multimodal(
            text_matches=text_matches,
            visual_matches=visual_matches,
            alpha=req.alpha,
            beta=req.beta,
            fusion_method=req.fusion_method,
            temporal_window_sec=req.temporal_window_sec,
            frame_interval_sec=settings.FRAME_SAMPLE_INTERVAL_SEC,
            top_k=req.top_k,
            threshold=req.threshold,
        )

        latency = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Multimodal search for '{query_text}' (alpha={req.alpha}, beta={req.beta}) "
            f"-> {len(fused_results)} moment(s) in {latency:.2f}ms"
        )

        return SearchResponse(
            query=query_text,
            modality="multimodal",
            total_results=len(fused_results),
            results=fused_results,
            latency_ms=round(latency, 2),
        )


search_service = SearchService()
