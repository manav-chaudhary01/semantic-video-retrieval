export type VideoStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export type JobStage =
  | 'VALIDATING'
  | 'EXTRACTING_AUDIO'
  | 'TRANSCRIBING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'SAMPLING_FRAMES'
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

export interface ProcessingJobStatus {
  video_id: string;
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
  modality: 'text' | 'visual' | 'multimodal';
  preview_url?: string;
}

export interface SearchResponse {
  query: string;
  modality: string;
  total_results: number;
  results: SearchResult[];
}
