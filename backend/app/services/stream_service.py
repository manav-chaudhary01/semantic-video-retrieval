import os
from pathlib import Path
from typing import Generator, Tuple, Optional
from fastapi import Request, Response, status
from fastapi.responses import StreamingResponse

from backend.app.core.config import settings
from backend.app.core.exceptions import AppError, SecurityError
from backend.app.core.security import safe_resolve_path


def parse_byte_range(range_header: str, file_size: int) -> Optional[Tuple[int, int]]:
    """Parses 'bytes=start-end' HTTP Range header into valid 0-indexed integer offsets.

    Returns (start, end) or None if the requested range is invalid/unsatisfiable.
    """
    try:
        units, range_str = range_header.strip().split("=")
        if units != "bytes":
            return 0, file_size - 1

        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

        # RFC 7233: If start exceeds file_size or start > end, range is unsatisfiable
        if file_size > 0 and start >= file_size:
            return None
        if start > end:
            return None

        end = min(end, file_size - 1)
        return start, end
    except Exception:
        return 0, file_size - 1


def chunk_generator(file_path: Path, start: int, end: int, chunk_size: int = 1024 * 1024) -> Generator[bytes, None, None]:
    """Yields file slices in manageable binary chunks."""
    with open(file_path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            read_size = min(chunk_size, remaining)
            data = f.read(read_size)
            if not data:
                break
            remaining -= len(data)
            yield data


def create_media_stream_response(file_path: Path, request: Request, media_type: str = "video/mp4") -> Response:
    """Creates an RFC 7233 compliant Partial Content (206) response for video scrubbing and playback."""
    # Enforce safe directory containment to prevent path traversal
    safe_path = safe_resolve_path(file_path, settings.get_absolute_path(settings.DATA_DIR))

    if not safe_path.exists() or not safe_path.is_file():
        raise AppError("Video file does not exist on disk", status_code=status.HTTP_404_NOT_FOUND)

    file_size = os.path.getsize(safe_path)
    range_header = request.headers.get("range")

    base_security_headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "private, max-age=3600",
    }

    if range_header:
        parsed_range = parse_byte_range(range_header, file_size)
        if parsed_range is None:
            # 416 Range Not Satisfiable
            headers = {
                "Content-Range": f"bytes */{file_size}",
                **base_security_headers,
            }
            return Response(
                status_code=416,
                headers=headers,
            )

        start, end = parsed_range
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": media_type,
            **base_security_headers,
        }
        return StreamingResponse(
            chunk_generator(safe_path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            headers=headers,
            media_type=media_type,
        )

    # Full content response
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": media_type,
        **base_security_headers,
    }
    return StreamingResponse(
        chunk_generator(safe_path, 0, file_size - 1),
        status_code=status.HTTP_200_OK,
        headers=headers,
        media_type=media_type,
    )
