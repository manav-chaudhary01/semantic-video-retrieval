from typing import Any, Dict, List
from backend.app.core.config import settings


class TranscriptChunker:
    """Groups raw speech recognition timestamps into semantically cohesive, searchable segments."""

    def __init__(
        self,
        target_duration: float = settings.CHUNK_TARGET_DURATION_SEC,
        max_words: int = settings.CHUNK_MAX_WORDS,
        max_pause: float = settings.CHUNK_MAX_PAUSE_SEC,
    ):
        self.target_duration = target_duration
        self.max_words = max_words
        self.max_pause = max_pause

    def chunk_segments(self, raw_segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Consolidates consecutive Whisper segments into cohesive chunks without distorting timestamps.
        
        Args:
            raw_segments: List of dicts with 'start', 'end', and 'text' keys.
            
        Returns:
            List of dicts with 'start_time', 'end_time', and 'text'.
        """
        if not raw_segments:
            return []

        chunks: List[Dict[str, Any]] = []
        current_chunk_texts: List[str] = []
        current_start: float = raw_segments[0]["start"]
        current_end: float = raw_segments[0]["end"]
        current_words: int = 0

        for seg in raw_segments:
            text = seg.get("text", "").strip()
            if not text:
                continue

            seg_start = float(seg["start"])
            seg_end = float(seg["end"])
            word_count = len(text.split())

            # Evaluate split criteria:
            # 1. Significant pause between current end and next start
            pause = seg_start - current_end
            exceeds_pause = pause > self.max_pause and len(current_chunk_texts) > 0

            # 2. Accumulated duration exceeds target
            accumulated_duration = seg_end - current_start
            exceeds_duration = accumulated_duration >= self.target_duration and len(current_chunk_texts) > 0

            # 3. Accumulated word count exceeds max words
            exceeds_words = (current_words + word_count) >= self.max_words and len(current_chunk_texts) > 0

            if exceeds_pause or exceeds_duration or exceeds_words:
                # Finalize current segment
                chunks.append({
                    "start_time": round(current_start, 3),
                    "end_time": round(current_end, 3),
                    "text": " ".join(current_chunk_texts),
                })
                # Reset for next segment
                current_chunk_texts = [text]
                current_start = seg_start
                current_end = seg_end
                current_words = word_count
            else:
                # Accumulate into current segment
                if not current_chunk_texts:
                    current_start = seg_start
                current_chunk_texts.append(text)
                current_end = seg_end
                current_words += word_count

        # Flush trailing segment if any text remains
        if current_chunk_texts:
            chunks.append({
                "start_time": round(current_start, 3),
                "end_time": round(current_end, 3),
                "text": " ".join(current_chunk_texts),
            })

        return chunks


transcript_chunker = TranscriptChunker()
