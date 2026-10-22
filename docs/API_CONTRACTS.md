# API Contracts & Specification: Semantic Video Retrieval

All backend endpoints are served under the `/api` prefix. The API adheres strictly to REST principles, RFC 7233 byte-range streaming, and standard HTTP error semantics.

---

## 1. System & Health

### `GET /api/health`
Checks backend application readiness, active device mode, and FFmpeg installation status.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "ffmpeg_available": true,
  "cuda_available": false,
  "device": "cpu"
}
```

---

## 2. Videos & Ingestion Pipeline

### `POST /api/videos`
Uploads a video file, validates MIME type and file size, and enqueues an asynchronous ingestion job.

**Rate Limit**: 15 requests / minute per client IP.

**Request**: `multipart/form-data`
- `file`: Video binary (`.mp4`, `.mkv`, `.mov`, `.avi`, `.webm`). Max 500MB by default.

**Response `202 Accepted`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "filename": "sample_lecture.mp4",
  "status": "UPLOADED",
  "message": "Video uploaded successfully. Ingestion job queued.",
  "job_id": "a901dc62-c0e8-4221-a3aa-ef12948bbca3"
}
```

**Errors**:
- `400 Bad Request`: Empty filename or unsupported extension.
- `422 Unprocessable Content`: Validation failure.
- `429 Too Many Requests`: Upload rate limit exceeded (includes `Retry-After` header).

---

### `GET /api/videos`
Lists uploaded videos with metadata and processing status.

**Query Parameters**:
- `skip`: Integer (default `0`, ge `0`).
- `limit`: Integer (default `20`, ge `1`, le `100`).

**Response `200 OK`**:
```json
{
  "total": 1,
  "items": [
    {
      "id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "original_filename": "sample_lecture.mp4",
      "storage_path": "data/videos/c8b4df5a-4e4b-4f93-8b77-cfb950dbca81.mp4",
      "file_size": 15423801,
      "duration": 420.5,
      "width": 1920,
      "height": 1080,
      "fps": 30.0,
      "mime_type": "video/mp4",
      "status": "READY",
      "error_message": null,
      "created_at": "2026-10-22T10:00:00Z",
      "updated_at": "2026-10-22T10:01:30Z"
    }
  ]
}
```

---

### `GET /api/videos/{video_id}`
Retrieves detailed metadata for a specific video.

**Path Parameters**:
- `video_id`: UUID string.

**Response `200 OK`**: Video metadata object.
**Errors**: `404 Not Found` if video does not exist.

---

### `GET /api/videos/{video_id}/status`
Polls the real-time background processing status and progress for a video.

**Response `200 OK`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "job_id": "a901dc62-c0e8-4221-a3aa-ef12948bbca3",
  "status": "COMPLETED",
  "stage": "INDEXING",
  "progress": 100.0,
  "error_message": null
}
```

---

### `GET /api/videos/{video_id}/stream`
Streams video content supporting RFC 7233 byte-range seeking and playback.

**Headers**:
- `Range`: (Optional) e.g., `bytes=0-1048575`

**Response `206 Partial Content`** (when `Range` header is provided):
- **Headers**:
  - `Content-Range`: `bytes 0-1048575/15423801`
  - `Content-Length`: `1048576`
  - `Accept-Ranges`: `bytes`
  - `Content-Type`: `video/mp4`
  - `X-Content-Type-Options`: `nosniff`
  - `X-Frame-Options`: `SAMEORIGIN`

**Response `200 OK`** (full stream when no `Range` is provided).
**Response `416 Range Not Satisfiable`** (when requested byte range exceeds video size).

---

### `DELETE /api/videos/{video_id}`
Deletes video record from SQLite and purges associated media files and audio artifacts from disk.

**Response `204 No Content`**

---

## 3. Transcripts and Sampled Visual Frames

### `GET /api/videos/{video_id}/transcript`
Returns full transcribed spoken dialogue with segment timestamps.

**Response `200 OK`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "language": "en",
  "total_segments": 14,
  "segments": [
    {
      "id": "f120aa45-...",
      "start_time": 0.0,
      "end_time": 8.5,
      "text": "Welcome to our overview of deep learning and backpropagation."
    }
  ]
}
```

