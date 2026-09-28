import os
from pathlib import Path
from typing import Generator, Tuple
from fastapi import Request, status
from fastapi.responses import StreamingResponse
from backend.app.core.exceptions import AppError


def parse_byte_range(range_header: str, file_size: int) -> Tuple[int, int]:
    """Parses 'bytes=start-end' HTTP Range header into valid 0-indexed integer offsets."""
    try:
        units, range_str = range_header.strip().split("=")
        if units != "bytes":
            raise ValueError()

        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

        if start >= file_size:
            start = file_size - 1
        if end >= file_size:
            end = file_size - 1
        if start > end:
            start = end

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


def create_media_stream_response(file_path: Path, request: Request, media_type: str = "video/mp4") -> StreamingResponse:
    """Creates an RFC 7233 compliant Partial Content (206) response for video scrubbing and playback."""
    if not file_path.exists():
        raise AppError("Video file does not exist on disk", status_code=status.HTTP_404_NOT_FOUND)

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    if range_header:
        start, end = parse_byte_range(range_header, file_size)
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": media_type,
        }
        return StreamingResponse(
            chunk_generator(file_path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            headers=headers,
            media_type=media_type,
        )

    # Full content response
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": media_type,
    }
    return StreamingResponse(
        chunk_generator(file_path, 0, file_size - 1),
        status_code=status.HTTP_200_OK,
        headers=headers,
        media_type=media_type,
    )
