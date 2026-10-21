import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.services.video_service import video_extractor


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
        """Executes sequential pipeline stages with database transaction guarantees."""
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
                # Stage 1: VALIDATING & PROBING
                job.stage = "VALIDATING"
                job.status = "RUNNING"
                job.progress = 20.0
                video.status = "PROCESSING"
                db.commit()

                metadata = video_extractor.probe_video(video_path)
                video.duration = metadata.get("duration")
                video.width = metadata.get("width")
                video.height = metadata.get("height")
                video.fps = metadata.get("fps")
                video.has_audio = metadata.get("has_audio", False)
                db.commit()

                # Stage 2: EXTRACTING AUDIO
                if video.has_audio:
                    job.stage = "EXTRACTING_AUDIO"
                    job.progress = 50.0
                    db.commit()

                    video_extractor.extract_audio(video_path, audio_path)
                    logger.info(f"Audio extracted successfully for video {video_id}")
                else:
                    logger.info(f"Video {video_id} has no audio stream; skipping audio extraction.")

                # In Phase 2: Ingestion pipeline completes after validation & audio extraction.
                # (Transcribing, embedding, and indexing will hook in during Phases 3 & 5).
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
