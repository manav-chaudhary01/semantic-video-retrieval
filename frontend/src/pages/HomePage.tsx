import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowRight,
  Layers,
  Mic,
  Eye,
  Film,
  Play,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { gsap } from '../utils/lenis';

export interface HomePageProps {
  onNavigateToSearch: (initialQuery?: string, modality?: 'text' | 'visual' | 'multimodal') => void;
  onNavigateToVideos: () => void;
  onNavigateToDiagnostics: () => void;
}

const MODALITY_EXPLANATIONS = [
  {
    step: '01',
    title: 'Spoken Dialogue Retrieval',
    tag: 'Faster-Whisper + MiniLM Embeddings',
    description:
      'Transcribes speech into timestamp-aligned sentences, embedding conversational meaning into a dense semantic vector space. Locates moments based on what was spoken, even when exact keywords differ.',
    icon: Mic,
    sampleQuery: 'neural network backpropagation and weights',
    modality: 'text' as const,
  },
  {
    step: '02',
    title: 'Visual Scene Recognition',
    tag: 'CLIP ViT-B/32 Zero-Shot Keyframes',
    description:
      'Extracts keyframes at 1-second intervals, encoding visual features into a multimodal embedding space. Identifies on-screen objects, slides, diagrams, and actions without requiring manual tags.',
    icon: Eye,
    sampleQuery: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
  },
  {
    step: '03',
    title: 'Multimodal Temporal Fusion',
    tag: 'Cross-Modal Temporal Consolidation',
    description:
      'Combines spoken audio and visual evidence across a configurable sliding temporal window, computing calibrated score combinations or Reciprocal Rank Fusion (RRF) for joint audio-visual queries.',
    icon: Layers,
    sampleQuery: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
  },
];

const CURATED_BENCHMARKS = [
  {
    text: 'neural network backpropagation and weights',
    modality: 'text' as const,
    label: 'Speech',
  },
  {
    text: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
    label: 'Visual',
  },
  {
    text: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
    label: 'Multimodal',
  },
  {
    text: 'a person entering the room',
    modality: 'visual' as const,
    label: 'Visual',
  },
  {
    text: 'gradient descent optimization algorithms',
    modality: 'text' as const,
    label: 'Speech',
  },
  {
    text: 'speaker pointing to loss function chart',
    modality: 'multimodal' as const,
    label: 'Multimodal',
  },
];

