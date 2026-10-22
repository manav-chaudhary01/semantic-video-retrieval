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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[#22271C]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1E14] border border-[#282C20] text-xs font-mono text-[#D2FF00] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D2FF00]" />
            <span>MEDIA ASSET MANAGEMENT</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
            Video Library
          </h1>
          <p className="text-xs sm:text-sm text-[#A5A89C] mt-1.5">
            Upload media for speech extraction, metadata probing, keyframe sampling, and vector indexing.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadVideos}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Library
        </Button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Upload Dropzone */}
      <Card
        title="Upload Video Asset"
        subtitle="Supported formats: MP4, MKV, MOV, AVI, WebM (Max 500 MB)"
      >
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
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer relative overflow-hidden ${
            isUploading
              ? 'border-[#D2FF00] bg-[#1A1E14]/80 cursor-wait'
              : 'border-[#282C20] hover:border-[#D2FF00]/60 bg-[#0B0C0A]/60 hover:bg-[#1A1E14]/40 hover:shadow-[0_0_25px_rgba(210,255,0,0.06)]'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#1A1E14] border border-[#282C20] text-[#D2FF00] flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(210,255,0,0.1)]">
            <UploadCloud className="w-7 h-7 stroke-[1.8]" />
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <h4 className="text-sm sm:text-base font-bold font-sans uppercase text-[#D2FF00] tracking-wide">
                {uploadProgressMsg}
              </h4>
              <p className="text-xs text-[#A5A89C] font-mono">
                Streaming media chunks to persistent server storage...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm sm:text-base font-bold font-sans uppercase text-[#EBEEE0] tracking-wide">
                Click to browse or drag and drop video
              </h4>
              <p className="text-xs text-[#A5A89C] max-w-md mx-auto leading-relaxed">
                Automatic validation, FFprobe metadata extraction, Faster-Whisper transcription, and CLIP ViT keyframe indexing.
              </p>
            </div>
          )}
        </div>

        {/* Active Ingestion Progress Bar */}
        {activeJob && (
          <div className="mt-4 p-4 rounded-xl bg-[#0B0C0A] border border-[#282C20] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#EBEEE0] flex items-center gap-2">
                {activeJob.status === 'RUNNING' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D2FF00]" />}
                {activeJob.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {activeJob.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                Pipeline Stage: <span className="font-mono text-[#D2FF00] uppercase">{activeJob.stage}</span>
              </span>
              <span className="font-mono text-[#D2FF00] font-bold">{Math.round(activeJob.progress)}%</span>
            </div>

            <div className="w-full bg-[#1A1E14] rounded-full h-2 overflow-hidden border border-[#282C20]">
              <div
                className={`h-full transition-all duration-300 ${
                  activeJob.status === 'FAILED' ? 'bg-rose-500' : 'bg-[#D2FF00] shadow-[0_0_10px_#D2FF00]'
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
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base sm:text-lg font-bold font-sans uppercase tracking-tight text-[#EBEEE0]">
            Stored Media ({videos.length})
          </h3>
          <span className="text-xs font-mono text-[#A5A89C]">
            Persistent Library
          </span>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Querying video catalog..." />
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
                className="bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_0_25px_rgba(210,255,0,0.06)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1A1E14] border border-[#282C20] flex items-center justify-center text-[#D2FF00] shrink-0">
                      <FileVideo className="w-5 h-5 stroke-[1.8]" />
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

                  <h4 className="text-sm font-bold uppercase text-[#EBEEE0] truncate tracking-wide" title={vid.original_filename}>
                    {vid.original_filename}
                  </h4>
                  <p className="text-[10px] font-mono text-[#A5A89C] mt-1 truncate">{vid.id}</p>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-[#A5A89C] bg-[#0B0C0A] p-3 rounded-xl border border-[#22271C] font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D2FF00]" />
                      <span className="text-[#EBEEE0]">{formatDuration(vid.duration)}</span>
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
                        <span className="text-[#A5A89C] flex items-center gap-1 text-[11px]">
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
                <div className="flex items-center justify-between pt-4 mt-5 border-t border-[#22271C]">
                  <Button
                    size="sm"
                    variant={vid.status === 'READY' ? 'lime' : 'outline'}
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
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Playback & Transcript Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-[#0B0C0A]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12140F] border border-[#282C20] rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#22271C] bg-[#1A1E14]">
              <div className="flex items-center gap-3 truncate">
                <Film className="w-4 h-4 text-[#D2FF00]" />
                <h3 className="text-sm font-bold uppercase font-sans text-[#EBEEE0] truncate">
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
                className="p-1.5 rounded-xl text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#282C20] transition-colors cursor-pointer"
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
                  className="w-full max-h-[50vh] lg:max-h-[60vh] rounded-2xl shadow-lg"
                  src={api.getVideoStreamUrl(previewVideo.id)}
                >
                  Your browser does not support HTML5 video.
                </video>
              </div>

              {/* Right Column: Indexed Transcripts & Segments */}
              <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#22271C] bg-[#0B0C0A]/80 flex flex-col max-h-64 lg:max-h-[60vh]">
                <div className="p-3.5 border-b border-[#22271C] bg-[#12140F] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase font-sans text-[#EBEEE0]">
                    <FileText className="w-3.5 h-3.5 text-[#D2FF00]" />
                    <span>Indexed Dialogue</span>
                  </div>
                  <span className="text-[10px] text-[#A5A89C] font-mono">Phase 3 Index</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {isLoadingTranscript ? (
                    <div className="py-12 flex flex-col items-center justify-center text-[#A5A89C] gap-2">
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
                        className="group p-3 bg-[#12140F] hover:bg-[#1A1E14] border border-[#22271C] hover:border-[#D2FF00]/50 rounded-xl transition-all cursor-pointer shadow-sm text-left"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1A1E14] text-[#D2FF00] border border-[#282C20] text-[11px] font-mono group-hover:bg-[#282C20] transition-colors">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDuration(seg.start_time)} - {formatDuration(seg.end_time)}
                          </span>
                          {seg.index_reference !== undefined && seg.index_reference !== null && (
                            <span className="text-[10px] text-[#A5A89C] font-mono flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[#D2FF00]" />
                              FAISS #{seg.index_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#A5A89C] leading-relaxed group-hover:text-[#EBEEE0]">
                          {seg.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-[#A5A89C] text-xs font-mono">
                      {previewVideo.has_audio
                        ? 'No speech detected or transcript empty.'
                        : 'Video has no audio track.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#1A1E14] border-t border-[#22271C] flex items-center justify-between text-xs text-[#A5A89C]">
              <span className="font-mono text-[#EBEEE0]">
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
