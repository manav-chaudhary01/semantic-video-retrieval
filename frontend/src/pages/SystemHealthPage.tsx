import React, { useState } from 'react';
import type { HealthResponse } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { CheckCircle2, Cpu, Film, RefreshCw } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Diagnostics & Readiness</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status of backend services, media decoders, and hardware acceleration.
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
        <LoadingSpinner label="Querying backend health..." />
      ) : currentHealth ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Service Status */}
          <Card title="Backend API" subtitle="FastAPI Core Server">
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-slate-400">Server Status</span>
              <Badge variant={currentHealth.status === 'healthy' ? 'success' : 'danger'} dot>
                {currentHealth.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-slate-400">Version</span>
              <span className="text-xs font-mono font-medium text-slate-200">{currentHealth.version}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-slate-400">Environment</span>
              <span className="text-xs font-mono text-slate-300">{currentHealth.environment}</span>
            </div>
            {latency !== null && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                <span className="text-sm text-slate-400">Round-trip Latency</span>
                <span className="text-xs font-mono text-emerald-400">{latency} ms</span>
              </div>
            )}
          </Card>

          {/* Media Decoder */}
          <Card title="FFmpeg & FFprobe" subtitle="Video Demuxing & Audio Extraction">
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-slate-400">FFmpeg Status</span>
              {currentHealth.ffmpeg_available ? (
                <Badge variant="success" dot>Available in PATH</Badge>
              ) : (
                <Badge variant="danger" dot>Not Detected</Badge>
              )}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2.5">
              <Film className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                {currentHealth.ffmpeg_available
                  ? 'FFmpeg 9.0+ ready for video metadata probing, audio extraction (16kHz mono WAV), and frame extraction.'
                  : 'FFmpeg CLI must be installed to extract audio and frames.'}
              </span>
            </div>
          </Card>

          {/* Hardware Acceleration */}
          <Card title="Hardware Acceleration" subtitle="PyTorch & CUDA Compute">
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-slate-400">CUDA GPU</span>
              {currentHealth.cuda_available ? (
                <Badge variant="success" dot>CUDA Active</Badge>
              ) : (
                <Badge variant="neutral" dot>CPU Only</Badge>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-slate-400">Active Device</span>
              <span className="text-xs font-mono font-medium text-indigo-300 max-w-[180px] truncate text-right">
                {currentHealth.device}
              </span>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <span>
                {currentHealth.cuda_available
                  ? 'Hardware acceleration enabled for Faster-Whisper and Vision Encoder inference.'
                  : 'CPU fallback mode will be used for model inference.'}
              </span>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="flex items-center justify-center p-6 text-slate-400 text-sm">
            Cannot connect to backend. Please verify that the FastAPI backend server is running on port 8000.
          </div>
        </Card>
      )}

      {/* Development Roadmap Stage Info */}
      <Card title="Project Foundation (Phase 1)" subtitle="Scaffolding and Interface Verification">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800">
            <span className="text-slate-400 block mb-1">Architecture</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Phase 0 Verified
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800">
            <span className="text-slate-400 block mb-1">Database Schema</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> SQLite ORM Ready
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800">
            <span className="text-slate-400 block mb-1">Backend Server</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> FastAPI Scaffolding Active
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800">
            <span className="text-slate-400 block mb-1">Frontend UI</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> React 19 + Vite + Tailwind
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
