import type {
  HealthResponse,
  Video,
  VideoUploadResponse,
  ProcessingJobStatus,
  SearchResponse,
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
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, err instanceof Error ? err.message : 'Network connection failed');
  }
}

export const api = {
  // System Health
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  // Videos
  async getVideos(skip: number = 0, limit: number = 50): Promise<{ total: number; items: Video[] }> {
    return request<{ total: number; items: Video[] }>(`/videos?skip=${skip}&limit=${limit}`);
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

  // Search
  async search(query: string, modality: string = 'text', topK: number = 5): Promise<SearchResponse> {
    return request<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, modality, top_k: topK }),
    });
  },
};
