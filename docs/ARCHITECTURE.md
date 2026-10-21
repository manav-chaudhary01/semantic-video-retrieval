# Architecture Specification: Semantic Video Retrieval

## 1. System Overview

**Semantic Video Retrieval** is a full-stack, multimodal deep learning web application that enables natural-language search over long-form videos. The system extracts speech and visual semantics, indexes them into vector search spaces, and provides instant playback at exact timestamps matching user queries.

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + Vite + TypeScript + Tailwind CSS)"]
        UI["Search & Video Player UI"]
        Upload["Video Upload Manager"]
        Results["Ranked Result List & Timestamp Jump"]
    end

    subgraph API ["FastAPI Backend"]
        Router["API Routers (/api/videos, /api/search, /api/health)"]
        ExceptionH["Centralized Exception Handler & Logging"]
        WorkerQueue["Background Task Processing Service"]
    end

    subgraph Storage ["Persistent & File Storage"]
        SQLite[("SQLite Metadata DB")]
        DiskStorage[("Local Disk Storage (data/videos, audio, temp)")]
    end

    subgraph ML_Pipeline ["ML & Ingestion Pipeline"]
        FFmpegProc["FFmpeg/FFprobe Extraction (Audio & Frames)"]
        WhisperProc["Faster-Whisper ASR (Timestamps & Text)"]
        TextEmbed["Sentence-Transformers (Text Vectors - 384d)"]
        VisionEmbed["OpenCLIP / CLIP (Visual Vectors - 512d)"]
    end

    subgraph Retrieval ["Vector Search Engine"]
        FAISS_Text[("FAISS Text Index (IndexFlatIP)")]
        FAISS_Visual[("FAISS Visual Index (IndexFlatIP)")]
        FusionEngine["Multimodal Fusion & Temporal Consolidator"]
    end

    Upload --> Router
    Router --> WorkerQueue
    WorkerQueue --> FFmpegProc
    FFmpegProc --> WhisperProc
    FFmpegProc --> VisionEmbed
    WhisperProc --> TextEmbed
    TextEmbed --> FAISS_Text
    VisionEmbed --> FAISS_Visual
    WorkerQueue --> SQLite
    
    UI --> Router
    Router --> FusionEngine
    FusionEngine --> FAISS_Text
    FusionEngine --> FAISS_Visual
    FusionEngine --> SQLite
    FusionEngine --> Results
```

---

## 2. Core Architectural Principles

1. **Strict Separation of Concerns**:
   - Web server (FastAPI) handles request validation, orchestration, and query dispatch.
   - Long-running ingestion jobs run strictly asynchronously outside HTTP request cycles.
   - Database (SQLite) remains the ground truth for metadata, video properties, and segment timings.
   - Vector indexes (FAISS) are derived artifacts mapped 1:1 to SQLite entity IDs.
2. **Absolute Timestamp Coordinates**:
   - All timestamps (`start_time`, `end_time`, frame timestamps) represent absolute floating-point seconds relative to the original video timeline (`0.0` to `video.duration`).
   - Seeking in the video player operates directly on these coordinates without offsets.
3. **Reproducibility and Modularity**:
   - Vector stores implement a clean abstract base class (`BaseVectorStore`), allowing plug-and-play transitions between FAISS, Qdrant, or Chroma.
   - Embedding models are isolated behind model service abstractions with configurable model weights, devices (`cuda` / `cpu`), and quantization types (`float16`, `int8`).
4. **Resilient Local Development**:
   - Fully local execution without external paid APIs or cloud vendor locks.
   - Graceful fallback: CUDA GPU when present, clean CPU execution when absent.

---

## 3. Component Architecture

### 3.1 Backend Application (`backend/app`)
- **`core/`**: Configuration management (`pydantic-settings`), custom exception classes, structured logging setup.
- **`db/`**: SQLite connection, SQLAlchemy ORM session management, schema initialization.
- **`models/`**: SQLAlchemy ORM models (`Video`, `ProcessingJob`, `TranscriptSegment`, `VisualFrame`, `IndexMetadata`).
- **`schemas/`**: Pydantic v2 schemas for request validation and typed API responses.
- **`api/`**: Modular APIRouters (`health.py`, `videos.py`, `search.py`).
- **`services/`**:
  - `video_service.py`: Video file validation, storage, metadata extraction using FFprobe.
  - `audio_service.py`: Audio extraction to 16kHz mono WAV via FFmpeg.
  - `job_service.py`: Background job state transitions and thread-safe queue.
  - `search_service.py`: Query embedding, FAISS search, result ranking, and temporal consolidation.
- **`ml/`**:
  - `transcription.py`: Faster-Whisper wrapper with segment and word timing extraction.
  - `text_embeddings.py`: Sentence-Transformers (`all-MiniLM-L6-v2`) embedder.
  - `visual_embeddings.py`: OpenCLIP (`ViT-B-32`) frame embedder.
  - `vector_index.py`: FAISS vector index manager with atomic persistence and ID mapping.

### 3.2 Frontend Application (`frontend/src`)
- **`api/`**: Typed Axios/Fetch client with backend API bindings and error handling.
- **`types/`**: TypeScript interfaces mirroring Pydantic backend models.
- **`components/`**:
  - `VideoPlayer`: Custom HTML5 video player with programmatic seek, time-synchronization, and segment bounding.
  - `SearchBar`: Query input with mode selector (Text, Visual, Multimodal) and top-k limits.
  - `ResultCard`: Formatted snippet display showing timestamp badges, relevance scores, and jump buttons.
  - `UploadModal`: Drag-and-drop file upload with live progress tracking and stage updates.
  - `StatusBadge`: Visual indicator of video processing states.
- **`pages/`**:
  - `SearchPage`: Unified search interface and interactive video player.
  - `VideosPage`: Video catalog, upload manager, and pipeline inspection.

---

## 4. Hardware and Computational Profile

- **Operating System**: Windows 11 (PowerShell environment)
- **CPU**: Multi-core x86_64
- **GPU**: NVIDIA GeForce RTX 3050 Laptop GPU (6GB VRAM, CUDA 12/13 compatible)
- **Model Selections**:
  - ASR: Faster-Whisper `base` or `small` (FP16 on GPU, INT8 on CPU; VRAM footprint ~1.2 GB)
  - Text Embeddings: `all-MiniLM-L6-v2` (384 dimensions; VRAM/RAM footprint ~120 MB)
  - Visual Embeddings: `open_clip:ViT-B-32` (`laion2b_s34b_b79k`; 512 dimensions; VRAM footprint ~600 MB)
  - Total combined VRAM usage under peak inference is well within the 6 GB physical ceiling.
