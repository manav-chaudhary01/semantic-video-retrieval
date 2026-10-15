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
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { api } from '../api/client';
import type { Video, SearchResponse, SearchResult } from '../types';

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

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState<'text' | 'visual' | 'multimodal'>('multimodal');
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

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    if (overrideQuery) {
      setQuery(overrideQuery);
    }

    setIsSearching(true);
    setError(null);

    try {
      const res = await api.search(
        q,
        modality,
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

      // Auto-select the top result for playback if available
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

  const selectResultForPlayback = (result: SearchResult) => {
    setActiveResult(result);
    // Give state a tick to update video src if changed, then seek
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
          className="bg-indigo-500/30 text-indigo-200 font-medium px-0.5 rounded border border-indigo-500/40"
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Search Header Hero */}
      <div className="text-center max-w-2xl mx-auto pt-2 pb-1">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight sm:text-4xl">
          Semantic Video <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Retrieval</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Search video recordings using spoken dialogue, visual scenes, or multimodal queries. Retrieve exact moments, thumbnails, and direct playback.
        </p>
      </div>

      {/* Search Bar & Controls */}
      <Card className="shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="space-y-4">
          {/* Main Query Input */}
          <div className="flex items-center gap-2 bg-slate-950/90 rounded-xl px-4 py-2.5 border border-slate-700/80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <Search className="w-5 h-5 text-indigo-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                modality === 'multimodal'
                  ? "Search combined speech & visuals, e.g. 'diagram explaining neural network backpropagation'..."
                  : modality === 'visual'
                  ? "Describe visual scene, e.g. 'a person entering the room' or 'slide with mathematical diagrams'..."
                  : "Search spoken dialogue, e.g. 'find where neural network backpropagation is explained'..."
              }
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
              >
                Clear
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

          {/* Quick Query Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> Suggestions:
            </span>
            {currentSuggestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSearch(q)}
                className="text-[11px] bg-slate-800/80 hover:bg-indigo-950/80 hover:text-indigo-300 text-slate-400 border border-slate-700/60 hover:border-indigo-700/60 px-2.5 py-1 rounded-full transition-all cursor-pointer"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>

          {/* Filters & Options Row */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              {/* Modality Selector */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setModality('multimodal')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    modality === 'multimodal'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Multimodal
                </button>

                <button
                  onClick={() => setModality('text')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    modality === 'text'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> Spoken Dialogue
                </button>

                <button
                  onClick={() => setModality('visual')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    modality === 'visual'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> Visual Content
                </button>
              </div>

              {/* Target Video Filter & Top-K Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Video Selector */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">All Indexed Videos</option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.original_filename}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Top-K Selector */}
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Top:</span>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* Threshold Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Min Score:</span>
                  <select
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={0.0}>Any (&ge; 0%)</option>
                    <option value={0.2}>&ge; 20%</option>
                    <option value={0.3}>&ge; 30%</option>
                    <option value={0.4}>&ge; 40%</option>
                    <option value={0.5}>&ge; 50%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Multimodal Fusion Control Sub-Bar */}
            {modality === 'multimodal' && (
              <div className="pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-purple-900/30">
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-medium flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> Fusion Balance:
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setAlpha(0.5); setBeta(0.5); }}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        alpha === 0.5 && beta === 0.5 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Balanced (50/50)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAlpha(0.7); setBeta(0.3); }}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        alpha === 0.7 && beta === 0.3 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Dialogue Focus (70/30)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAlpha(0.3); setBeta(0.7); }}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        alpha === 0.3 && beta === 0.7 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Visual Focus (30/70)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Method:</span>
                    <select
                      value={fusionMethod}
                      onChange={(e) => setFusionMethod(e.target.value as 'linear' | 'rrf')}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-1 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="linear">Calibrated Linear</option>
                      <option value="rrf">Reciprocal Rank (RRF)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Context Window:</span>
                    <select
                      value={temporalWindowSec}
                      onChange={(e) => setTemporalWindowSec(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-1 focus:border-purple-500 focus:outline-none"
                    >
                      <option value={5.0}>&plusmn;5 sec</option>
                      <option value={10.0}>&plusmn;10 sec</option>
                      <option value={15.0}>&plusmn;15 sec</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Error Banner */}
      {error && <ErrorAlert message={error} onRetry={() => handleSearch()} />}

      {/* Interactive Video Player & Results Layout */}
      {searchResponse && searchResponse.results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Synchronized Video Player */}
          <div className="lg:col-span-7 space-y-3 sticky top-4">
            <Card className="p-0 overflow-hidden bg-black border-slate-800 shadow-2xl">
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Film className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {activeResult ? activeResult.video_title : 'Synchronized Video Playback'}
                  </span>
                </div>
                {activeResult && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                        activeResult.modality === 'multimodal'
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                          : activeResult.modality === 'visual'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                      }`}
                    >
                      {activeResult.modality === 'multimodal'
                        ? 'Multimodal Fusion'
                        : activeResult.modality === 'visual'
                        ? 'Visual Scene'
                        : 'Spoken Dialogue'}
                    </span>
                    <Badge variant="neutral">
                      {formatDuration(activeResult.start_time)} - {formatDuration(activeResult.end_time)}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="aspect-video bg-black flex items-center justify-center">
                {activeResult ? (
                  <video
                    ref={videoPlayerRef}
                    controls
                    autoPlay
                    className="w-full h-full"
                    src={activeResult.stream_url ?? api.getVideoStreamUrl(activeResult.video_id)}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Play className="w-8 h-8 opacity-40" />
                    <span>Select a search result moment to start playback</span>
                  </div>
                )}
              </div>

              {activeResult && (
                <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-indigo-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Moment Window: {formatDuration(activeResult.start_time)} to {formatDuration(activeResult.end_time)}
                      {activeResult.peak_time && (
                        <span className="text-slate-400 font-normal">
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

                  <div className="flex items-start gap-3">
                    {activeResult.preview_url && (
                      <div className="relative w-28 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 shrink-0">
                        <img
                          src={activeResult.preview_url}
                          alt="Visual scene snapshot"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {activeResult.modality === 'multimodal' && (
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          {activeResult.text_score !== undefined && activeResult.text_score !== null && (
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Speech: <span className="text-indigo-300">{Math.round(activeResult.text_score * 100)}%</span>
                            </span>
                          )}
                          {activeResult.visual_score !== undefined && activeResult.visual_score !== null && (
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Visual: <span className="text-amber-300">{Math.round(activeResult.visual_score * 100)}%</span>
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                        {activeResult.modality === 'visual' ? (
                          <span className="flex items-center gap-1.5 text-amber-200">
                            <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Retrieved visual frame snapshot at {formatDuration(activeResult.start_time)}
                          </span>
                        ) : (
                          <span>&ldquo;{highlightMatchingTerms(activeResult.text ?? '', searchResponse.query)}&rdquo;</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Ranked Search Results */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-semibold text-slate-200">
                Found {searchResponse.total_results} {searchResponse.modality} moment(s)
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                FAISS Latency: {searchResponse.latency_ms}ms
              </span>
            </div>

            <div className="space-y-2.5">
              {searchResponse.results.map((result, idx) => {
                const resultKey = getResultKey(result);
                const isActive = activeResult ? getResultKey(activeResult) === resultKey : false;
                const scorePercent = result.confidence_percent ?? Math.round(result.score * 100);

                return (
                  <div
                    key={resultKey}
                    onClick={() => selectResultForPlayback(result)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500/30'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[160px]">
                          {result.video_title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[11px] font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDuration(result.start_time)} - {formatDuration(result.end_time)}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border ${
                            scorePercent >= 60
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                              : scorePercent >= 40
                              ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {scorePercent}% match
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mb-2.5">
                      {result.preview_url && (
                        <div className="relative w-24 h-16 rounded-md overflow-hidden bg-slate-950 border border-slate-700/80 shrink-0 group">
                          <img
                            src={result.preview_url}
                            alt={`Scene at ${formatDuration(result.start_time)}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-white">
                            {formatDuration(result.start_time)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded ${
                              result.modality === 'multimodal'
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                : result.modality === 'visual'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                            }`}
                          >
                            {result.modality === 'multimodal'
                              ? 'Multimodal'
                              : result.modality === 'visual'
                              ? 'Visual Scene'
                              : 'Spoken Dialogue'}
                          </span>
                          {result.modality === 'multimodal' && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                              {result.text_score !== undefined && result.text_score !== null && (
                                <span>Speech: {Math.round(result.text_score * 100)}%</span>
                              )}
                              {result.visual_score !== undefined && result.visual_score !== null && (
                                <span>&middot; Visual: {Math.round(result.visual_score * 100)}%</span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {result.modality === 'visual'
                            ? `Visual match for "${searchResponse.query}"`
                            : highlightMatchingTerms(result.text ?? '', searchResponse.query)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
                      <span className="text-slate-500 font-mono">
                        Score: {result.score.toFixed(4)}
                      </span>
                      <Button
                        size="sm"
                        variant={isActive ? 'primary' : 'ghost'}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectResultForPlayback(result);
                        }}
                        leftIcon={<Play className="w-3 h-3" />}
                        className="h-7 text-xs"
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
        <div className="max-w-xl mx-auto pt-6">
          <EmptyState
            title="No Matching Moments Found"
            description={
              searchResponse.modality === 'multimodal'
                ? `No combined dialogue or visual frames matched "${searchResponse.query}" with the current filters. Try relaxing the query or adjusting the fusion balance.`
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
        <div className="max-w-3xl mx-auto pt-8">
          <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-purple-800/50 flex items-center justify-center mx-auto text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">
                Phase 6: Unified Multimodal Fusion Active
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Cross-modal fusion combines speech transcription (<code className="text-indigo-300">all-MiniLM-L6-v2</code>) and visual keyframes (<code className="text-purple-300">CLIP ViT-B/32</code>) with temporal context consolidation.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs border border-slate-700/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Calibrated Score Fusion (&alpha;&middot;Text + &beta;&middot;Visual)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs border border-slate-700/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Temporal Context Window Consolidation
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs border border-slate-700/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Consecutive Frame Clustering & Deduplication
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 text-xs border border-slate-700/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Dual FAISS Search with Sub-30ms Latency
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