const RETRIEVAL_STEPS = [
  {
    number: '01',
    name: 'Natural Query',
    summary: 'Enter a descriptive natural-language request describing dialogue, an on-screen scene, or both.',
    detail: 'Users are not restricted to exact keyword matching. Queries like "find where the speaker discusses gradient descent" or "show the slide with architecture diagrams" capture intent.',
  },
  {
    number: '02',
    name: 'Dual-Stream Vector Search',
    summary: 'The query is embedded simultaneously into text and visual representation spaces.',
    detail: 'Speech segments indexed with Faster-Whisper and visual keyframes indexed with CLIP ViT are searched independently in dual FAISS vector indices using inner-product cosine similarity.',
  },
  {
    number: '03',
    name: 'Temporal Alignment & Scoring',
    summary: 'Speech and visual candidates within a temporal window are aligned and scored.',
    detail: 'A sliding temporal context window aggregates speech segments and adjacent keyframes, applying calibrated linear weighting (alpha/beta) or Reciprocal Rank Fusion (RRF).',
  },
  {
    number: '04',
    name: 'Direct Timestamp Playback',
    summary: 'Results return exact start and end timestamps for immediate, frame-accurate playback.',
    detail: 'Selecting any result automatically seeks the player to the precise temporal interval with synchronized transcript text and frame preview.',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSearch,
  onNavigateToVideos,
  onNavigateToDiagnostics,
}) => {
  const [heroQuery, setHeroQuery] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const heroRef = useRef<HTMLDivElement | null>(null);

  // Line reveals animation using GSAP on mount
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.querySelectorAll('.line-inner').forEach((el) => {
        el.classList.add('revealed');
      });
      return;
    }

    const lines = heroRef.current?.querySelectorAll('.line-inner');
    if (lines && lines.length > 0) {
      gsap.fromTo(
        lines,
        { y: '105%', opacity: 0 },
        {
          y: '0%',
          opacity: 1,
          duration: 1.1,
          stagger: 0.15,
          ease: 'power3.out',
        }
      );
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
    <div className="space-y-24 sm:space-y-32 pb-20">
      {/* 1. Hero Section — Bold Editorial Reveal */}
      <section ref={heroRef} className="pt-8 sm:pt-16 md:pt-20 max-w-5xl mx-auto px-4">
        {/* Editorial Subheader */}
        <div className="line-mask mb-6">
          <div className="line-inner font-mono text-xs uppercase tracking-widest text-[#D2FF00] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#D2FF00]" />
            <span>Semantic Video Retrieval System</span>
          </div>
        </div>

        {/* Oversized Headline with Line Mask Reveals */}
        <div className="space-y-1 mb-8">
          <div className="line-mask">
            <h1 className="line-inner text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold font-sans tracking-tight uppercase text-[#EBEEE0] leading-[0.9]">
              Find the
            </h1>
          </div>
          <div className="line-mask">
            <h1 className="line-inner text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold font-sans tracking-tight uppercase text-[#D2FF00] leading-[0.9]">
              Moment.
            </h1>
          </div>
        </div>

        {/* Human-Edited Editorial Subhead */}
        <div className="line-mask mb-10 max-w-2xl">
          <p className="line-inner text-base sm:text-lg md:text-xl text-[#A5A89C] leading-relaxed font-normal">
            Search long-form video archives by spoken dialogue, on-screen visual scenes, or unified multimodal queries with frame-accurate timestamp playback.
          </p>
        </div>

        {/* Focal Search Entry Input */}
        <div className="line-mask mb-6 max-w-3xl">
          <form
            onSubmit={handleHeroSubmit}
            className="line-inner bg-[#12140F] border border-[#282C20] focus-within:border-[#D2FF00] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2 transition-all shadow-xl"
          >
            <div className="pl-3 text-[#D2FF00]">
              <Search className="w-5 h-5 stroke-[2]" />
            </div>
            <input
              type="text"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="Search by speech or visual scene (e.g. 'neural network backpropagation')..."
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

        {/* Curated Prompt Badges */}
        <div className="line-mask max-w-2xl">
          <div className="line-inner flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-[11px] text-[#A5A89C] uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D2FF00]" /> Explore:
            </span>
            {CURATED_BENCHMARKS.slice(0, 3).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigateToSearch(item.text, item.modality)}
                className="px-3 py-1 rounded-lg bg-[#12140F] hover:bg-[#1A1E14] border border-[#282C20] hover:border-[#D2FF00] text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer text-xs"
              >
                &ldquo;{item.text}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Primary Navigation Actions */}
        <div className="flex flex-wrap items-center gap-4 mt-12 pt-8 border-t border-[#22271C]">
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
            Video Library & Ingestion
          </Button>
        </div>
      </section>

      {/* 2. Product Walkthrough — The 4-Stage Semantic Retrieval Sequence */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="border-t border-[#22271C] pt-12 pb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
                System Architecture &bull; Sequence
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
                How Semantic Retrieval Works
              </h2>
              <p className="text-sm text-[#A5A89C] mt-2 leading-relaxed">
                From natural-language inquiry to frame-synchronized playback without manual video tagging.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToDiagnostics}
              leftIcon={<Activity className="w-3.5 h-3.5" />}
            >
              System Telemetry
            </Button>
          </div>

          {/* Interactive Step Switcher */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {RETRIEVAL_STEPS.map((step, idx) => (
              <div
                key={step.number}
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer text-left ${
                  activeStep === idx
                    ? 'bg-[#12140F] border-[#D2FF00] shadow-[0_0_20px_rgba(210,255,0,0.08)]'
                    : 'bg-[#0B0C0A] border-[#22271C] hover:border-[#38402A] hover:bg-[#12140F]/60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#D2FF00]">
                    STEP {step.number}
                  </span>
                  {activeStep === idx && (
                    <span className="w-2 h-2 rounded-full bg-[#D2FF00]" />
                  )}
                </div>
                <h3 className="text-sm font-bold uppercase font-sans text-[#EBEEE0] mb-2">
                  {step.name}
                </h3>
                <p className="text-xs text-[#A5A89C] leading-relaxed">
                  {step.summary}
                </p>
              </div>
            ))}
          </div>

          {/* Active Step Detailed Showcase Box */}
          <div className="bg-[#12140F] border border-[#282C20] rounded-3xl p-6 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#1A1E14] border border-[#282C20] text-xs font-mono text-[#D2FF00]">
                  <span>STAGE {RETRIEVAL_STEPS[activeStep].number} IN DETAIL</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold font-sans uppercase text-[#EBEEE0] tracking-tight">
                  {RETRIEVAL_STEPS[activeStep].name}
                </h3>
                <p className="text-sm text-[#EBEEE0] leading-relaxed">
                  {RETRIEVAL_STEPS[activeStep].detail}
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToSearch()}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Test in Search Studio
                  </Button>
                </div>
              </div>

              {/* Visual Graphic Representation of Active Step */}
              <div className="w-full lg:w-96 bg-[#0B0C0A] border border-[#22271C] rounded-2xl p-6 space-y-4 font-mono text-xs">
                {activeStep === 0 && (
                  <div className="space-y-3">
                    <span className="text-[#A5A89C] text-[11px] uppercase block">Input Stream:</span>
                    <div className="p-3 bg-[#12140F] border border-[#282C20] rounded-xl text-[#D2FF00]">
                      &ldquo;diagram explaining neural network backpropagation&rdquo;
                    </div>
                    <p className="text-[11px] text-[#A5A89C]">
                      Free-form text query tokenized and passed to text and vision projection heads.
                    </p>
                  </div>
                )}
                {activeStep === 1 && (
                  <div className="space-y-3">
                    <span className="text-[#A5A89C] text-[11px] uppercase block">Parallel Vector Embeddings:</span>
                    <div className="p-2.5 bg-[#12140F] border border-[#282C20] rounded-lg">
                      <span className="text-xs text-indigo-300 font-bold block mb-1">Speech Model:</span>
                      <span className="text-[11px] text-[#A5A89C]">all-MiniLM-L6-v2 (384 dims)</span>
                    </div>
                    <div className="p-2.5 bg-[#12140F] border border-[#282C20] rounded-lg">
                      <span className="text-xs text-amber-300 font-bold block mb-1">Visual Model:</span>
                      <span className="text-[11px] text-[#A5A89C]">CLIP ViT-B/32 (512 dims)</span>
                    </div>
                  </div>
                )}
                {activeStep === 2 && (
                  <div className="space-y-3">
                    <span className="text-[#A5A89C] text-[11px] uppercase block">Temporal Overlap Fusion:</span>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#A5A89C]">Speech Interval:</span>
                        <span className="text-[#EBEEE0]">00:15 - 00:28</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#A5A89C]">Visual Keyframe:</span>
                        <span className="text-[#EBEEE0]">00:18 (Slide match)</span>
                      </div>
                      <div className="p-2 bg-[#1A1E14] border border-[#282C20] rounded text-[11px] text-[#D2FF00]">
                        Overlap Confirmed &bull; Fused Score: 0.8842
                      </div>
                    </div>
                  </div>
                )}
                {activeStep === 3 && (
                  <div className="space-y-3">
                    <span className="text-[#A5A89C] text-[11px] uppercase block">Direct Player Seek:</span>
                    <div className="flex items-center gap-2 p-3 bg-[#12140F] border border-[#282C20] rounded-xl text-[#EBEEE0]">
                      <Play className="w-4 h-4 text-[#D2FF00]" />
                      <span>currentTime = 15.00s</span>
                    </div>
                    <p className="text-[11px] text-[#A5A89C]">
                      HTML5 video streams directly from server with byte-range support and timestamp precision.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Retrieval Modalities */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="border-t border-[#22271C] pt-12 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
                Retrieval Engines
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
                Modalities Supported
              </h2>
            </div>
            <p className="text-sm text-[#A5A89C] max-w-md">
              Choose the search modality that fits your query intent, or let multimodal fusion combine audio and vision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MODALITY_EXPLANATIONS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.step}
                  className="bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="font-mono text-xs font-bold text-[#D2FF00]">
                        {card.step}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-[#A5A89C] bg-[#1A1E14] px-2 py-0.5 rounded border border-[#282C20]">
                        {card.modality}
                      </span>
                    </div>

                    <div className="w-11 h-11 rounded-xl bg-[#1A1E14] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-5">
                      <Icon className="w-5 h-5 stroke-[1.8]" />
                    </div>

                    <h3 className="text-base sm:text-lg font-bold font-sans uppercase text-[#EBEEE0] tracking-tight mb-2">
                      {card.title}
                    </h3>
                    <p className="text-xs font-mono text-[#A5A89C] mb-4">
                      {card.tag}
                    </p>
                    <p className="text-xs text-[#A5A89C] leading-relaxed mb-6">
                      {card.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#22271C]">
                    <button
                      type="button"
                      onClick={() => onNavigateToSearch(card.sampleQuery, card.modality)}
                      className="w-full flex items-center justify-between text-xs font-mono text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer group"
                    >
                      <span className="truncate mr-2">&ldquo;{card.sampleQuery}&rdquo;</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 transform group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Interactive Benchmark Queries */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-[#12140F] border border-[#22271C] rounded-3xl p-6 sm:p-10">
          <div className="max-w-2xl mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-[#D2FF00] block mb-2">
              Instant Testing
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0]">
              Sample Natural-Language Queries
            </h3>
            <p className="text-xs sm:text-sm text-[#A5A89C] mt-2">
              Select any query below to run a live semantic retrieval against your indexed videos:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CURATED_BENCHMARKS.map((q, idx) => (
              <div
                key={idx}
                onClick={() => onNavigateToSearch(q.text, q.modality)}
                className="group p-4 rounded-xl bg-[#0B0C0A] hover:bg-[#1A1E14] border border-[#22271C] hover:border-[#D2FF00] transition-all cursor-pointer flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#12140F] text-[#D2FF00] border border-[#282C20]">
                      {q.label}
                    </span>
                  </div>
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

      {/* 5. Direct Launch Call to Action */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#12140F] border border-[#22271C]">
          <h3 className="text-3xl sm:text-4xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0] mb-3">
            Explore Your Video Archive
          </h3>
          <p className="text-xs sm:text-sm text-[#A5A89C] max-w-lg mx-auto mb-8 leading-relaxed">
            Index long-form recordings with Whisper and CLIP, then locate the precise second where relevant speech and visuals occur.
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
              Video Ingestion
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