---

### `GET /api/videos/{video_id}/frames`
Lists all visual keyframe snapshots sampled at fixed temporal intervals (default: 2.0s).

**Response `200 OK`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "total_frames": 210,
  "frames": [
    {
      "id": "e441bc99-...",
      "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "timestamp": 2.0,
      "preview_url": "/api/videos/c8b4df5a-4e4b-4f93-8b77-cfb950dbca81/frames/e441bc99-...",
      "frame_path": "data/frames/c8b4df5a-.../frame_000001_2.00s.jpg",
      "index_reference": 1
    }
  ]
}
```

---

### `GET /api/videos/{video_id}/frames/{frame_id}`
Serves the JPEG image thumbnail for a specific visual keyframe.

**Response `200 OK`**: `image/jpeg` binary image with HTTP caching headers (`Cache-Control: public, max-age=86400`).

---

## 4. Semantic Search

### `POST /api/search`
Executes natural-language semantic vector search across speech dialogue, visual frames, or fused multimodal moments.

**Rate Limit**: 60 requests / minute per client IP.

**Request Body**:
```json
{
  "query": "explanation of neural network loss functions",
  "modality": "text",
  "video_id": null,
  "top_k": 5,
  "threshold": 0.25,
  "alpha": 0.5,
  "beta": 0.5,
  "fusion_method": "linear",
  "temporal_window_sec": 10.0
}
```

**Parameter Details**:
- `query` (str, required): Natural language search query (1 to 500 characters, whitespace-trimmed).
- `modality` (str, optional): `"text"`, `"visual"`, or `"multimodal"` (default: `"text"`).
- `video_id` (str, optional): UUID to restrict search to a single video.
- `top_k` (int, optional): Maximum results to return (1 to 50, default: `5`).
- `threshold` (float, optional): Minimum similarity cutoff in `[0.0, 1.0]`. Results scoring below are omitted.
- `alpha` (float, optional): Weight for text modality in linear fusion (default: `0.5`).
- `beta` (float, optional): Weight for visual modality in linear fusion (default: `0.5`).
- `fusion_method` (str, optional): `"linear"` or `"rrf"` (Reciprocal Rank Fusion, default: `"linear"`).
- `temporal_window_sec` (float, optional): Max seconds for grouping cross-modal evidence (default: `10.0`).

**Response `200 OK`**:
```json
{
  "query": "explanation of neural network loss functions",
  "modality": "text",
  "total_results": 1,
  "latency_ms": 16.85,
  "results": [
    {
      "segment_id": "f120aa45-...",
      "frame_id": null,
      "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "video_title": "sample_lecture.mp4",
      "start_time": 0.0,
      "end_time": 8.5,
      "peak_time": 4.25,
      "text": "Welcome to our overview of deep learning and backpropagation.",
      "score": 0.742,
      "confidence_percent": 74.2,
      "text_score": 0.742,
      "visual_score": null,
      "fused_score": 0.742,
      "modality": "text",
      "preview_url": null,
      "stream_url": "/api/videos/c8b4df5a-4e4b-4f93-8b77-cfb950dbca81/stream"
    }
  ]
}
```

---

### `POST /api/search/multimodal`
Shortcut endpoint configured with `modality="multimodal"`. Fuses dialogue and visual frame embeddings within matching temporal windows.

---

## 5. Security & Error Handling

Standard JSON error schema:
```json
{
  "detail": "Description of the error",
  "extra": {
    "key": "Optional diagnostic details"
  }
}
```

### HTTP Status Codes:
- `200 OK`: Request succeeded.
- `202 Accepted`: Asynchronous task queued.
- `204 No Content`: Resource deleted.
- `206 Partial Content`: Byte-range slice delivered for streaming.
- `400 Bad Request`: Malformed request or invalid file content.
- `403 Forbidden`: Path traversal or security constraint violation.
- `404 Not Found`: Video, frame, or file not found.
- `416 Range Not Satisfiable`: Requested byte-range is out of file bounds.
- `422 Unprocessable Content`: Schema validation failure.
- `429 Too Many Requests`: Rate limit exceeded (includes `Retry-After: <seconds>` header).
- `500 Internal Server Error`: Unhandled server exception.
