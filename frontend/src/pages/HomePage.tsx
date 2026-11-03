import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowUpRight,
  Layers,
  Mic,
  Eye,
} from 'lucide-react';
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
    type: 'Dialogue',
  },
  {
    text: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
    type: 'Visual Frame',
  },
  {
    text: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
    type: 'Multimodal Fusion',
  },
  {
    text: 'a person entering the room',
    modality: 'visual' as const,
    type: 'Visual Frame',
  },
  {
    text: 'gradient descent optimization algorithms',
    modality: 'text' as const,
    type: 'Dialogue',
  },
  {
    text: 'speaker pointing to loss function chart',
    modality: 'multimodal' as const,
    type: 'Multimodal Fusion',
  },
];

const PIPELINE_STAGES = [
  {
    index: '01',
    label: 'Query Tokenization',
    title: 'Natural-Language Intent',
    subtitle: 'Freeform semantic expression without predefined keyword taxonomies or exact metadata matches.',
    technical: 'Sentence Transformers & Token Projection',
    details:
      'Search naturally for spoken statements or visual elements. Queries capture conceptual meaning, allowing instant discovery of relevant moments across large video libraries.',
  },
  {
    index: '02',
    label: 'Dual Latent Spaces',
    title: 'Dialogue & Scene Embeddings',
    subtitle: 'Parallel vector representations for continuous speech audio and sampled video frames.',
    technical: 'Faster-Whisper (384d) + CLIP ViT-B/32 (512d)',
    details:
      'Spoken audio is transcribed with sub-second timestamps and projected into text vector space. Visual frames sampled at 1 FPS are embedded into image-semantic space for cosine similarity search.',
  },
  {
    index: '03',
    label: 'Temporal Consensus',
    title: 'Cross-Modal Window Fusion',
    subtitle: 'Consolidates speech cues and visual evidence co-occurring within temporal bounds.',
    technical: 'Reciprocal Rank Fusion (k=60) & Linear Weights',
    details:
      'Candidate transcript matches and keyframe detections within a configurable window (±10s) are paired. Joint relevance is calibrated to eliminate false positives.',
  },
  {
    index: '04',
    label: 'Sub-Second Precision',
    title: 'Timestamp-Accurate Playback',
    subtitle: 'Direct temporal seeking with synchronized transcript highlighting and zero drift.',
    technical: 'Byte-Range HTTP Streaming & Active Cue Sync',
    details:
      'Selecting any ranked result commands the video player directly to the exact start timestamp, streaming partial media bytes immediately without full-file buffering.',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSearch,
  onNavigateToVideos,
  onNavigateToDiagnostics,
}) => {
  const [heroQuery, setHeroQuery] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  // Staggered reveal animations with GSAP ScrollTrigger
  useEffect(() => {
    if (!cardsRef.current) return;

    const cards = cardsRef.current.querySelectorAll('.miles-card');
    gsap.fromTo(
      cards,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: cardsRef.current,
          start: 'top 85%',
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
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
    <div ref={containerRef} className="space-y-24 sm:space-y-32">
      {/* 1. HERO SECTION - Clean Editorial Display */}
      <section className="pt-6 sm:pt-14 pb-8 space-y-8">
        {/* Category Pill Tag */}
        <div className="clip-mask">
          <div className="hero-reveal-1 inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/15 bg-neutral-900/60 text-xs font-mono tracking-widest uppercase text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Multimodal Video Retrieval</span>
          </div>
        </div>

        {/* Oversized Headline - Actual Product Name */}
        <div className="space-y-1 select-none">
          <div className="clip-mask">
            <h1 className="hero-reveal-2 font-display font-medium text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tighter uppercase text-white leading-[0.95]">
              Semantic Video
            </h1>
          </div>
          <div className="clip-mask">
            <h1 className="hero-reveal-3 font-display font-medium text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tighter uppercase text-neutral-400 leading-[0.95]">
              Retrieval
            </h1>
          </div>
        </div>

        {/* Editorial Subtitle & Context */}
        <div className="clip-mask max-w-2xl">
          <p className="hero-reveal-4 text-base sm:text-lg text-neutral-400 font-sans font-normal leading-relaxed">
            A precision video intelligence system that searches spoken dialogue and visual scene semantics simultaneously. Locate exact video moments through natural language with sub-second accuracy.
          </p>
        </div>

        {/* Search Console Input Bar + Quick Links */}
        <div className="clip-mask pt-2">
          <div className="hero-reveal-5 max-w-2xl space-y-4">
            <form
              onSubmit={handleHeroSubmit}
              className="flex items-center bg-neutral-900/90 border border-white/15 rounded-full p-2 pl-5 focus-within:border-white/40 transition-all shadow-lg"
            >
              <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-3" />
              <input
                type="text"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="Describe a scene, dialogue, or action..."
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-neutral-400 focus:outline-none font-sans"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-medium tracking-tight transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-neutral-400 pt-1">
              <span className="text-neutral-400 uppercase tracking-widest text-[11px]">Index:</span>
              <button
                onClick={onNavigateToVideos}
                className="hover:text-white transition-colors cursor-pointer border-b border-white/20 pb-0.5"
              >
                View Library
              </button>
              <span>&bull;</span>
              <button
                onClick={onNavigateToDiagnostics}
                className="hover:text-white transition-colors cursor-pointer border-b border-white/20 pb-0.5"
              >
                Inference Telemetry
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MODALITY SHOWCASE GALLERY */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block mb-1">
              Index Modalities
            </span>
            <h2 className="text-2xl sm:text-4xl font-semibold font-display tracking-tight uppercase text-white">
              Retrieval Pathways
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md font-sans">
            Independent vector projections allow searching speech audio, visual frames, or temporal consensus fusion.
          </p>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Dialogue Search */}
          <div
            onClick={() => onNavigateToSearch('', 'text')}
            className="miles-card group bg-neutral-950 border border-white/10 hover:border-white/30 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
                  Speech Audio
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold font-display text-white group-hover:text-neutral-200 transition-colors">
                  Dialogue Retrieval
                </h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-sans">
                  Sentence-level embeddings of Whisper speech transcripts. Pinpoint spoken words and spoken explanations instantly.
                </p>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">MiniLM-L6 &bull; 384d</span>
              <div className="flex items-center gap-1 text-white group-hover:translate-x-1 transition-transform">
                <span>Explore</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Card 2: Visual Keyframe Search */}
          <div
            onClick={() => onNavigateToSearch('', 'visual')}
            className="miles-card group bg-neutral-950 border border-white/10 hover:border-white/30 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
                  Continuous Frames
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold font-display text-white group-hover:text-neutral-200 transition-colors">
                  Visual Scene Retrieval
                </h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-sans">
                  Deep visual semantics from sampled 1 FPS keyframes. Query actions, objects, slide diagrams, or screen text without spoken cues.
                </p>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">CLIP ViT-B/32 &bull; 512d</span>
              <div className="flex items-center gap-1 text-white group-hover:translate-x-1 transition-transform">
                <span>Explore</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Card 3: Multimodal Consensus */}
          <div
            onClick={() => onNavigateToSearch('', 'multimodal')}
            className="miles-card group bg-neutral-950 border border-white/15 hover:border-white/40 rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-mono tracking-widest text-white uppercase font-medium">
                  Dual Consensus
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold font-display text-white group-hover:text-neutral-200 transition-colors">
                  Multimodal Fusion
                </h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-sans">
                  Consolidates dialogue transcripts and vision keyframes within a ±10s temporal window using Reciprocal Rank Fusion.
                </p>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">RRF &bull; Linear Blending</span>
              <div className="flex items-center gap-1 text-white group-hover:translate-x-1 transition-transform">
                <span>Launch</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PIPELINE GRID - Hover-Driven Highlighting Without Persistent Active State */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block mb-1">
              System Architecture
            </span>
            <h2 className="text-2xl sm:text-4xl font-semibold font-display tracking-tight uppercase text-white">
              Inference Workflow
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md font-sans">
            How natural language queries are tokenized, mapped to dual latent spaces, temporally aligned, and played back.
          </p>
        </div>

        {/* 4-Stage Cards Grid - Hover-Driven Highlighting & Keyboard Focus */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.index}
              tabIndex={0}
              role="region"
              aria-label={`Inference Stage ${stage.index}: ${stage.title}`}
              className="p-7 rounded-2xl border border-white/10 bg-neutral-950 hover:bg-neutral-900/80 hover:border-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:border-white/40 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 group-hover:border-white/20 transition-colors">
                <span className="font-mono text-xs font-semibold text-neutral-400 group-hover:text-white tracking-widest transition-colors">
                  STAGE {stage.index}
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  {stage.technical}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <h4 className="text-lg font-semibold font-display text-white group-hover:text-white transition-colors">
                  {stage.title}
                </h4>
                <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                  {stage.subtitle}
                </p>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed pt-2">
                  {stage.details}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. BENCHMARK QUERY TEST SUITE */}
      <section className="space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block mb-1">
              Validation Suite
            </span>
            <h2 className="text-2xl sm:text-4xl font-semibold font-display tracking-tight uppercase text-white">
              Benchmark Queries
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md font-sans">
            Test queries verified across speech dialogue, visual keyframes, and cross-modal temporal alignment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENCHMARK_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onNavigateToSearch(q.text, q.modality)}
              className="text-left p-5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-white/30 hover:bg-neutral-900/60 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-2">
                <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-neutral-400 group-hover:text-white transition-colors">
                  {q.type}
                </span>
                <p className="text-xs sm:text-sm text-neutral-200 font-sans group-hover:text-white transition-colors leading-relaxed">
                  &ldquo;{q.text}&rdquo;
                </p>
              </div>
              <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-neutral-400 group-hover:text-white">
                <span>Run test query</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
