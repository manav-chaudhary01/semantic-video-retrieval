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

  // Multimodal fusion parameters
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
          className="bg-white/20 text-white font-semibold px-1 rounded border border-white/30"
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
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* 1. Header (Miles Works Header Style) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block">
            Retrieval Workspace
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold font-display uppercase tracking-tight text-white">
            Moment Search
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl font-sans">
            Locate exact sub-second timestamps in video archives through spoken dialogue, visual scene semantics, or multimodal fusion.
          </p>
        </div>

        {/* Modality Segmented Selector (Miles Pill Style) */}
        <div className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-full border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setModality('multimodal')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              modality === 'multimodal'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multimodal</span>
          </button>

          <button
            onClick={() => setModality('text')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              modality === 'text'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Dialogue</span>
          </button>

          <button
            onClick={() => setModality('visual')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              modality === 'visual'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual</span>
          </button>
        </div>
      </div>

      {/* 2. Main Search Console & Query Controls */}
      <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Main Input Field */}
        <div className="flex items-center gap-3 bg-neutral-900/90 rounded-full px-5 py-3 border border-white/15 focus-within:border-white/40 transition-all shadow-md">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modality === 'multimodal'
                ? "Describe spoken dialogue and visual elements (e.g. 'diagram explaining neural network backpropagation')..."
                : modality === 'visual'
                ? "Describe visual scene or slide content (e.g. 'a person entering the room')..."
                : "Search spoken speech dialogue (e.g. 'neural network backpropagation explained')..."
            }
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-neutral-400 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isSearching}
            className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-medium tracking-tight transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {/* Suggestion Prompts */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <span className="text-neutral-400 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-white" /> Prompts:
          </span>
          {currentSuggestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(q)}
              className="text-xs bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 hover:border-white/25 px-3 py-1 rounded-full transition-all cursor-pointer font-sans"
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>

        {/* Filtering & Tuning Parameters */}
        <div className="pt-4 border-t border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Video Scope */}
              <div className="flex items-center gap-2 bg-neutral-900/80 border border-white/10 rounded-full px-3.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-400 font-mono text-[11px] uppercase">Scope:</span>
                <select
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                  className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-neutral-950 text-white">All Indexed Videos ({videos.length})</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id} className="bg-neutral-950 text-white">
                      {v.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top-K Selector */}
              <div className="flex items-center gap-2 bg-neutral-900/80 border border-white/10 rounded-full px-3.5 py-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-400 font-mono text-[11px] uppercase">Top-K:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
                >
                  <option value={3} className="bg-neutral-950 text-white">3 Moments</option>
                  <option value={5} className="bg-neutral-950 text-white">5 Moments</option>
                  <option value={10} className="bg-neutral-950 text-white">10 Moments</option>
                  <option value={20} className="bg-neutral-950 text-white">20 Moments</option>
                </select>
              </div>

              {/* Threshold Filter */}
              <div className="flex items-center gap-2 bg-neutral-900/80 border border-white/10 rounded-full px-3.5 py-1.5">
                <span className="text-neutral-400 font-mono text-[11px] uppercase">Min Match:</span>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="bg-transparent text-white text-xs focus:outline-none cursor-pointer font-mono"
                >
                  <option value={0.0} className="bg-neutral-950 text-white">Any (&ge; 0%)</option>
                  <option value={0.2} className="bg-neutral-950 text-white">&ge; 20%</option>
                  <option value={0.3} className="bg-neutral-950 text-white">&ge; 30%</option>
                  <option value={0.4} className="bg-neutral-950 text-white">&ge; 40%</option>
                  <option value={0.5} className="bg-neutral-950 text-white">&ge; 50%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Multimodal Tuning Controls */}
          {modality === 'multimodal' && (
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs bg-neutral-900/40 p-3.5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" /> Fusion Balance:
                </span>
                <div className="flex items-center gap-1 bg-black p-1 rounded-full border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.5); setBeta(0.5); }}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.5 && beta === 0.5
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    50/50 Balanced
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.7); setBeta(0.3); }}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.7 && beta === 0.3
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    70/30 Dialogue
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAlpha(0.3); setBeta(0.7); }}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                      alpha === 0.3 && beta === 0.7
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    30/70 Visual
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-full px-3 py-1">
                  <span className="text-neutral-400 text-[11px] font-mono uppercase">Method:</span>
                  <select
                    value={fusionMethod}
                    onChange={(e) => setFusionMethod(e.target.value as 'linear' | 'rrf')}
                    className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="linear" className="bg-neutral-950 text-white">Calibrated Linear</option>
                    <option value="rrf" className="bg-neutral-950 text-white">RRF (k=60)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-full px-3 py-1">
                  <span className="text-neutral-400 text-[11px] font-mono uppercase">Window:</span>
                  <select
                    value={temporalWindowSec}
                    onChange={(e) => setTemporalWindowSec(Number(e.target.value))}
                    className="bg-transparent text-white text-xs focus:outline-none cursor-pointer font-mono"
                  >
                    <option value={5.0} className="bg-neutral-950 text-white">&plusmn;5 sec</option>
                    <option value={10.0} className="bg-neutral-950 text-white">&plusmn;10 sec</option>
                    <option value={15.0} className="bg-neutral-950 text-white">&plusmn;15 sec</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onRetry={() => handleSearch()} />}

      {/* 3. Synchronized Player & Ranked Moments (Miles Case Study Layout) */}
      {searchResponse && searchResponse.results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Synchronized Player Column */}
          <div className="lg:col-span-7 space-y-4 sticky top-24">
            <div className="bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-neutral-900/60 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <Film className="w-4 h-4 text-white shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold uppercase font-display text-white truncate">
                    {activeResult ? activeResult.video_title : 'Synchronized Player'}
                  </span>
                </div>
                {activeResult && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="lime" size="sm">
                      {activeResult.modality}
                    </Badge>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-black text-white border border-white/15">
                      {formatDuration(activeResult.start_time)} - {formatDuration(activeResult.end_time)}
                    </span>
                  </div>
                )}
              </div>

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
                  <div className="text-neutral-400 text-xs flex flex-col items-center gap-3">
                    <Play className="w-10 h-10 text-neutral-800" />
                    <span className="font-mono uppercase tracking-wider">Select a moment to play</span>
                  </div>
                )}
              </div>

              {activeResult && (
                <div className="p-5 sm:p-6 bg-neutral-950 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-white flex items-center gap-2 font-medium">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      Interval: {formatDuration(activeResult.start_time)} &rarr; {formatDuration(activeResult.end_time)}
                      {activeResult.peak_time && (
                        <span className="text-neutral-400 font-normal">
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
                      <div className="relative w-32 h-20 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                        <img
                          src={activeResult.preview_url}
                          alt="Visual keyframe"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-white">
                          FRAME
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      {activeResult.modality === 'multimodal' && (
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          {activeResult.text_score !== undefined && activeResult.text_score !== null && (
                            <span className="bg-neutral-900 px-2.5 py-0.5 rounded-full border border-white/10 text-neutral-300">
                              Speech: <span className="text-white font-bold">{Math.round(activeResult.text_score * 100)}%</span>
                            </span>
                          )}
                          {activeResult.visual_score !== undefined && activeResult.visual_score !== null && (
                            <span className="bg-neutral-900 px-2.5 py-0.5 rounded-full border border-white/10 text-neutral-300">
                              Visual: <span className="text-white font-bold">{Math.round(activeResult.visual_score * 100)}%</span>
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-neutral-200 bg-neutral-900/60 p-3.5 rounded-xl border border-white/5 leading-relaxed font-sans">
                        {activeResult.modality === 'visual' ? (
                          <span className="flex items-center gap-2 text-neutral-200">
                            <Eye className="w-4 h-4 text-white shrink-0" />
                            Visual keyframe match at timestamp {formatDuration(activeResult.start_time)}
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

          {/* Ranked Moments List Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1 font-mono">
              <span className="font-semibold text-white uppercase tracking-wider">
                {searchResponse.total_results} Moment(s) Located
              </span>
              <span className="text-neutral-400">
                {searchResponse.latency_ms}ms FAISS Search
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
                    className={`p-5 rounded-2xl border transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-neutral-900/90 border-white/40 shadow-lg'
                        : 'bg-neutral-950 border-white/10 hover:border-white/25 hover:bg-neutral-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-800 text-white">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold uppercase font-display text-white truncate max-w-[180px]">
                          {result.video_title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black text-white border border-white/10 text-xs font-mono">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          {formatDuration(result.start_time)}
                        </span>
                        <span
                          className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                            scorePercent >= 60
                              ? 'bg-white/10 text-white border-white/25'
                              : scorePercent >= 40
                              ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                              : 'bg-neutral-900 text-neutral-400 border-white/10'
                          }`}
                        >
                          {scorePercent}% MATCH
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mb-3">
                      {result.preview_url && (
                        <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                          <img
                            src={result.preview_url}
                            alt={`Scene at ${formatDuration(result.start_time)}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                            {formatDuration(result.start_time)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-white/10">
                            {result.modality}
                          </span>
                          {result.modality === 'multimodal' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                              {result.text_score !== undefined && (
                                <span>Speech: {Math.round(result.text_score * 100)}%</span>
                              )}
                              {result.visual_score !== undefined && (
                                <span>&bull; Visual: {Math.round(result.visual_score * 100)}%</span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed font-sans">
                          {result.modality === 'visual'
                            ? `Visual match for "${searchResponse.query}"`
                            : highlightMatchingTerms(result.text ?? '', searchResponse.query)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10 text-[11px] font-mono">
                      <span className="text-neutral-400">
                        Cosine Score: {result.score.toFixed(4)}
                      </span>
                      <Button
                        size="sm"
                        variant={isActive ? 'primary' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectResultForPlayback(result);
                        }}
                        leftIcon={<Play className="w-3 h-3" />}
                        className="h-7 text-[11px]"
                      >
                        {isActive ? 'Playing' : 'Jump'}
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
          <div className="p-8 sm:p-12 bg-neutral-950 border border-white/10 rounded-2xl text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold font-display uppercase tracking-tight text-white">
                Multimodal Retrieval Console
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-lg mx-auto leading-relaxed font-sans">
                Query indexed videos with spoken speech transcription and visual keyframe vectors.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-left font-mono text-xs">
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5">
                <span className="text-neutral-400 text-[10px] block mb-1 uppercase tracking-widest">01 / CALIBRATION</span>
                <span className="font-medium text-white block">Score Fusion (&alpha;&middot;Text + &beta;&middot;Visual)</span>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5">
                <span className="text-neutral-400 text-[10px] block mb-1 uppercase tracking-widest">02 / TEMPORAL</span>
                <span className="font-medium text-white block">Sliding Window Context Consolidation</span>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5">
                <span className="text-neutral-400 text-[10px] block mb-1 uppercase tracking-widest">03 / VISION</span>
                <span className="font-medium text-white block">Consecutive Frame Clustering</span>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5">
                <span className="text-neutral-400 text-[10px] block mb-1 uppercase tracking-widest">04 / FAISS</span>
                <span className="font-medium text-white block">Dual Vector Cosine Indexing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
