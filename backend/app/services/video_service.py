import json
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from backend.app.core.logging import logger
from backend.app.core.exceptions import InvalidFileError, ProcessingError
from backend.app.services.health_service import ensure_ffmpeg_path


class VideoMetadataExtractor:
    """Extracts media stream characteristics and extracts audio tracks via FFmpeg/FFprobe."""

    def __init__(self):
        ensure_ffmpeg_path()

    def probe_video(self, video_path: Path) -> Dict[str, Any]:
        """Probes video metadata using ffprobe.
        
        Returns a dictionary containing duration, width, height, fps, and audio presence.
        Raises InvalidFileError if media is unreadable or corrupted.
        """
        ensure_ffmpeg_path()
        if not video_path.exists():
            raise InvalidFileError(f"Video file not found at {video_path}")

        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,duration",
            "-of", "json",
            str(video_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
        except subprocess.TimeoutExpired:
            raise InvalidFileError("Media analysis timed out (file may be malformed).")
        except Exception as e:
            raise InvalidFileError(f"Failed to execute ffprobe: {str(e)}")

        if result.returncode != 0:
            logger.error(f"FFprobe error on {video_path}: {result.stderr}")
            raise InvalidFileError(f"Corrupted or unsupported media file: {result.stderr.strip() or 'Unknown ffprobe error'}")

        try:
            probe_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            raise InvalidFileError("Unable to parse media metadata from ffprobe.")

        streams = probe_data.get("streams", [])
        format_info = probe_data.get("format", {})

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        has_audio = any(s.get("codec_type") == "audio" for s in streams)

        if not video_stream:
            raise InvalidFileError("No video stream found in uploaded media file.")

        # Duration
        duration_val: Optional[float] = None
        if "duration" in format_info:
            try:
                duration_val = float(format_info["duration"])
            except (ValueError, TypeError):
                pass
        if duration_val is None and "duration" in video_stream:
            try:
                duration_val = float(video_stream["duration"])
            except (ValueError, TypeError):
                pass

        # Dimensions
        width = video_stream.get("width")
        height = video_stream.get("height")

        # Frame rate
        fps: Optional[float] = None
        r_fps = video_stream.get("r_frame_rate", "")
        if "/" in r_fps:
            try:
                num, den = map(float, r_fps.split("/"))
                if den > 0:
                    fps = round(num / den, 2)
            except (ValueError, ZeroDivisionError):
                pass

        file_size = int(format_info.get("size", video_path.stat().st_size))

        return {
            "duration": duration_val,
            "width": width,
            "height": height,
            "fps": fps,
            "file_size": file_size,
            "has_audio": has_audio,
        }

    def extract_audio(self, video_path: Path, output_audio_path: Path) -> Path:
        """Extracts audio from video to 16kHz mono 16-bit PCM WAV (Whisper format).
        
        Raises ProcessingError if audio extraction fails.
        """
        ensure_ffmpeg_path()
        output_audio_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_audio_path),
        ]

        logger.info(f"Extracting audio: {video_path.name} -> {output_audio_path.name}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            raise ProcessingError("EXTRACTING_AUDIO", "Audio extraction timed out.")
        except Exception as e:
            raise ProcessingError("EXTRACTING_AUDIO", f"Failed to run ffmpeg: {str(e)}")

        if result.returncode != 0 or not output_audio_path.exists() or output_audio_path.stat().st_size == 0:
            logger.error(f"FFmpeg audio extraction error: {result.stderr}")
            raise ProcessingError(
                "EXTRACTING_AUDIO",
                f"Audio extraction failed: {result.stderr.strip() or 'Zero-byte output'}",
            )

        return output_audio_path


video_extractor = VideoMetadataExtractor()
