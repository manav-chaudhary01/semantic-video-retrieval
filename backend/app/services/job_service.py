import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.models.segment import TranscriptSegment
from backend.app.models.index_meta import IndexMetadata
from backend.app.services.video_service import video_extractor
from backend.app.services.chunking_service import transcript_chunker
from backend.app.ml.transcription import whisper_service
from backend.app.ml.text_embeddings import text_embedder
from backend.app.ml.vector_index import text_vector_index


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobService:
    """Manages asynchronous processing jobs for uploaded video assets."""

    def __init__(self, max_workers: int = 2):
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="video_worker")
        self._lock = threading.Lock()

    def submit_job(self, video_id: str, job_id: str) -> None:
        """Submits video processing job to the thread pool executor."""
        self._executor.submit(self._run_pipeline, video_id, job_id)

    def _run_pipeline(self, video_id: str, job_id: str) -> None:
        """Executes full ingestion, speech recognition, embedding, and vector indexing pipeline."""
        logger.info(f"Starting pipeline execution for video_id={video_id}, job_id={job_id}")

        with SessionLocal() as db:
            video: Optional[Video] = db.query(Video).filter(Video.id == video_id).first()
            job: Optional[ProcessingJob] = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()

            if not video or not job:
                logger.error(f"Cannot run pipeline: Video {video_id} or Job {job_id} not found in DB.")
                return

            video_path = settings.get_absolute_path(Path(video.storage_path))
            audio_path = settings.get_absolute_path(settings.AUDIO_DIR) / f"{video_id}.wav"

            try:
                # Stage 1: VALIDATING & PROBING (15%)
                job.stage = "VALIDATING"
                job.status = "RUNNING"
                job.progress = 15.0
                video.status = "PROCESSING"
                db.commit()

                metadata = video_extractor.probe_video(video_path)
                video.duration = metadata.get("duration")
                video.width = metadata.get("width")
                video.height = metadata.get("height")
                video.fps = metadata.get("fps")
                video.has_audio = metadata.get("has_audio", False)
                db.commit()

                raw_segments = []
                detected_lang = None

                # Stage 2: EXTRACTING AUDIO (35%)
                if video.has_audio:
                    job.stage = "EXTRACTING_AUDIO"
                    job.progress = 35.0
                    db.commit()

                    video_extractor.extract_audio(video_path, audio_path)
                    logger.info(f"Audio extracted successfully for video {video_id}")

                    # Stage 3: TRANSCRIBING (55%)
                    job.stage = "TRANSCRIBING"
                    job.progress = 55.0
                    db.commit()

                    raw_segments, detected_lang = whisper_service.transcribe(audio_path)
                else:
                    logger.info(f"Video {video_id} has no audio stream; skipping transcription and audio extraction.")

                # Stage 4 & 5: EMBEDDING & INDEXING (75% - 90%)
                if raw_segments:
                    # Segment chunking
                    job.stage = "EMBEDDING"
                    job.progress = 75.0
                    db.commit()

                    chunks = transcript_chunker.chunk_segments(raw_segments)
                    logger.info(f"Chunked {len(raw_segments)} raw Whisper units into {len(chunks)} search segment(s)")

                    if chunks:
                        # Create TranscriptSegment entities in SQLite
                        created_segments: List[TranscriptSegment] = []
                        for chunk in chunks:
                            seg = TranscriptSegment(
                                video_id=video_id,
                                start_time=chunk["start_time"],
                                end_time=chunk["end_time"],
                                text=chunk["text"],
                                language=detected_lang,
                                embedding_model=settings.TEXT_EMBEDDING_MODEL,
                            )
                            db.add(seg)
                            created_segments.append(seg)
                        db.commit()

                        # Compute dense text vectors
                        chunk_texts = [c["text"] for c in chunks]
                        embeddings = text_embedder.embed_texts(chunk_texts)

                        # Stage 5: INDEXING (90%)
                        job.stage = "INDEXING"
                        job.progress = 90.0
                        db.commit()

                        # Add to FAISS index
                        segment_ids = [s.id for s in created_segments]
                        assigned_indices = text_vector_index.add(segment_ids, embeddings)

                        # Record FAISS vector ID back into SQLite segments
                        for seg, ref_idx in zip(created_segments, assigned_indices):
                            seg.index_reference = ref_idx
                        db.commit()

                        # Synchronize index metadata table
                        meta = db.query(IndexMetadata).filter(IndexMetadata.index_name == "text_index").first()
                        if not meta:
                            meta = IndexMetadata(
                                index_name="text_index",
                                index_type="IndexFlatIP",
                                model_name=settings.TEXT_EMBEDDING_MODEL,
                                dimension=settings.TEXT_EMBEDDING_DIM,
                                total_vectors=text_vector_index.total_vectors,
                            )
                            db.add(meta)
                        else:
                            meta.total_vectors = text_vector_index.total_vectors
                            meta.last_updated_at = utc_now()
                        db.commit()

                # Pipeline completion
                job.stage = "COMPLETED"
                job.status = "COMPLETED"
                job.progress = 100.0
                job.completed_at = utc_now()
                video.status = "READY"
                db.commit()
                logger.info(f"Pipeline successfully completed for video {video_id}")

            except Exception as exc:
                err_msg = str(exc)
                logger.exception(f"Pipeline failed for video {video_id} during {job.stage}: {err_msg}")
                job.status = "FAILED"
                job.error_message = err_msg
                job.completed_at = utc_now()
                video.status = "FAILED"
                video.error_message = err_msg
                db.commit()


job_service = JobService()
