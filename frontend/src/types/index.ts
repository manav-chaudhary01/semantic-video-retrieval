export type VideoStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export type JobStage =
  | 'VALIDATING'
  | 'EXTRACTING_AUDIO'
  | 'TRANSCRIBING'
  | 'SAMPLING_FRAMES'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'COMPLETED'
  | 'FAILED';

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  ffmpeg_available: boolean;
  cuda_available: boolean;
  device: string;
}

export interface Video {
  id: string;
  original_filename: string;
  storage_path?: string;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  file_size: number;
  mime_type?: string | null;
  has_audio: boolean;
  status: VideoStatus;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface VideoUploadResponse {
  video_id: string;
  filename: string;
  status: string;
  message: string;
  job_id: string;
}

export interface ProcessingJobStatus {
  video_id: string;
  job_id: string;
  status: string;
  stage: JobStage;
  progress: number;
  error_message?: string | null;
}

export interface SearchResult {
  video_id: string;
  video_title: string;
  segment_id?: string;
  frame_id?: string;
  start_time: number;
  end_time?: number;
  timestamp?: number;
  text?: string;
  score: number;
  confidence_percent?: number;
  modality: 'text' | 'visual' | 'multimodal';
  preview_url?: string;
  stream_url?: string;
}

export interface SearchResponse {
  query: string;
  modality: string;
  total_results: number;
  results: SearchResult[];
  latency_ms?: number;
}

export interface TranscriptSegment {
  id: string;
  video_id: string;
  start_time: number;
  end_time: number;
  text: string;
  language?: string | null;
  embedding_model?: string | null;
  index_reference?: number | null;
  created_at: string;
}

export interface TranscriptResponse {
  video_id: string;
  language?: string | null;
  total_segments: number;
  segments: TranscriptSegment[];
}

export interface SegmentListResponse {
  total: number;
  items: TranscriptSegment[];
}

export interface VisualFrame {
  id: string;
  video_id: string;
  timestamp: number;
  frame_path?: string | null;
  preview_url: string;
  index_reference?: number | null;
}

export interface VisualFrameListResponse {
  video_id: string;
  total_frames: number;
  frames: VisualFrame[];
}
