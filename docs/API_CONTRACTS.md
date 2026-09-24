# API Contracts: Semantic Video Retrieval

All endpoints are served with prefix `/api`. Standard JSON errors follow:
```json
{
  "detail": "Error description message"
}
```

---

## 1. System & Health

### `GET /api/health`
Check application readiness and runtime dependencies.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "ffmpeg_available": true,
  "cuda_available": true,
  "device": "cuda:0"
}
```

---

## 2. Videos & Ingestion

### `POST /api/videos`
Upload a new video file. Dispatches an asynchronous background ingestion job.

**Request**: `multipart/form-data`
- `file`: Video binary (`.mp4`, `.mkv`, `.mov`, `.avi`, `.webm`)

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
- `400 Bad Request`: Invalid file format or unreadable header.
- `413 Payload Too Large`: File exceeds configured maximum upload size.

---

### `GET /api/videos`
List all uploaded videos with their current status and metadata.

**Query Parameters**:
- `skip`: (integer, default `0`)
- `limit`: (integer, default `20`)

**Response `200 OK`**:
```json
{
  "total": 1,
  "items": [
    {
      "id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "original_filename": "sample_lecture.mp4",
      "duration": 482.5,
      "width": 1920,
      "height": 1080,
      "fps": 30.0,
      "file_size": 45281920,
      "has_audio": true,
      "status": "READY",
      "created_at": "2026-10-21T07:30:00Z"
    }
  ]
}
```

---

### `GET /api/videos/{video_id}`
Retrieve detailed metadata for a specific video.

**Response `200 OK`**:
```json
{
  "id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "original_filename": "sample_lecture.mp4",
  "duration": 482.5,
  "width": 1920,
  "height": 1080,
  "fps": 30.0,
  "file_size": 45281920,
  "has_audio": true,
  "status": "READY",
  "error_message": null,
  "created_at": "2026-10-21T07:30:00Z",
  "updated_at": "2026-10-21T07:32:15Z"
}
```

---

### `GET /api/videos/{video_id}/status`
Poll the active processing job state for a video.

**Response `200 OK`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "status": "PROCESSING",
  "stage": "TRANSCRIBING",
  "progress": 45.0,
  "error_message": null
}
```

---

### `GET /api/videos/{video_id}/stream`
Stream video content directly to the browser player with HTTP 206 Partial Content Range support.

**Headers**:
- `Range: bytes=0-1048575`

**Response `206 Partial Content`**:
- Binary video stream with `Content-Range` and `Accept-Ranges: bytes`.

---

### `GET /api/videos/{video_id}/transcript`
Retrieve full timestamped transcript segments for a video.

**Response `200 OK`**:
```json
{
  "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
  "language": "en",
  "total_segments": 2,
  "segments": [
    {
      "segment_id": "8f399ef3-8c4d-44aa-9bc1-49bba377b2a1",
      "start_time": 12.4,
      "end_time": 25.8,
      "text": "In this module, we will explore backpropagation in deep neural networks."
    },
    {
      "segment_id": "9a199ef3-8c4d-44aa-9bc1-49bba377b2b2",
      "start_time": 26.0,
      "end_time": 41.2,
      "text": "Notice how the gradient flows backward across each computational layer."
    }
  ]
}
```

---

## 3. Semantic Search

### `POST /api/search`
Perform natural-language semantic retrieval across indexed videos.

**Request Body**:
```json
{
  "query": "explain backpropagation gradient flow",
  "modality": "text",
  "top_k": 5,
  "video_id": null
}
```

**Response `200 OK`**:
```json
{
  "query": "explain backpropagation gradient flow",
  "modality": "text",
  "total_results": 1,
  "results": [
    {
      "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "video_title": "sample_lecture.mp4",
      "segment_id": "9a199ef3-8c4d-44aa-9bc1-49bba377b2b2",
      "start_time": 26.0,
      "end_time": 41.2,
      "text": "Notice how the gradient flows backward across each computational layer.",
      "score": 0.842,
      "modality": "text"
    }
  ]
}
```

---

### `POST /api/search/visual` (Phase 5)
Search visual frames for scenes or objects.

**Request Body**:
```json
{
  "query": "diagram showing gradient descent loss curve",
  "top_k": 5,
  "video_id": null
}
```

**Response `200 OK`**:
```json
{
  "query": "diagram showing gradient descent loss curve",
  "modality": "visual",
  "total_results": 1,
  "results": [
    {
      "video_id": "c8b4df5a-4e4b-4f93-8b77-cfb950dbca81",
      "video_title": "sample_lecture.mp4",
      "frame_id": "4b5d2e01-8b22-4a0b-99f1-3d77a83419bb",
      "timestamp": 31.5,
      "score": 0.791,
      "preview_url": "/api/videos/c8b4df5a-4e4b-4f93-8b77-cfb950dbca81/frames/4b5d2e01.jpg"
    }
  ]
}
```

---

### `POST /api/search/multimodal` (Phase 6)
Perform fused search combining text and visual modalities with configurable weights and temporal consolidation.

**Request Body**:
```json
{
  "query": "neural network architecture diagram",
  "alpha": 0.6,
  "beta": 0.4,
  "top_k": 5,
  "temporal_window_sec": 10.0
}
```
