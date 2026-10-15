import type {
  HealthResponse,
  Video,
  VideoUploadResponse,
  ProcessingJobStatus,
  SearchResponse,
  TranscriptResponse,
  SegmentListResponse,
  VisualFrameListResponse,
} from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const isFormData = options?.body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      headers: {
        ...headers,
        ...options?.headers,
      },
      ...options,
    });

    if (res.status === 204) {
      return null as unknown as T;
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // use default HTTP error
      }
      throw new ApiError(res.status, errorMessage);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Unknown network failure');
  }
}

export const api = {
  // System Health
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  // Videos
  async getVideos(): Promise<{ total: number; items: Video[] }> {
    return request<{ total: number; items: Video[] }>('/videos');
  },

  async getVideo(id: string): Promise<Video> {
    return request<Video>(`/videos/${id}`);
  },

  async getVideoStatus(id: string): Promise<ProcessingJobStatus> {
    return request<ProcessingJobStatus>(`/videos/${id}/status`);
  },

  async uploadVideo(file: File): Promise<VideoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return request<VideoUploadResponse>('/videos', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteVideo(id: string): Promise<void> {
    return request<void>(`/videos/${id}`, {
      method: 'DELETE',
    });
  },

  getVideoStreamUrl(id: string): string {
    return `${API_BASE}/videos/${id}/stream`;
  },

  // Transcripts & Segments (Phase 3)
  async getTranscript(videoId: string): Promise<TranscriptResponse> {
    return request<TranscriptResponse>(`/videos/${videoId}/transcript`);
  },

  async getSegments(videoId: string, skip: number = 0, limit: number = 50): Promise<SegmentListResponse> {
    return request<SegmentListResponse>(`/videos/${videoId}/segments?skip=${skip}&limit=${limit}`);
  },

  // Visual Frames (Phase 5)
  async getVideoFrames(videoId: string): Promise<VisualFrameListResponse> {
    return request<VisualFrameListResponse>(`/videos/${videoId}/frames`);
  },

  getFrameImageUrl(videoId: string, frameId: string): string {
    return `${API_BASE}/videos/${videoId}/frames/${frameId}`;
  },

  // Search (Phase 4 Text, Phase 5 Visual, Phase 6 Multimodal)
  async search(
    query: string,
    modality: string = 'text',
    topK: number = 5,
    videoId?: string,
    threshold?: number,
    options?: {
      alpha?: number;
      beta?: number;
      fusionMethod?: 'linear' | 'rrf';
      temporalWindowSec?: number;
    }
  ): Promise<SearchResponse> {
    const payload: Record<string, unknown> = {
      query,
      modality,
      top_k: topK,
    };
    if (videoId) payload.video_id = videoId;
    if (threshold !== undefined) payload.threshold = threshold;
    if (options?.alpha !== undefined) payload.alpha = options.alpha;
    if (options?.beta !== undefined) payload.beta = options.beta;
    if (options?.fusionMethod !== undefined) payload.fusion_method = options.fusionMethod;
    if (options?.temporalWindowSec !== undefined) payload.temporal_window_sec = options.temporalWindowSec;

    return request<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
