import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import ProcessingError


class WhisperService:
    """Automatic Speech Recognition service using Faster-Whisper."""

    def __init__(
        self,
        model_size: str = settings.WHISPER_MODEL,
        device: Optional[str] = None,
    ):
        self.model_size = model_size
        self.device = device or self._detect_device()
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self._model = None
        self._lock = threading.Lock()

    def _detect_device(self) -> str:
        """Determines whether CUDA or CPU should be used."""
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
        """Loads WhisperModel once per worker in a thread-safe singleton pattern."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from faster_whisper import WhisperModel
                    logger.info(
                        f"Loading Faster-Whisper '{self.model_size}' on device='{self.device}', compute_type='{self.compute_type}'..."
                    )
                    self._model = WhisperModel(
                        self.model_size,
                        device=self.device,
                        compute_type=self.compute_type,
                    )
                    logger.info(f"Faster-Whisper '{self.model_size}' model loaded successfully.")
        return self._model

    def transcribe(
        self,
        audio_path: Path,
        word_timestamps: bool = True,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Transcribes an audio file and preserves millisecond speech timestamps.
        
        Args:
            audio_path: Path to 16kHz mono WAV audio file.
            word_timestamps: Whether to extract word-level timestamps.
            
        Returns:
            Tuple of (raw_segments, detected_language).
        """
        audio_path = Path(audio_path)
        if not audio_path.exists() or audio_path.stat().st_size == 0:
            logger.warning(f"Audio file is missing or empty at {audio_path}")
            return [], None

        try:
            model = self._get_model()
            logger.info(f"Starting ASR transcription on {audio_path.name}...")
            
            segments_generator, info = model.transcribe(
                str(audio_path),
                beam_size=5,
                word_timestamps=word_timestamps,
                vad_filter=True,  # Filter out silence and noise
                vad_parameters=dict(min_silence_duration_ms=500),
            )

            raw_segments: List[Dict[str, Any]] = []
            for seg in segments_generator:
                text = seg.text.strip()
                if not text:
                    continue
                raw_segments.append({
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": text,
                })

            detected_lang = info.language if info else None
            logger.info(
                f"Transcription complete: {len(raw_segments)} raw segment(s) detected, language='{detected_lang}'"
            )
            return raw_segments, detected_lang

        except Exception as e:
            logger.exception(f"Whisper transcription failed for {audio_path}: {e}")
            raise ProcessingError("TRANSCRIBING", f"Speech recognition failed: {str(e)}")


whisper_service = WhisperService()
