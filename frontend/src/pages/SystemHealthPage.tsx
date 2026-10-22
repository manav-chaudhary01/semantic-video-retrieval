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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[#22271C]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1E14] border border-[#282C20] text-xs font-mono text-[#D2FF00] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D2FF00]" />
            <span>INFRASTRUCTURE TELEMETRY</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
            System Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-[#A5A89C] mt-1.5">
            Real-time status of backend microservices, media decoders, and hardware acceleration devices.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Service Status */}
          <Card title="Backend API" subtitle="FastAPI Core Server & Index Gateway">
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">Server Status</span>
              <Badge variant={currentHealth.status === 'healthy' ? 'lime' : 'danger'} dot>
                {currentHealth.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">Version</span>
              <span className="text-xs font-mono font-medium text-[#EBEEE0]">{currentHealth.version}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">Environment</span>
              <span className="text-xs font-mono text-[#EBEEE0]">{currentHealth.environment}</span>
            </div>
            {latency !== null && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#22271C]">
                <span className="text-xs text-[#A5A89C]">Round-trip Latency</span>
                <span className="text-xs font-mono text-[#D2FF00] font-bold">{latency} ms</span>
              </div>
            )}
          </Card>

          {/* Media Decoder */}
          <Card title="FFmpeg & FFprobe" subtitle="Video Demuxing & Audio Extraction">
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">FFmpeg Status</span>
              {currentHealth.ffmpeg_available ? (
                <Badge variant="lime" dot>Available in PATH</Badge>
              ) : (
                <Badge variant="danger" dot>Not Detected</Badge>
              )}
            </div>
            <div className="mt-4 p-3.5 rounded-xl bg-[#0B0C0A] border border-[#22271C] text-xs text-[#A5A89C] flex items-start gap-3">
              <Film className="w-4 h-4 text-[#D2FF00] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {currentHealth.ffmpeg_available
                  ? 'FFmpeg 9.0+ ready for video metadata probing, audio extraction (16kHz mono WAV), and keyframe extraction.'
                  : 'FFmpeg CLI must be installed to extract audio and frames.'}
              </span>
            </div>
          </Card>

          {/* Hardware Acceleration */}
          <Card title="Hardware Acceleration" subtitle="PyTorch & CUDA Compute">
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">CUDA GPU</span>
              {currentHealth.cuda_available ? (
                <Badge variant="lime" dot>CUDA Active</Badge>
              ) : (
                <Badge variant="neutral" dot>CPU Only</Badge>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#A5A89C]">Active Device</span>
              <span className="text-xs font-mono font-medium text-[#D2FF00] max-w-[180px] truncate text-right">
                {currentHealth.device}
              </span>
            </div>
            <div className="mt-4 p-3.5 rounded-xl bg-[#0B0C0A] border border-[#22271C] text-xs text-[#A5A89C] flex items-start gap-3">
              <Cpu className="w-4 h-4 text-[#D2FF00] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {currentHealth.cuda_available
                  ? 'Hardware acceleration enabled for Faster-Whisper and Vision Encoder inference.'
                  : 'CPU fallback mode will be used for model inference.'}
              </span>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="flex items-center justify-center p-8 text-[#A5A89C] text-sm font-mono">
            Cannot connect to backend. Please verify that the FastAPI backend server is running on port 8000.
          </div>
        </Card>
      )}

      {/* Development Roadmap Stage Info */}
      <Card title="Project Foundation (Phase 0 - 8)" subtitle="Verified Full-Stack Architecture Readiness">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-2">
          <div className="p-4 rounded-xl bg-[#0B0C0A] border border-[#22271C]">
            <span className="text-[#A5A89C] block mb-1 font-mono text-[10px] uppercase">Architecture</span>
            <span className="font-bold text-[#EBEEE0] flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D2FF00]" /> Phase 0-2 Pipeline
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#0B0C0A] border border-[#22271C]">
            <span className="text-[#A5A89C] block mb-1 font-mono text-[10px] uppercase">Semantic Index</span>
            <span className="font-bold text-[#EBEEE0] flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D2FF00]" /> Whisper + FAISS
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#0B0C0A] border border-[#22271C]">
            <span className="text-[#A5A89C] block mb-1 font-mono text-[10px] uppercase">Visual & Fusion</span>
            <span className="font-bold text-[#EBEEE0] flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D2FF00]" /> CLIP ViT + RRF
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#0B0C0A] border border-[#22271C]">
            <span className="text-[#A5A89C] block mb-1 font-mono text-[10px] uppercase">Reliability & Sec</span>
            <span className="font-bold text-[#EBEEE0] flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D2FF00]" /> Hardened & Tested
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
