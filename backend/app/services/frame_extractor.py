import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import cv2
from PIL import Image

from backend.app.core.config import settings
from backend.app.core.logging import logger


class FrameExtractor:
    """Extracts representative video frames at regular temporal intervals using OpenCV and FFmpeg."""

    def __init__(self, sample_interval: float = settings.FRAME_SAMPLE_INTERVAL_SEC):
        self.sample_interval = sample_interval

    def sample_frames(
        self,
        video_path: Path,
        video_id: str,
        interval: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Samples frames across video duration and saves them as JPEG image files.
        
        Args:
            video_path: Path to the input video file.
            video_id: Identifier of the video entity.
            interval: Sample interval in seconds (defaults to self.sample_interval).
            
        Returns:
            List of dicts containing 'timestamp', 'frame_path' (relative), and 'image' (PIL Image).
        """
        step = interval or self.sample_interval
        video_abs_path = settings.get_absolute_path(video_path)
        frames_dir = settings.get_absolute_path(settings.FRAMES_DIR) / video_id
        frames_dir.mkdir(parents=True, exist_ok=True)

        if not video_abs_path.exists() or video_abs_path.stat().st_size == 0:
            logger.warning(f"Video file missing or empty for frame extraction: {video_abs_path}")
            return []

        cap = cv2.VideoCapture(str(video_abs_path))
        if not cap.isOpened():
            logger.error(f"OpenCV failed to open video file at {video_abs_path}")
            return []

        try:
            fps = cap.get(cv2.CAP_PROP_FPS)
            if not fps or fps <= 0 or fps > 240:
                fps = 25.0

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0.0

            if duration <= 0:
                # Attempt to read duration using CAP_PROP_POS_MSEC after reading first frame
                ret, _ = cap.read()
                if not ret:
                    logger.warning(f"No readable frames found in {video_abs_path}")
                    return []
                duration = 1.0

            logger.info(
                f"Sampling video {video_id} (duration={duration:.2f}s, fps={fps:.2f}) every {step}s..."
            )

            results: List[Dict[str, Any]] = []
            target_timestamps: List[float] = []

            curr_t = 0.0
            while curr_t < duration:
                target_timestamps.append(curr_t)
                curr_t += step

            # If video is shorter than step, sample at least the initial frame at 0.0s
            if not target_timestamps:
                target_timestamps.append(0.0)

            for idx, t in enumerate(target_timestamps):
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
                ret, bgr_frame = cap.read()
                if not ret or bgr_frame is None:
                    continue

                # Convert BGR (OpenCV) to RGB (PIL)
                rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)

                # Save compressed thumbnail to disk (relative path stored in database)
                frame_filename = f"frame_{idx:04d}_{t:.2f}s.jpg"
                frame_disk_path = frames_dir / frame_filename
                pil_image.save(frame_disk_path, "JPEG", quality=85)

                relative_storage_path = str(
                    Path(settings.FRAMES_DIR) / video_id / frame_filename
                ).replace("\\", "/")

                results.append({
                    "timestamp": round(t, 2),
                    "frame_path": relative_storage_path,
                    "image": pil_image,
                })

            logger.info(
                f"Extracted and saved {len(results)} visual frame(s) for video {video_id}"
            )
            return results

        finally:
            cap.release()


frame_extractor = FrameExtractor()
