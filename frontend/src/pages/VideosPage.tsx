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

    e.target.value = '';
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgressMsg(`Uploading ${file.name}...`);
    setError(null);

    try {
      const res = await api.uploadVideo(file);
      setUploadProgressMsg(`Uploaded. Processing pipeline running...`);
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
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* 1. Header (Miles Works Header Style) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block">
            Media Archive
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold font-display uppercase tracking-tight text-white">
            Video Library
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl font-sans">
            Upload and manage long-form video assets. Automatic validation, audio demuxing, Faster-Whisper speech extraction, and CLIP visual frame indexing.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadVideos}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Archive
        </Button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* 2. Upload Dropzone Banner (Miles Clean Minimalist Container) */}
      <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-sm sm:text-base font-semibold font-display tracking-tight text-white uppercase">
              Upload Video Asset
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Formats: MP4, MKV, MOV, AVI, WebM (Max 500 MB)
            </p>
          </div>
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest">
            Automatic Ingestion
          </span>
        </div>

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
          className={`border border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer relative overflow-hidden ${
            isUploading
              ? 'border-white bg-neutral-900/60 cursor-wait'
              : 'border-white/15 hover:border-white/40 bg-neutral-900/30 hover:bg-neutral-900/60'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-5 h-5" />
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold font-sans uppercase text-white tracking-wide">
                {uploadProgressMsg}
              </h4>
              <p className="text-xs text-neutral-400 font-mono">
                Streaming media chunks to server storage...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm sm:text-base font-semibold font-sans uppercase text-white tracking-wide">
                Click to browse or drag and drop video file
              </h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                Automatic validation, FFprobe metadata extraction, Faster-Whisper transcription, and CLIP visual frame indexing.
              </p>
            </div>
          )}
        </div>

        {/* Active Processing Progress Bar */}
        {activeJob && (
          <div className="p-4 rounded-xl bg-neutral-900/80 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white flex items-center gap-2">
                {activeJob.status === 'RUNNING' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
                {activeJob.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {activeJob.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                Pipeline Stage: <span className="font-mono text-white uppercase">{activeJob.stage}</span>
              </span>
              <span className="font-mono text-white font-bold">{Math.round(activeJob.progress)}%</span>
            </div>

            <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  activeJob.status === 'FAILED' ? 'bg-rose-500' : 'bg-white'
                }`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>

            {activeJob.error_message && (
              <p className="text-xs text-rose-400 mt-1 font-mono">{activeJob.error_message}</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Videos Catalog Grid (Miles Works Index Style) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-base sm:text-lg font-semibold font-display uppercase tracking-tight text-white">
            Indexed Videos ({videos.length})
          </h3>
          <span className="text-xs font-mono text-neutral-400">
            Persistent Vector Index
          </span>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading video catalog..." />
        ) : videos.length === 0 ? (
          <EmptyState
            title="No Videos Uploaded"
            description="Upload your first long-form video above to begin preprocessing, speech extraction, and visual indexing."
            icon={Film}
            action={
              <Button size="sm" variant="primary" onClick={() => fileInputRef.current?.click()} leftIcon={<UploadCloud className="w-3.5 h-3.5" />}>
                Upload Video
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="bg-neutral-950 border border-white/10 hover:border-white/30 rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                      <FileVideo className="w-4 h-4" />
                    </div>
                    <div>
                      {vid.status === 'READY' && (
                        <Badge variant="lime" size="sm" dot>
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

                  <h4 className="text-base font-semibold font-display uppercase text-white truncate tracking-tight" title={vid.original_filename}>
                    {vid.original_filename}
                  </h4>
                  <p className="text-[10px] font-mono text-neutral-400 mt-1 truncate">{vid.id}</p>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-neutral-300 bg-neutral-900/60 p-3.5 rounded-xl border border-white/5 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-white">{formatDuration(vid.duration)}</span>
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
                          <Volume2 className="w-3.5 h-3.5" /> Audio
                        </span>
                      ) : (
                        <span className="text-neutral-400 flex items-center gap-1 text-[11px]">
                          <VolumeX className="w-3.5 h-3.5" /> Silent
                        </span>
                      )}
                    </div>
                  </div>

                  {vid.error_message && (
                    <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 font-mono">
                      {vid.error_message}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-5 mt-6 border-t border-white/10">
                  <Button
                    size="sm"
                    variant={vid.status === 'READY' ? 'primary' : 'outline'}
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
                    className="text-neutral-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Video Playback & Transcript Modal (Miles Case Study Inspector Style) */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/15 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/60">
              <div className="flex items-center gap-3 truncate">
                <Film className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold uppercase font-display text-white truncate">
                  {previewVideo.original_filename}
                </h3>
                {previewTranscript && (
                  <Badge variant="lime" size="sm">
                    {previewTranscript.language?.toUpperCase() ?? 'AUDIO'} &bull; {previewTranscript.total_segments} Segment(s)
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Left Column: Video Player */}
              <div className="flex-1 bg-black flex flex-col justify-center items-center p-4">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="w-full max-h-[50vh] lg:max-h-[60vh] rounded-2xl shadow-lg border border-white/10"
                  src={api.getVideoStreamUrl(previewVideo.id)}
                >
                  Your browser does not support HTML5 video.
                </video>
              </div>

              {/* Right Column: Indexed Transcripts & Segments */}
              <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-950 flex flex-col max-h-64 lg:max-h-[60vh]">
                <div className="p-4 border-b border-white/10 bg-neutral-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase font-sans text-white">
                    <FileText className="w-3.5 h-3.5 text-white" />
                    <span>Indexed Dialogue</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">Timestamped</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {isLoadingTranscript ? (
                    <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
                      <LoadingSpinner size="md" />
                      <span className="text-xs font-mono">Loading speech transcript...</span>
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
                        className="group p-3.5 bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 hover:border-white/30 rounded-xl transition-all cursor-pointer shadow-sm text-left"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black text-white border border-white/15 text-[11px] font-mono group-hover:border-white/30 transition-colors">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDuration(seg.start_time)} - {formatDuration(seg.end_time)}
                          </span>
                          {seg.index_reference !== undefined && seg.index_reference !== null && (
                            <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-white" />
                              FAISS #{seg.index_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed group-hover:text-white">
                          {seg.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-neutral-400 text-xs font-mono">
                      {previewVideo.has_audio
                        ? 'No speech detected or transcript empty.'
                        : 'Video has no audio track.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-neutral-900/60 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
              <span className="font-mono text-white">
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
