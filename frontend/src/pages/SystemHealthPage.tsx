import React, { useState } from 'react';
import type { HealthResponse } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Cpu, Film, RefreshCw, Server } from 'lucide-react';
import { api } from '../api/client';

export interface SystemHealthPageProps {
  initialHealth: HealthResponse | null;
  onRefreshHealth: () => Promise<void>;
  isLoading: boolean;
}

export const SystemHealthPage: React.FC<SystemHealthPageProps> = ({
  initialHealth,
  onRefreshHealth,
  isLoading,
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(initialHealth);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handlePing = async () => {
    setIsRefreshing(true);
    setError(null);
    const start = performance.now();
    try {
      const data = await api.getHealth();
      const end = performance.now();
      setHealth(data);
      setLatency(Math.round(end - start));
      await onRefreshHealth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reach backend API');
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentHealth = health || initialHealth;

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* 1. Header (Miles Works Header Style) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block">
            System Telemetry
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold font-display uppercase tracking-tight text-white">
            Diagnostics ( 24-26 )
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl font-sans">
            Real-time status of backend services, media processing binaries, and hardware inference devices.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePing}
          isLoading={isRefreshing || isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Check Connectivity
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={handlePing} />}

      {isLoading && !currentHealth ? (
        <LoadingSpinner label="Querying backend telemetry..." />
      ) : currentHealth ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Backend Service Status */}
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold font-display uppercase text-white tracking-tight">
                  Backend Service
                </h3>
                <p className="text-xs text-neutral-400 font-sans mt-0.5">FastAPI Core Application</p>
              </div>
              <Badge variant={currentHealth.status === 'healthy' ? 'lime' : 'danger'} dot>
                {currentHealth.status}
              </Badge>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Server Status</span>
                <span className="text-white font-medium capitalize">{currentHealth.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Version</span>
                <span className="text-white font-medium">{currentHealth.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Environment</span>
                <span className="text-white font-medium">{currentHealth.environment}</span>
              </div>
            </div>

            {latency !== null && (
              <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs font-mono">
                <span className="text-neutral-400">Round-trip Ping</span>
                <span className="text-white font-bold">{latency} ms</span>
              </div>
            )}
          </div>

          {/* Card 2: Media Decoder */}
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold font-display uppercase text-white tracking-tight">
                  Media Decoder
                </h3>
                <p className="text-xs text-neutral-400 font-sans mt-0.5">FFmpeg & FFprobe Pipeline</p>
              </div>
              {currentHealth.ffmpeg_available ? (
                <Badge variant="lime" dot>Available</Badge>
              ) : (
                <Badge variant="danger" dot>Missing</Badge>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/5 text-xs text-neutral-300 flex items-start gap-3">
              <Film className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span className="leading-relaxed font-sans">
                {currentHealth.ffmpeg_available
                  ? 'FFmpeg is available in system PATH for container demuxing, 16kHz audio separation, and 1 FPS keyframe extraction.'
                  : 'FFmpeg was not detected in PATH. Audio separation and visual keyframe extraction require FFmpeg.'}
              </span>
            </div>
          </div>

          {/* Card 3: Hardware Acceleration */}
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold font-display uppercase text-white tracking-tight">
                  Compute Device
                </h3>
                <p className="text-xs text-neutral-400 font-sans mt-0.5">PyTorch Inference Runtime</p>
              </div>
              {currentHealth.cuda_available ? (
                <Badge variant="lime" dot>CUDA Active</Badge>
              ) : (
                <Badge variant="neutral" dot>CPU Fallback</Badge>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">Device Target</span>
              <span className="text-white font-medium max-w-[180px] truncate text-right">
                {currentHealth.device}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/5 text-xs text-neutral-300 flex items-start gap-3">
              <Cpu className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span className="leading-relaxed font-sans">
                {currentHealth.cuda_available
                  ? 'CUDA GPU acceleration enabled for Faster-Whisper speech extraction and CLIP ViT-B/32 image embeddings.'
                  : 'Operating in CPU fallback mode for model inference.'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-950 border border-white/10 rounded-2xl p-8 text-center text-neutral-400 text-sm font-mono">
          Cannot reach backend API. Ensure the FastAPI backend server is running on port 8000.
        </div>
      )}

      {/* 2. Architecture Infrastructure Grid (Miles Capabilities Style) */}
      <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold font-display uppercase tracking-tight text-white">
              Architecture Infrastructure
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5 font-sans">
              Core runtime components, storage backends, and embedding models.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
            Pipeline v1.0
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 space-y-1">
            <span className="text-neutral-400 text-[10px] uppercase tracking-wider block">Storage</span>
            <span className="font-semibold text-white flex items-center gap-1.5 uppercase">
              <Server className="w-3.5 h-3.5 text-white" /> SQLite + Media
            </span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 space-y-1">
            <span className="text-neutral-400 text-[10px] uppercase tracking-wider block">Speech Transcription</span>
            <span className="font-semibold text-white flex items-center gap-1.5 uppercase">
              <Server className="w-3.5 h-3.5 text-white" /> Faster-Whisper
            </span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 space-y-1">
            <span className="text-neutral-400 text-[10px] uppercase tracking-wider block">Visual Representation</span>
            <span className="font-semibold text-white flex items-center gap-1.5 uppercase">
              <Server className="w-3.5 h-3.5 text-white" /> CLIP ViT-B/32
            </span>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 space-y-1">
            <span className="text-neutral-400 text-[10px] uppercase tracking-wider block">Vector Index</span>
            <span className="font-semibold text-white flex items-center gap-1.5 uppercase">
              <Server className="w-3.5 h-3.5 text-white" /> FAISS Inner Product
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
