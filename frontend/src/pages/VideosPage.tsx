import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Film,
  Trash2,
  Play,
  X,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileVideo,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { api } from '../api/client';
import type { Video, ProcessingJobStatus, TranscriptResponse } from '../types';

export const VideosPage: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [activeJob, setActiveJob] = useState<ProcessingJobStatus | null>(null);

  // Preview modal state
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [previewTranscript, setPreviewTranscript] = useState<TranscriptResponse | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getVideos();
      setVideos(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [loadVideos]);

  useEffect(() => {
    if (!previewVideo) {
      setPreviewTranscript(null);
      return;
    }
    if (previewVideo.status === 'READY') {
      setIsLoadingTranscript(true);
      api.getTranscript(previewVideo.id)
        .then((data) => setPreviewTranscript(data))
        .catch(() => setPreviewTranscript(null))
        .finally(() => setIsLoadingTranscript(false));
    }
  }, [previewVideo]);

  // Poll active processing job
  const startPollingJob = useCallback((videoId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const jobStatus = await api.getVideoStatus(videoId);
        setActiveJob(jobStatus);

        if (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          loadVideos();
        }
      } catch {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    }, 1200);
  }, [loadVideos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgressMsg(`Uploading ${file.name}...`);
    setError(null);

    try {
      const res = await api.uploadVideo(file);
      setUploadProgressMsg(`Uploaded. Ingestion in progress...`);
      setActiveJob({
        video_id: res.video_id,
        job_id: res.job_id,
        status: 'RUNNING',
        stage: 'VALIDATING',
        progress: 10,
      });
      startPollingJob(res.video_id);
      loadVideos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setActiveJob(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (videoId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await api.deleteVideo(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (previewVideo?.id === videoId) setPreviewVideo(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    }
  };

  const formatDuration = (seconds?: number | null): string => {
    if (!seconds && seconds !== 0) return '--:--';
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Video Ingestion & Catalog</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload media for speech extraction, metadata probing, and semantic indexing.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadVideos}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh List
        </Button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Upload Dropzone */}
      <Card title="Upload Video" subtitle="Supported formats: MP4, MKV, MOV, AVI, WebM (Max 500 MB)">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".mp4,.mkv,.mov,.avi,.webm"
          className="hidden"
        />

        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (isUploading) return;
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isUploading
              ? 'border-indigo-500 bg-indigo-950/20 cursor-wait'
              : 'border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-900/40'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-md">
            <UploadCloud className="w-6 h-6" />
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-indigo-300">{uploadProgressMsg}</h4>
              <p className="text-xs text-slate-400">Streaming chunks to persistent server storage...</p>
            </div>
          ) : (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-200">
                Click to browse or drag and drop video file
              </h4>
              <p className="text-xs text-slate-500">
                Automatic validation, FFprobe metadata extraction, and audio demuxing
              </p>
            </div>
          )}
        </div>

        {/* Active Ingestion Progress Bar */}
        {activeJob && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-indigo-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                {activeJob.status === 'RUNNING' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                {activeJob.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {activeJob.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                Stage: <span className="font-mono text-indigo-300">{activeJob.stage}</span>
              </span>
              <span className="font-mono text-slate-400">{Math.round(activeJob.progress)}%</span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  activeJob.status === 'FAILED' ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                }`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>

            {activeJob.error_message && (
              <p className="text-xs text-rose-400 mt-1 font-mono">{activeJob.error_message}</p>
            )}
          </div>
        )}
      </Card>

      {/* Videos Catalog List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-200">Stored Videos ({videos.length})</h3>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading video catalog..." />
        ) : videos.length === 0 ? (
          <EmptyState
            title="No Videos Uploaded"
            description="Upload your first long-form video above to begin preprocessing and indexing."
            icon={Film}
            action={
              <Button size="sm" onClick={() => fileInputRef.current?.click()} leftIcon={<UploadCloud className="w-3.5 h-3.5" />}>
                Upload Video
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((vid) => (
              <Card key={vid.id} className="flex flex-col justify-between hover:border-slate-700/80 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                      <FileVideo className="w-5 h-5" />
                    </div>
                    <div>
                      {vid.status === 'READY' && (
                        <Badge variant="success" size="sm" dot>
                          Ready
                        </Badge>
                      )}
                      {vid.status === 'PROCESSING' && (
                        <Badge variant="warning" size="sm" dot>
                          Processing
                        </Badge>
                      )}
                      {vid.status === 'UPLOADED' && (
                        <Badge variant="info" size="sm" dot>
                          Uploaded
                        </Badge>
                      )}
                      {vid.status === 'FAILED' && (
                        <Badge variant="danger" size="sm" dot>
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 truncate" title={vid.original_filename}>
                    {vid.original_filename}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">{vid.id}</p>

                  {/* Metadata specs */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDuration(vid.duration)}</span>
                    </div>

                    <div className="text-right">
                      <span>{formatFileSize(vid.file_size)}</span>
                    </div>

                    <div>
                      <span>
                        {vid.width && vid.height ? `${vid.width}x${vid.height}` : 'No Video'}
                        {vid.fps ? ` @ ${vid.fps}fps` : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {vid.has_audio ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <Volume2 className="w-3 h-3" /> Audio
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                          <VolumeX className="w-3 h-3" /> Silent
                        </span>
                      )}
                    </div>
                  </div>

                  {vid.error_message && (
                    <div className="mt-3 p-2 bg-rose-950/40 border border-rose-900/60 rounded text-xs text-rose-300 font-mono">
                      {vid.error_message}
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewVideo(vid)}
                    disabled={vid.status !== 'READY'}
                    leftIcon={<Play className="w-3 h-3" />}
                  >
                    Watch Preview
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(vid.id, vid.original_filename)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Video Playback & Transcript Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2 truncate">
                <Film className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-100 truncate">{previewVideo.original_filename}</h3>
                {previewTranscript && (
                  <Badge variant="info">
                    {previewTranscript.language?.toUpperCase() ?? 'AUDIO'} &bull; {previewTranscript.total_segments} Segment(s)
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Left Column: Video player */}
              <div className="flex-1 bg-black flex flex-col justify-center items-center p-3">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="w-full max-h-[50vh] lg:max-h-[60vh] rounded-lg shadow-lg"
                  src={api.getVideoStreamUrl(previewVideo.id)}
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Right Column: Indexed Transcripts & Segments */}
              <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/50 flex flex-col max-h-64 lg:max-h-[60vh]">
                <div className="p-3 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Indexed Transcript Segments</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 3 Semantic Index</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {isLoadingTranscript ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <LoadingSpinner size="md" />
                      <span className="text-xs">Loading speech transcript...</span>
                    </div>
                  ) : previewTranscript && previewTranscript.segments.length > 0 ? (
                    previewTranscript.segments.map((seg, idx) => (
                      <div
                        key={seg.id || idx}
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = seg.start_time;
                            videoRef.current.play();
                          }
                        }}
                        className="group p-2.5 bg-slate-900/80 hover:bg-indigo-950/40 border border-slate-800/80 hover:border-indigo-600/50 rounded-xl transition-all cursor-pointer shadow-sm text-left"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-[11px] font-mono group-hover:bg-indigo-900/90 transition-colors">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDuration(seg.start_time)} - {formatDuration(seg.end_time)}
                          </span>
                          {seg.index_reference !== undefined && seg.index_reference !== null && (
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                              FAISS #{seg.index_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-100">
                          {seg.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      {previewVideo.has_audio
                        ? 'No speech detected or transcript empty.'
                        : 'Video has no audio track.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                Duration: {formatDuration(previewVideo.duration)} &bull; {previewVideo.width}x{previewVideo.height}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setPreviewVideo(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
