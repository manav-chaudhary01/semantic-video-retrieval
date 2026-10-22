import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Play,
  Film,
  Clock,
  Mic,
  Eye,
  Layers,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  X,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { api } from '../api/client';
import type { Video, SearchResponse, SearchResult } from '../types';

export interface SearchPageProps {
  initialQuery?: string;
  initialModality?: 'text' | 'visual' | 'multimodal';
}

function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const TEXT_EXAMPLE_QUERIES = [
  'neural network backpropagation and weights',
  'gradient descent optimization algorithms',
  'convolutional neural networks for computer vision',
  'loss function and error minimization',
];

const VISUAL_EXAMPLE_QUERIES = [
  'a person entering the room',
  'lecture slide with mathematical diagrams',
  'red car or bright colored vehicle',
  'computer monitor displaying code',
];

const MULTIMODAL_EXAMPLE_QUERIES = [
  'diagram explaining neural network backpropagation',
  'speaker pointing to loss function chart',
  'demonstration of gradient descent optimization',
  'convolutional neural network layer architecture',
];

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery = '',
  initialModality = 'multimodal',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [modality, setModality] = useState<'text' | 'visual' | 'multimodal'>(initialModality);
  const [topK, setTopK] = useState<number>(5);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(0.0);

  // Multimodal fusion settings (Phase 6)
  const [alpha, setAlpha] = useState<number>(0.5);
  const [beta, setBeta] = useState<number>(0.5);
  const [fusionMethod, setFusionMethod] = useState<'linear' | 'rrf'>('linear');
  const [temporalWindowSec, setTemporalWindowSec] = useState<number>(10.0);

  // Data states
  const [videos, setVideos] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active playing video & segment
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Load available indexed videos on mount
  useEffect(() => {
    api.getVideos()
      .then((res) => {
        const readyVideos = res.items.filter((v) => v.status === 'READY');
        setVideos(readyVideos);
      })
      .catch(() => {
        // Non-blocking if no videos are ready yet
      });
  }, []);

  const handleSearch = async (overrideQuery?: string, overrideModality?: 'text' | 'visual' | 'multimodal') => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    if (overrideQuery) {
      setQuery(overrideQuery);
    }
    const currentModality = overrideModality ?? modality;
    if (overrideModality) {
      setModality(overrideModality);
    }

    setIsSearching(true);
    setError(null);

    try {
      const res = await api.search(
        q,
        currentModality,
        topK,
        selectedVideoId || undefined,
        threshold > 0 ? threshold : undefined,
        {
          alpha,
          beta,
          fusionMethod,
          temporalWindowSec,
        }
      );
      setSearchResponse(res);

      // Auto-select top result for playback if available
      if (res.results.length > 0) {
        selectResultForPlayback(res.results[0]);
      } else {
        setActiveResult(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search request failed.');
      setSearchResponse(null);
    } finally {
      setIsSearching(false);
    }
  };

  // If initialQuery provided on mount, trigger search automatically
  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch(initialQuery.trim(), initialModality);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectResultForPlayback = (result: SearchResult) => {
    setActiveResult(result);
    setTimeout(() => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = Math.max(0, result.start_time);
        videoPlayerRef.current.play().catch(() => {
          // Autoplay policy might require user gesture
        });
      }
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const highlightMatchingTerms = (text: string, currentQuery: string) => {
    if (!text || !currentQuery.trim()) return text;
    const words = currentQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (words.length === 0) return text;
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-[#D2FF00]/25 text-[#D2FF00] font-bold px-1 rounded border border-[#D2FF00]/40"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getResultKey = (r: SearchResult): string => {
    if (r.frame_id) return `frame-${r.frame_id}`;
    if (r.segment_id) return `seg-${r.segment_id}`;
    return `${r.video_id}-${r.start_time}`;
  };

  const currentSuggestions =
    modality === 'multimodal'
      ? MULTIMODAL_EXAMPLE_QUERIES
      : modality === 'visual'
      ? VISUAL_EXAMPLE_QUERIES
      : TEXT_EXAMPLE_QUERIES;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Search Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#22271C]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1E14] border border-[#282C20] text-xs font-mono text-[#D2FF00] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D2FF00]" />
            <span>DEEP RETRIEVAL STUDIO</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
            Moment Search
          </h1>
          <p className="text-xs sm:text-sm text-[#A5A89C] mt-1.5 max-w-xl">
            Query across spoken speech transcripts and visual keyframes with sub-second temporal localization.
          </p>
        </div>

        {/* Modality Segmented Selector */}
        <div className="flex items-center gap-1.5 bg-[#12140F] p-1.5 rounded-2xl border border-[#22271C] self-start md:self-auto">
          <button
            onClick={() => setModality('multimodal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              modality === 'multimodal'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multimodal</span>
          </button>

          <button
            onClick={() => setModality('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              modality === 'text'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Speech</span>
          </button>

          <button
            onClick={() => setModality('visual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              modality === 'visual'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual</span>
          </button>
        </div>
      </div>

      {/* Main Search Bar & Query Controls */}
      <Card className="bg-[#12140F] border border-[#22271C] shadow-2xl p-4 sm:p-6 space-y-4">
        {/* Main Input Field */}
        <div className="flex items-center gap-3 bg-[#0B0C0A] rounded-2xl px-4 py-2.5 sm:py-3 border border-[#282C20] focus-within:border-[#D2FF00] focus-within:shadow-[0_0_20px_rgba(210,255,0,0.15)] transition-all">
          <Search className="w-5 h-5 text-[#D2FF00] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modality === 'multimodal'
                ? "Search spoken speech & visual scene, e.g. 'diagram explaining neural network backpropagation'..."
                : modality === 'visual'
                ? "Describe visual scene, e.g. 'a person entering the room' or 'slide with mathematical diagrams'..."
                : "Search spoken speech dialogue, e.g. 'find where neural network backpropagation is explained'..."
            }
            className="w-full bg-transparent text-sm sm:text-base text-[#EBEEE0] placeholder-[#A5A89C]/50 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-[#A5A89C] hover:text-[#EBEEE0] px-2 py-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => handleSearch()}
            disabled={!query.trim() || isSearching}
            isLoading={isSearching}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Search
          </Button>
        </div>

        {/* Curated Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <span className="text-[#A5A89C] font-mono text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#D2FF00]" /> Prompts:
          </span>
          {currentSuggestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(q)}
              className="text-xs bg-[#1A1E14] hover:bg-[#282C20] hover:text-[#D2FF00] text-[#EBEEE0] border border-[#282C20] hover:border-[#D2FF00]/50 px-3 py-1 rounded-full transition-all cursor-pointer"
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>

        {/* Filter & Tuning Parameters Strip */}
        <div className="pt-4 border-t border-[#22271C] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Video Filter */}
              <div className="flex items-center gap-2 bg-[#1A1E14] border border-[#282C20] rounded-xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-[#D2FF00]" />
                <span className="text-[#A5A89C] font-mono text-[11px] uppercase">Scope:</span>
                <select
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                  className="bg-transparent text-[#EBEEE0] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#12140F]">All Indexed Videos ({videos.length})</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#12140F]">
                      {v.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top-K Selector */}
              <div className="flex items-center gap-2 bg-[#1A1E14] border border-[#282C20] rounded-xl px-3 py-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#D2FF00]" />
                <span className="text-[#A5A89C] font-mono text-[11px] uppercase">Top-K:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-transparent text-[#EBEEE0] text-xs focus:outline-none cursor-pointer"
                >
                  <option value={3} className="bg-[#12140F]">3 Moments</option>
                  <option value={5} className="bg-[#12140F]">5 Moments</option>
                  <option value={10} className="bg-[#12140F]">10 Moments</option>
                  <option value={20} className="bg-[#12140F]">20 Moments</option>
                </select>
              </div>

              {/* Threshold Filter */}
              <div className="flex items-center gap-2 bg-[#1A1E14] border border-[#282C20] rounded-xl px-3 py-1.5">
                <span className="text-[#A5A89C] font-mono text-[11px] uppercase">Min Match:</span>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="bg-transparent text-[#EBEEE0] text-xs focus:outline-none cursor-pointer font-mono"
                >
                  <option value={0.0} className="bg-[#12140F]">Any (&ge; 0%)</option>
                  <option value={0.2} className="bg-[#12140F]">&ge; 20%</option>
                  <option value={0.3} className="bg-[#12140F]">&ge; 30%</option>
                  <option value={0.4} className="bg-[#12140F]">&ge; 40%</option>
                  <option value={0.5} className="bg-[#12140F]">&ge; 50%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Multimodal Tuning Controls (When multimodal is selected) */}
          {modality === 'multimodal' && (
            <div className="pt-3 border-t border-[#22271C] flex flex-wrap items-center justify-between gap-3 text-xs bg-[#1A1E14]/60 p-3 rounded-xl border border-[#282C20]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#D2FF00] font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Fusion Weight:
                </span>
                <div className="flex items-center gap-1 bg-[#12140F] p-1 rounded-xl border border-[#282C20]">
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.5); setBeta(0.5); }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.5 && beta === 0.5
                        ? 'bg-[#D2FF00] text-[#0B0C0A] font-bold'
                        : 'text-[#A5A89C] hover:text-[#EBEEE0]'
                    }`}
                  >
                    50/50 Balanced
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.7); setBeta(0.3); }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.7 && beta === 0.3
                        ? 'bg-[#D2FF00] text-[#0B0C0A] font-bold'
                        : 'text-[#A5A89C] hover:text-[#EBEEE0]'
                    }`}
                  >
                    70/30 Dialogue
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.3); setBeta(0.7); }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.3 && beta === 0.7
                        ? 'bg-[#D2FF00] text-[#0B0C0A] font-bold'
                        : 'text-[#A5A89C] hover:text-[#EBEEE0]'
                    }`}
                  >
                    30/70 Visual
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-[#12140F] border border-[#282C20] rounded-xl px-2.5 py-1">
                  <span className="text-[#A5A89C] text-[11px] font-mono uppercase">Fusion:</span>
                  <select
                    value={fusionMethod}
                    onChange={(e) => setFusionMethod(e.target.value as 'linear' | 'rrf')}
                    className="bg-transparent text-[#EBEEE0] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="linear" className="bg-[#12140F]">Calibrated Linear</option>
                    <option value="rrf" className="bg-[#12140F]">RRF Aggregation</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-[#12140F] border border-[#282C20] rounded-xl px-2.5 py-1">
                  <span className="text-[#A5A89C] text-[11px] font-mono uppercase">Window:</span>
                  <select
                    value={temporalWindowSec}
                    onChange={(e) => setTemporalWindowSec(Number(e.target.value))}
                    className="bg-transparent text-[#EBEEE0] text-xs focus:outline-none cursor-pointer font-mono"
                  >
                    <option value={5.0} className="bg-[#12140F]">&plusmn;5 sec</option>
                    <option value={10.0} className="bg-[#12140F]">&plusmn;10 sec</option>
                    <option value={15.0} className="bg-[#12140F]">&plusmn;15 sec</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error Banner */}
      {error && <ErrorAlert message={error} onRetry={() => handleSearch()} />}

      {/* Interactive Video Player & Results Layout */}
      {searchResponse && searchResponse.results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Synchronized Video Player */}
          <div className="lg:col-span-7 space-y-4 sticky top-24">
            <div className="bg-[#12140F] border border-[#22271C] rounded-3xl overflow-hidden shadow-2xl">
              {/* Video Player Header */}
              <div className="p-4 bg-[#1A1E14] border-b border-[#22271C] flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <Film className="w-4 h-4 text-[#D2FF00] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold uppercase font-sans text-[#EBEEE0] truncate">
                    {activeResult ? activeResult.video_title : 'Synchronized Player'}
                  </span>
                </div>
                {activeResult && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={activeResult.modality === 'multimodal' ? 'purple' : activeResult.modality === 'visual' ? 'warning' : 'info'} size="sm">
                      {activeResult.modality}
                    </Badge>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#12140F] text-[#D2FF00] border border-[#282C20]">
                      {formatDuration(activeResult.start_time)} - {formatDuration(activeResult.end_time)}
                    </span>
                  </div>
                )}
              </div>

              {/* Video Viewport */}
              <div className="aspect-video bg-black flex items-center justify-center relative">
                {activeResult ? (
                  <video
                    ref={videoPlayerRef}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                    src={activeResult.stream_url ?? api.getVideoStreamUrl(activeResult.video_id)}
                  >
                    Your browser does not support HTML5 video.
                  </video>
                ) : (
                  <div className="text-[#A5A89C] text-xs flex flex-col items-center gap-3">
                    <Play className="w-10 h-10 text-[#282C20]" />
                    <span className="font-mono uppercase tracking-wider">Select a moment to play</span>
                  </div>
                )}
              </div>

              {/* Synchronized Moment Info Box */}
              {activeResult && (
                <div className="p-4 sm:p-5 bg-[#12140F] border-t border-[#22271C] space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#D2FF00] flex items-center gap-2 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Interval: {formatDuration(activeResult.start_time)} &rarr; {formatDuration(activeResult.end_time)}
                      {activeResult.peak_time && (
                        <span className="text-[#A5A89C] font-normal">
                          (Peak: {formatDuration(activeResult.peak_time)})
                        </span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (videoPlayerRef.current) {
                          videoPlayerRef.current.currentTime = activeResult.start_time;
                          videoPlayerRef.current.play();
                        }
                      }}
                      leftIcon={<RotateCcw className="w-3 h-3" />}
                    >
                      Replay Moment
                    </Button>
                  </div>

                  <div className="flex items-start gap-4">
                    {activeResult.preview_url && (
                      <div className="relative w-32 h-20 rounded-xl overflow-hidden bg-[#0B0C0A] border border-[#282C20] shrink-0">
                        <img
                          src={activeResult.preview_url}
                          alt="Visual frame keyframe"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 font-mono text-[9px] text-[#D2FF00]">
                          KEYFRAME
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      {activeResult.modality === 'multimodal' && (
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          {activeResult.text_score !== undefined && activeResult.text_score !== null && (
                            <span className="bg-[#1A1E14] px-2.5 py-0.5 rounded-lg border border-[#282C20] text-[#EBEEE0]">
                              Speech: <span className="text-[#D2FF00] font-bold">{Math.round(activeResult.text_score * 100)}%</span>
                            </span>
                          )}
                          {activeResult.visual_score !== undefined && activeResult.visual_score !== null && (
                            <span className="bg-[#1A1E14] px-2.5 py-0.5 rounded-lg border border-[#282C20] text-[#EBEEE0]">
                              Visual: <span className="text-amber-400 font-bold">{Math.round(activeResult.visual_score * 100)}%</span>
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-[#EBEEE0] bg-[#1A1E14] p-3 rounded-xl border border-[#282C20] leading-relaxed">
                        {activeResult.modality === 'visual' ? (
                          <span className="flex items-center gap-2 text-amber-300">
                            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                            Visual keyframe scene match at timestamp {formatDuration(activeResult.start_time)}
                          </span>
                        ) : (
                          <span>&ldquo;{highlightMatchingTerms(activeResult.text ?? '', searchResponse.query)}&rdquo;</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Ranked Moments Stream */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-[#A5A89C] px-1 font-mono">
              <span className="font-bold text-[#EBEEE0] uppercase">
                {searchResponse.total_results} Moment(s) Found
              </span>
              <span className="text-[#D2FF00]">
                {searchResponse.latency_ms}ms FAISS Latency
              </span>
            </div>

            <div className="space-y-3">
              {searchResponse.results.map((result, idx) => {
                const resultKey = getResultKey(result);
                const isActive = activeResult ? getResultKey(activeResult) === resultKey : false;
                const scorePercent = result.confidence_percent ?? Math.round(result.score * 100);

                return (
                  <div
                    key={resultKey}
                    onClick={() => selectResultForPlayback(result)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                      isActive
                        ? 'bg-[#1A1E14] border-[#D2FF00] shadow-[0_0_25px_rgba(210,255,0,0.15)] ring-1 ring-[#D2FF00]'
                        : 'bg-[#12140F] border-[#22271C] hover:border-[#38402A] hover:bg-[#1A1E14]/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-[#282C20] text-[#D2FF00]">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-xs sm:text-sm font-bold uppercase font-sans text-[#EBEEE0] truncate max-w-[180px]">
                          {result.video_title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1A1E14] text-[#EBEEE0] border border-[#282C20] text-xs font-mono">
                          <Clock className="w-3 h-3 text-[#D2FF00]" />
                          {formatDuration(result.start_time)}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                            scorePercent >= 60
                              ? 'bg-[#D2FF00]/10 text-[#D2FF00] border-[#D2FF00]/30 shadow-[0_0_8px_rgba(210,255,0,0.15)]'
                              : scorePercent >= 40
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-[#1A1E14] text-[#A5A89C] border-[#282C20]'
                          }`}
                        >
                          {scorePercent}% MATCH
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mb-3">
                      {result.preview_url && (
                        <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-[#0B0C0A] border border-[#282C20] shrink-0 group">
                          <img
                            src={result.preview_url}
                            alt={`Scene at ${formatDuration(result.start_time)}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-[#D2FF00]">
                            {formatDuration(result.start_time)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-[#1A1E14] text-[#A5A89C] border border-[#282C20]">
                            {result.modality}
                          </span>
                          {result.modality === 'multimodal' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A5A89C] font-mono">
                              {result.text_score !== undefined && (
                                <span>Speech: {Math.round(result.text_score * 100)}%</span>
                              )}
                              {result.visual_score !== undefined && (
                                <span>&bull; Visual: {Math.round(result.visual_score * 100)}%</span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[#EBEEE0] line-clamp-2 leading-relaxed">
                          {result.modality === 'visual'
                            ? `Visual match for "${searchResponse.query}"`
                            : highlightMatchingTerms(result.text ?? '', searchResponse.query)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[#22271C] text-[11px] font-mono">
                      <span className="text-[#A5A89C]">
                        Raw Score: {result.score.toFixed(4)}
                      </span>
                      <Button
                        size="sm"
                        variant={isActive ? 'lime' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectResultForPlayback(result);
                        }}
                        leftIcon={<Play className="w-3 h-3" />}
                        className="h-7 text-[11px]"
                      >
                        {isActive ? 'Playing Now' : 'Jump to Moment'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Zero Results State */}
      {searchResponse && searchResponse.results.length === 0 && !isSearching && (
        <div className="max-w-xl mx-auto pt-8">
          <EmptyState
            title="No Matching Moments Found"
            description={
              searchResponse.modality === 'multimodal'
                ? `No combined dialogue or visual keyframes matched "${searchResponse.query}" with the current filters. Try relaxing the query or adjusting the fusion balance.`
                : searchResponse.modality === 'visual'
                ? `No visual frames matched "${searchResponse.query}" with the current filters. Try describing the visual elements differently or lowering the similarity threshold.`
                : `No spoken dialogue matched "${searchResponse.query}" with the current filters. Try relaxing the search query or lowering the similarity threshold.`
            }
            icon={Search}
            action={
              threshold > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setThreshold(0.0);
                    handleSearch();
                  }}
                >
                  Reset Threshold to 0%
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Initial Clean State */}
      {!searchResponse && !isSearching && (
        <div className="max-w-4xl mx-auto pt-6">
          <div className="p-8 bg-[#12140F] border border-[#22271C] rounded-3xl text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1A1E14] border border-[#282C20] flex items-center justify-center mx-auto text-[#D2FF00] shadow-[0_0_20px_rgba(210,255,0,0.1)]">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-sans uppercase tracking-tight text-[#EBEEE0]">
                Multimodal Retrieval Engine Ready
              </h3>
              <p className="text-xs sm:text-sm text-[#A5A89C] mt-1.5 max-w-lg mx-auto leading-relaxed">
                Dual FAISS vector indices consolidate speech transcription (<code className="text-[#D2FF00]">all-MiniLM-L6-v2</code>) and visual keyframes (<code className="text-[#D2FF00]">CLIP ViT-B/32</code>) with temporal context consolidation.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-left">
              <div className="p-3.5 rounded-xl bg-[#1A1E14] border border-[#282C20] text-xs">
                <span className="font-mono text-[#D2FF00] text-[10px] block mb-1">01 / CALIBRATION</span>
                <span className="font-medium text-[#EBEEE0]">Score Fusion (&alpha;&middot;Text + &beta;&middot;Visual)</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#1A1E14] border border-[#282C20] text-xs">
                <span className="font-mono text-[#D2FF00] text-[10px] block mb-1">02 / TEMPORAL</span>
                <span className="font-medium text-[#EBEEE0]">Sliding Window Context Consolidation</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#1A1E14] border border-[#282C20] text-xs">
                <span className="font-mono text-[#D2FF00] text-[10px] block mb-1">03 / VISION</span>
                <span className="font-medium text-[#EBEEE0]">Consecutive Frame Clustering & Dedup</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#1A1E14] border border-[#282C20] text-xs">
                <span className="font-mono text-[#D2FF00] text-[10px] block mb-1">04 / SPEED</span>
                <span className="font-medium text-[#EBEEE0]">Dual Vector Search Sub-30ms Latency</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
