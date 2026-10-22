import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowRight,
  Layers,
  Mic,
  Eye,
  Film,
  Play,
  Activity,
  Check,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { gsap, ScrollTrigger } from '../utils/lenis';

export interface HomePageProps {
  onNavigateToSearch: (initialQuery?: string, modality?: 'text' | 'visual' | 'multimodal') => void;
  onNavigateToVideos: () => void;
  onNavigateToDiagnostics: () => void;
}

const BENCHMARK_QUERIES = [
  {
    text: 'neural network backpropagation and weights',
    modality: 'text' as const,
    type: 'Speech Dialogue',
  },
  {
    text: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
    type: 'Visual Keyframe',
  },
  {
    text: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
    type: 'Cross-Modal Fusion',
  },
  {
    text: 'a person entering the room',
    modality: 'visual' as const,
    type: 'Visual Keyframe',
  },
  {
    text: 'gradient descent optimization algorithms',
    modality: 'text' as const,
    type: 'Speech Dialogue',
  },
  {
    text: 'speaker pointing to loss function chart',
    modality: 'multimodal' as const,
    type: 'Cross-Modal Fusion',
  },
];

const PIPELINE_STAGES = [
  {
    index: '01',
    label: 'Query Expression',
    title: 'Natural-Language Intent',
    subtitle: 'Search in human language without predefined keyword tags or exact filename matching.',
    technical: 'Sentence tokenization & embedding',
    details:
      'Users describe spoken statements or visual elements. Queries like "find where the speaker discusses gradient descent" or "show the slide with architecture diagrams" capture semantic intent directly.',
  },
  {
    index: '02',
    label: 'Dual Latent Spaces',
    title: 'Speech & Visual Projection',
    subtitle: 'Independent dense vector embeddings for audio transcription and keyframe scenes.',
    technical: 'Faster-Whisper (384d) + CLIP ViT-B/32 (512d)',
    details:
      'Spoken audio is transcribed into timestamped segments and mapped to text vector space. Visual frames sampled at 1 FPS are mapped to visual-semantic space, enabling cross-modal cosine similarity search.',
  },
  {
    index: '03',
    label: 'Temporal Consolidation',
    title: 'Cross-Modal Alignment',
    subtitle: 'Sliding temporal window consolidates audio and video evidence occurring together.',
    technical: 'Calibrated Linear Weighting & RRF',
    details:
      'Candidate speech matches and nearby keyframe detections within a ±10 second window are paired. The system calculates joint relevance using calibrated linear fusion or Reciprocal Rank Fusion.',
  },
  {
    index: '04',
    label: 'Playback Precision',
    title: 'Direct Timestamp Jump',
    subtitle: 'Frame-accurate temporal localization with synchronized dialogue transcript.',
    technical: 'Zero Frame Drift & Byte-Range Streaming',
    details:
      'Selecting any ranked result commands the video player directly to the exact start timestamp, streaming partial media bytes instantly without waiting for full video download.',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSearch,
  onNavigateToVideos,
  onNavigateToDiagnostics,
}) => {
  const [heroQuery, setHeroQuery] = useState('');
  const [activePipelineStage, setActivePipelineStage] = useState(0);

  const pinTrackRef = useRef<HTMLDivElement | null>(null);
  const pinContentRef = useRef<HTMLDivElement | null>(null);
  const modalitiesRef = useRef<HTMLDivElement | null>(null);
  const benchmarksRef = useRef<HTMLDivElement | null>(null);

  // 1. GSAP ScrollTrigger Pinned Pipeline Walkthrough
  useEffect(() => {
    // Only engage sticky scroll pinning on desktop / tablet
    if (!pinTrackRef.current || !pinContentRef.current || window.innerWidth < 768) {
      return;
    }

    const trigger = ScrollTrigger.create({
      trigger: pinTrackRef.current,
      start: 'top 80px',
      end: 'bottom bottom',
      pin: pinContentRef.current,
      pinSpacing: false,
      scrub: 0.5,
      onUpdate: (self) => {
        const progress = self.progress;
        const stageIndex = Math.min(3, Math.floor(progress * 4));
        setActivePipelineStage(stageIndex);
      },
    });

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () => {
      clearTimeout(refreshTimer);
      trigger.kill();
    };
  }, []);

  // 2. Scroll-Triggered Section Entrance Animations
  useEffect(() => {
    // Reveal Modality Cards on Scroll
    if (modalitiesRef.current) {
      const cards = modalitiesRef.current.querySelectorAll('.modality-card');
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { y: 35, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: modalitiesRef.current,
              start: 'top 82%',
              once: true,
            },
          }
        );
      }
    }

    // Reveal Benchmark Query Cards on Scroll
    if (benchmarksRef.current) {
      const queryCards = benchmarksRef.current.querySelectorAll('.benchmark-card');
      if (queryCards.length > 0) {
        gsap.fromTo(
          queryCards,
          { y: 25, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: benchmarksRef.current,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }
    }
  }, []);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroQuery.trim()) {
      onNavigateToSearch(heroQuery.trim(), 'multimodal');
    } else {
      onNavigateToSearch();
    }
  };

  return (
    <div className="space-y-28 sm:space-y-36 pb-24">
      {/* 1. HERO SECTION — Asymmetric, Sculpted Typography with Staggered Line Mask Reveals */}
      <section className="pt-6 sm:pt-14 md:pt-20 max-w-6xl mx-auto px-4">
        {/* Editorial Eyebrow */}
        <div className="clip-mask mb-4">
          <div className="hero-reveal-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#D2FF00] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#D2FF00]" />
            <span>Deep Semantic Video Retrieval</span>
          </div>
        </div>

        {/* Oversized Headline Lines */}
        <div className="space-y-1 sm:space-y-2">
          <div className="clip-mask">
            <h1 className="hero-reveal-2 font-display text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-extrabold uppercase tracking-[-0.04em] text-[#EBEEE0] leading-[0.85]">
              Find the
            </h1>
          </div>
          <div className="clip-mask">
            <h1 className="hero-reveal-3 font-display text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-extrabold uppercase tracking-[-0.04em] text-[#D2FF00] leading-[0.85]">
              Moment.
            </h1>
          </div>
        </div>

        {/* Asymmetrical Two-Column Manifesto Block */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-10 pt-8 border-t border-[#22271C]">
          <div className="md:col-span-7 space-y-6">
            <div className="clip-mask">
              <p className="hero-reveal-4 font-sans text-base sm:text-lg md:text-xl text-[#EBEEE0] font-normal leading-relaxed">
                Search long-form video archives by what was spoken, what appeared on screen, or both. Locate exact temporal intervals with frame-accurate direct playback.
              </p>
            </div>

            {/* Focal Search Bar */}
            <div className="clip-mask">
              <form
                onSubmit={handleHeroSubmit}
                className="hero-reveal-5 bg-[#12140F] border border-[#282C20] focus-within:border-[#D2FF00] rounded-xl p-2 sm:p-2.5 flex items-center gap-2 transition-all shadow-xl"
              >
                <div className="pl-3 text-[#D2FF00]">
                  <Search className="w-5 h-5 stroke-[2]" />
                </div>
                <input
                  type="text"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Enter query (e.g. 'neural network backpropagation explained')..."
                  className="flex-1 bg-transparent text-sm sm:text-base text-[#EBEEE0] placeholder-[#A5A89C]/50 focus:outline-none px-2 py-2"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Search
                </Button>
              </form>
            </div>

            {/* Curated Sample Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-[10px] text-[#A5A89C] uppercase tracking-wider">
                Sample queries:
              </span>
              {BENCHMARK_QUERIES.slice(0, 3).map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onNavigateToSearch(item.text, item.modality)}
                  className="px-2.5 py-1 rounded bg-[#12140F] hover:bg-[#1A1E14] border border-[#282C20] hover:border-[#D2FF00] text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer text-xs font-mono"
                >
                  &ldquo;{item.text}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Architectural Actions & Specs */}
          <div className="md:col-span-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#22271C] pt-6 md:pt-0 md:pl-8 space-y-6">
            <div className="space-y-4 font-mono text-xs text-[#A5A89C]">
              <div className="flex justify-between pb-2 border-b border-[#22271C]">
                <span>[01 // SPEECH]</span>
                <span className="text-[#EBEEE0]">Faster-Whisper &bull; MiniLM</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#22271C]">
                <span>[02 // VISION]</span>
                <span className="text-[#EBEEE0]">CLIP ViT-B/32 &bull; 1 FPS</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#22271C]">
                <span>[03 // FUSION]</span>
                <span className="text-[#EBEEE0]">Temporal Consolidation</span>
              </div>
              <div className="flex justify-between">
                <span>[04 // PLAYBACK]</span>
                <span className="text-[#D2FF00]">Frame-Accurate Seek</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                size="md"
                variant="primary"
                onClick={() => onNavigateToSearch()}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Search Studio
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={onNavigateToVideos}
                leftIcon={<Film className="w-4 h-4 text-[#D2FF00]" />}
                className="w-full sm:w-auto"
              >
                Video Library
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PINNED / SCROLL-LINKED PIPELINE WALKTHROUGH SECTION */}
      {/* Desktop / Tablet: Pinned 260vh Scroll Track */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="pb-6 border-b border-[#22271C] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
              Pipeline Demonstration
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#EBEEE0]">
              The Retrieval Sequence
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#A5A89C] max-w-sm">
            Scroll down through this section to observe how candidate moments are discovered, aligned, and played.
          </p>
        </div>

        {/* Pinned Desktop Track */}
        <div ref={pinTrackRef} className="hidden md:block min-h-[260vh] relative pt-8">
          <div ref={pinContentRef} className="h-[75vh] w-full flex items-center">
            <div className="w-full grid grid-cols-12 gap-8 items-stretch bg-[#12140F] border border-[#282C20] rounded-2xl p-8 lg:p-12 shadow-2xl">
              {/* Left Column: Stage Indicator & Editorial Narrative */}
              <div className="col-span-5 flex flex-col justify-between border-r border-[#22271C] pr-8">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    {PIPELINE_STAGES.map((s, idx) => (
                      <button
                        key={s.index}
                        onClick={() => setActivePipelineStage(idx)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                          activePipelineStage === idx
                            ? 'bg-[#D2FF00] text-[#0B0C0A]'
                            : 'bg-[#1A1E14] text-[#A5A89C] border border-[#282C20] hover:text-[#EBEEE0]'
                        }`}
                      >
                        {s.index}
                      </button>
                    ))}
                    <span className="text-xs font-mono text-[#A5A89C] ml-2">
                      {PIPELINE_STAGES[activePipelineStage].label}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl lg:text-3xl font-extrabold uppercase text-[#EBEEE0] tracking-tight mb-3">
                    {PIPELINE_STAGES[activePipelineStage].title}
                  </h3>

                  <p className="font-sans text-sm text-[#EBEEE0] font-normal leading-relaxed mb-4">
                    {PIPELINE_STAGES[activePipelineStage].subtitle}
                  </p>

                  <p className="font-sans text-xs text-[#A5A89C] leading-relaxed">
                    {PIPELINE_STAGES[activePipelineStage].details}
                  </p>
                </div>

                <div className="pt-6 border-t border-[#22271C]">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#A5A89C] mb-2">
                    <span>PROGRESSION</span>
                    <span className="text-[#D2FF00]">{Math.round((activePipelineStage + 1) * 25)}%</span>
                  </div>
                  <div className="w-full bg-[#0B0C0A] h-1.5 rounded-full overflow-hidden border border-[#282C20]">
                    <div
                      className="bg-[#D2FF00] h-full transition-all duration-300"
                      style={{ width: `${(activePipelineStage + 1) * 25}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Stage Graphic Representation */}
              <div className="col-span-7 pl-4 flex flex-col justify-center">
                {activePipelineStage === 0 && (
                  <div className="space-y-4 p-6 bg-[#0B0C0A] border border-[#22271C] rounded-xl font-mono">
                    <span className="text-[11px] text-[#A5A89C] uppercase block tracking-wider">
                      01 // Raw Natural Query
                    </span>
                    <div className="p-4 bg-[#12140F] border border-[#282C20] rounded-lg text-sm text-[#D2FF00]">
                      &ldquo;diagram explaining neural network backpropagation&rdquo;
                    </div>
                    <div className="text-xs text-[#A5A89C] space-y-1.5 pt-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#D2FF00]" />
                        <span>No required keyword syntax or quotes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#D2FF00]" />
                        <span>Dispatches to dual speech and visual indexing streams</span>
                      </div>
                    </div>
                  </div>
                )}

                {activePipelineStage === 1 && (
                  <div className="space-y-4 p-6 bg-[#0B0C0A] border border-[#22271C] rounded-xl font-mono">
                    <span className="text-[11px] text-[#A5A89C] uppercase block tracking-wider">
                      02 // Dual Latent Vector Embeddings
                    </span>
                    <div className="space-y-3">
                      <div className="p-3 bg-[#12140F] border border-[#282C20] rounded-lg">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-indigo-300 font-bold">Speech Modality</span>
                          <span className="text-[#A5A89C]">384 Dimensions</span>
                        </div>
                        <span className="text-[11px] text-[#A5A89C]">
                          Faster-Whisper segment transcription &bull; all-MiniLM-L6-v2
                        </span>
                      </div>

                      <div className="p-3 bg-[#12140F] border border-[#282C20] rounded-lg">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-amber-300 font-bold">Visual Modality</span>
                          <span className="text-[#A5A89C]">512 Dimensions</span>
                        </div>
                        <span className="text-[11px] text-[#A5A89C]">
                          1 FPS keyframe sampling &bull; OpenAI CLIP ViT-B/32
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activePipelineStage === 2 && (
                  <div className="space-y-4 p-6 bg-[#0B0C0A] border border-[#22271C] rounded-xl font-mono">
                    <span className="text-[11px] text-[#A5A89C] uppercase block tracking-wider">
                      03 // Sliding Temporal Window Consolidation
                    </span>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 bg-[#12140F] border border-[#282C20] rounded-lg space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#A5A89C]">Speech Interval:</span>
                          <span className="text-[#EBEEE0]">00:15 - 00:28</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#A5A89C]">Visual Keyframe:</span>
                          <span className="text-[#EBEEE0]">00:18.00 (Lecture slide)</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[#22271C]">
                          <span className="text-[#A5A89C]">Temporal Overlap:</span>
                          <span className="text-[#D2FF00] font-bold">&plusmn;10s window match</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#1A1E14] border border-[#282C20] rounded text-[11px] text-[#D2FF00] flex justify-between">
                        <span>Calibrated Linear / RRF Score:</span>
                        <span className="font-bold">0.8842</span>
                      </div>
                    </div>
                  </div>
                )}

                {activePipelineStage === 3 && (
                  <div className="space-y-4 p-6 bg-[#0B0C0A] border border-[#22271C] rounded-xl font-mono">
                    <span className="text-[11px] text-[#A5A89C] uppercase block tracking-wider">
                      04 // Frame-Accurate Direct Playback
                    </span>
                    <div className="p-3 bg-[#12140F] border border-[#282C20] rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#EBEEE0]">
                        <Play className="w-4 h-4 text-[#D2FF00]" />
                        <span>currentTime = 15.00s</span>
                      </div>
                      <span className="text-[11px] text-[#D2FF00] bg-[#1A1E14] px-2 py-0.5 rounded border border-[#282C20]">
                        PLAYING
                      </span>
                    </div>
                    <p className="text-xs text-[#A5A89C] leading-relaxed">
                      Server streams partial media chunks via HTTP 206 Partial Content range requests directly to the HTML5 video element.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Fallback: Clean Non-Pinned Stack */}
        <div className="md:hidden space-y-6 pt-6">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.index}
              className="p-5 bg-[#12140F] border border-[#22271C] rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#D2FF00]">STAGE {stage.index}</span>
                <span className="text-[#A5A89C]">{stage.label}</span>
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#EBEEE0]">
                {stage.title}
              </h3>
              <p className="text-xs text-[#EBEEE0] leading-relaxed">
                {stage.subtitle}
              </p>
              <p className="text-xs text-[#A5A89C] leading-relaxed">
                {stage.details}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. RETRIEVAL MODALITIES — Asymmetric Editorial Presentation with Scroll-Triggered Entrance */}
      <section ref={modalitiesRef} className="max-w-6xl mx-auto px-4">
        <div className="pb-8 border-b border-[#22271C] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
              Modalities
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#EBEEE0]">
              Three Retrieval Modes
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#A5A89C] max-w-sm">
            Select the specific modality that reflects how the target moment is preserved in your video recording.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {/* 01 Speech */}
          <div className="modality-card bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between mb-6 font-mono text-xs">
                <span className="font-bold text-[#D2FF00]">01 //</span>
                <span className="text-[#A5A89C] uppercase">Speech Dialogue</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#0B0C0A] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-5">
                <Mic className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#EBEEE0] mb-2">
                Dialogue Retrieval
              </h3>
              <p className="font-mono text-xs text-[#A5A89C] mb-4">
                Faster-Whisper + all-MiniLM-L6-v2
              </p>
              <p className="text-xs text-[#A5A89C] leading-relaxed mb-6">
                Transcribes speech into timestamp-aligned sentences, embedding conversational meaning into a dense semantic vector space. Locates moments based on what was spoken, even when exact keywords differ.
              </p>
            </div>
            <div className="pt-4 border-t border-[#22271C]">
              <button
                type="button"
                onClick={() => onNavigateToSearch('neural network backpropagation and weights', 'text')}
                className="w-full flex items-center justify-between text-xs font-mono text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer group"
              >
                <span className="truncate mr-2">&ldquo;neural network weights&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* 02 Visual */}
          <div className="modality-card bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between mb-6 font-mono text-xs">
                <span className="font-bold text-[#D2FF00]">02 //</span>
                <span className="text-[#A5A89C] uppercase">Visual Scene</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#0B0C0A] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-5">
                <Eye className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#EBEEE0] mb-2">
                Visual Recognition
              </h3>
              <p className="font-mono text-xs text-[#A5A89C] mb-4">
                OpenAI CLIP ViT-B/32 Keyframes
              </p>
              <p className="text-xs text-[#A5A89C] leading-relaxed mb-6">
                Extracts keyframes at 1-second intervals, encoding visual features into a multimodal embedding space. Identifies on-screen objects, slides, diagrams, and actions without requiring manual tags.
              </p>
            </div>
            <div className="pt-4 border-t border-[#22271C]">
              <button
                type="button"
                onClick={() => onNavigateToSearch('lecture slide with mathematical diagrams', 'visual')}
                className="w-full flex items-center justify-between text-xs font-mono text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer group"
              >
                <span className="truncate mr-2">&ldquo;slide with math diagrams&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* 03 Multimodal */}
          <div className="modality-card bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between mb-6 font-mono text-xs">
                <span className="font-bold text-[#D2FF00]">03 //</span>
                <span className="text-[#A5A89C] uppercase">Cross-Modal Fusion</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#0B0C0A] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-5">
                <Layers className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#EBEEE0] mb-2">
                Multimodal Fusion
              </h3>
              <p className="font-mono text-xs text-[#A5A89C] mb-4">
                Calibrated Linear &bull; RRF Ranking
              </p>
              <p className="text-xs text-[#A5A89C] leading-relaxed mb-6">
                Combines spoken audio and visual evidence across a configurable sliding temporal window, computing calibrated score combinations or Reciprocal Rank Fusion (RRF) for joint audio-visual queries.
              </p>
            </div>
            <div className="pt-4 border-t border-[#22271C]">
              <button
                type="button"
                onClick={() => onNavigateToSearch('diagram explaining neural network backpropagation', 'multimodal')}
                className="w-full flex items-center justify-between text-xs font-mono text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer group"
              >
                <span className="truncate mr-2">&ldquo;diagram of backpropagation&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BENCHMARK QUERIES — Curated Test Grid with Scroll-Triggered Entrance */}
      <section ref={benchmarksRef} className="max-w-6xl mx-auto px-4">
        <div className="bg-[#12140F] border border-[#22271C] rounded-2xl p-6 sm:p-10">
          <div className="max-w-xl mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
              Verified Queries
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#EBEEE0]">
              Sample Natural-Language Queries
            </h3>
            <p className="text-xs sm:text-sm text-[#A5A89C] mt-2">
              Click any query below to run a live retrieval against your indexed video collection:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BENCHMARK_QUERIES.map((q, idx) => (
              <div
                key={idx}
                onClick={() => onNavigateToSearch(q.text, q.modality)}
                className="benchmark-card group p-4 rounded-xl bg-[#0B0C0A] hover:bg-[#1A1E14] border border-[#22271C] hover:border-[#D2FF00] transition-all cursor-pointer flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#12140F] text-[#D2FF00] border border-[#282C20] inline-block mb-1.5">
                    {q.type}
                  </span>
                  <p className="text-xs font-medium text-[#EBEEE0] group-hover:text-[#D2FF00] transition-colors truncate">
                    &ldquo;{q.text}&rdquo;
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#A5A89C] group-hover:text-[#D2FF00] shrink-0 transform group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. DIRECT CALL TO ACTION */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 sm:p-12 rounded-2xl bg-[#12140F] border border-[#22271C] space-y-4">
          <h3 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#EBEEE0]">
            Ready to Explore Your Archive?
          </h3>
          <p className="text-xs sm:text-sm text-[#A5A89C] max-w-lg mx-auto leading-relaxed mb-6">
            Upload recordings through the video ingestion bay, or query previously indexed material with exact timestamp playback.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              variant="primary"
              onClick={() => onNavigateToSearch()}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Search Studio
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={onNavigateToVideos}
              leftIcon={<Film className="w-4 h-4 text-[#D2FF00]" />}
            >
              Video Ingestion Bay
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onNavigateToDiagnostics}
              leftIcon={<Activity className="w-4 h-4" />}
            >
              System Telemetry
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
