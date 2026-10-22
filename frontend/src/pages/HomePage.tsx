import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ArrowRight,
  Layers,
  Mic,
  Eye,
  Film,
  Zap,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export interface HomePageProps {
  onNavigateToSearch: (initialQuery?: string, modality?: 'text' | 'visual' | 'multimodal') => void;
  onNavigateToVideos: () => void;
  onNavigateToDiagnostics: () => void;
}

const FEATURE_CARDS = [
  {
    index: '01',
    title: 'Spoken Dialogue Retrieval',
    tag: 'Faster-Whisper + MiniLM',
    description:
      'Transcribes speech into timestamped phonetic segments and embeds them into a dense 384-dimensional vector space with sentence-boundary awareness.',
    icon: Mic,
    highlight: 'Speech Semantics',
    sampleQuery: 'neural network backpropagation and weights',
    modality: 'text' as const,
  },
  {
    index: '02',
    title: 'Visual Scene Recognition',
    tag: 'CLIP ViT-B/32',
    description:
      'Samples keyframes at frame-accurate 1-second intervals, embedding visual concepts into a 512-dimensional multimodal latent space with visual deduplication.',
    icon: Eye,
    highlight: 'Zero-Shot Vision',
    sampleQuery: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
  },
  {
    index: '03',
    title: 'Multimodal Temporal Fusion',
    tag: 'Cross-Modal RRF',
    description:
      'Consolidates speech and visual matches across a sliding temporal window, computing calibrated score combinations or Reciprocal Rank Fusion.',
    icon: Layers,
    highlight: 'Unified Context',
    sampleQuery: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
  },
];

const CURATED_QUERIES = [
  {
    text: 'neural network backpropagation and weights',
    modality: 'text' as const,
    label: 'Dialogue',
  },
  {
    text: 'lecture slide with mathematical diagrams',
    modality: 'visual' as const,
    label: 'Visual',
  },
  {
    text: 'a person entering the room',
    modality: 'visual' as const,
    label: 'Visual',
  },
  {
    text: 'diagram explaining neural network backpropagation',
    modality: 'multimodal' as const,
    label: 'Multimodal',
  },
  {
    text: 'gradient descent optimization algorithms',
    modality: 'text' as const,
    label: 'Dialogue',
  },
  {
    text: 'speaker pointing to loss function chart',
    modality: 'multimodal' as const,
    label: 'Multimodal',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSearch,
  onNavigateToVideos,
  onNavigateToDiagnostics,
}) => {
  const [heroQuery, setHeroQuery] = useState('');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroQuery.trim()) {
      onNavigateToSearch(heroQuery.trim(), 'multimodal');
    } else {
      onNavigateToSearch();
    }
  };

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-12 md:pt-16 text-center max-w-5xl mx-auto px-4">
        {/* Editorial Subheader Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1E14] border border-[#282C20] text-xs font-mono text-[#D2FF00] mb-8 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-[#D2FF00] shadow-[0_0_8px_#D2FF00]" />
          <span className="tracking-widest uppercase">Deep Multimodal Video Retrieval Engine</span>
        </div>

        {/* Hero Title - Bold Editorial Style */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold font-sans tracking-tighter uppercase text-[#EBEEE0] leading-[0.9] mb-6">
          Find the <br />
          <span className="text-[#D2FF00] drop-shadow-[0_0_35px_rgba(210,255,0,0.3)]">
            Moment.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-[#A5A89C] max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Natural-language semantic search across long-form video recordings. Retrieve exact timestamps, synchronized speech dialogue, and visual keyframes with zero frame drift.
        </p>

        {/* Focal Search Bar */}
        <form
          onSubmit={handleHeroSubmit}
          className="max-w-3xl mx-auto bg-[#12140F] border border-[#282C20] hover:border-[#D2FF00]/50 focus-within:border-[#D2FF00] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] transition-all mb-6"
        >
          <div className="pl-3 text-[#D2FF00]">
            <Search className="w-5 h-5 stroke-[2]" />
          </div>
          <input
            type="text"
            value={heroQuery}
            onChange={(e) => setHeroQuery(e.target.value)}
            placeholder="Search moments by speech, visual scene, or topic (e.g. 'neural network backpropagation')..."
            className="flex-1 bg-transparent text-sm sm:text-base text-[#EBEEE0] placeholder-[#A5A89C]/60 focus:outline-none px-2 py-2"
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

        {/* Quick Suggestions Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#A5A89C] max-w-2xl mx-auto">
          <span className="font-mono text-[11px] text-[#A5A89C] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D2FF00]" /> Try:
          </span>
          {CURATED_QUERIES.slice(0, 3).map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onNavigateToSearch(item.text, item.modality)}
              className="px-3 py-1 rounded-full bg-[#1A1E14] hover:bg-[#282C20] border border-[#282C20] hover:border-[#D2FF00]/50 text-[#EBEEE0] hover:text-[#D2FF00] transition-colors cursor-pointer text-xs"
            >
              &ldquo;{item.text}&rdquo;
            </button>
          ))}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <Button
            size="lg"
            variant="primary"
            onClick={() => onNavigateToSearch()}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Launch Search Studio
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={onNavigateToVideos}
            leftIcon={<Film className="w-4 h-4 text-[#D2FF00]" />}
          >
            Manage Video Library
          </Button>
        </div>
      </section>

      {/* Telemetry & Performance Strip */}
      <section className="border-y border-[#22271C] bg-[#12140F]/50 py-6 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div className="text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#A5A89C]">
              Latency
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#EBEEE0] mt-1 flex items-baseline gap-1">
              &lt; 30<span className="text-xs text-[#D2FF00]">ms</span>
            </div>
            <p className="text-xs text-[#A5A89C] mt-0.5">Dual FAISS vector query</p>
          </div>

          <div className="text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#A5A89C]">
              Timestamp Accuracy
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#EBEEE0] mt-1 flex items-baseline gap-1">
              0.00<span className="text-xs text-[#D2FF00]">drift</span>
            </div>
            <p className="text-xs text-[#A5A89C] mt-0.5">Frame-level sync</p>
          </div>

          <div className="text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#A5A89C]">
              Modalities
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#EBEEE0] mt-1 flex items-baseline gap-1">
              3<span className="text-xs text-[#D2FF00]">ways</span>
            </div>
            <p className="text-xs text-[#A5A89C] mt-0.5">Speech, Vision, Hybrid</p>
          </div>

          <div className="text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#A5A89C]">
              Rank Fusion
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#EBEEE0] mt-1 flex items-baseline gap-1">
              RRF<span className="text-xs text-[#D2FF00]">+Linear</span>
            </div>
            <p className="text-xs text-[#A5A89C] mt-0.5">Calibrated score balance</p>
          </div>
        </div>
      </section>

      {/* Feature Trilogy Section */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-[#22271C] gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D2FF00]">
              Deep Learning Modalities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0] mt-1">
              Tri-Modal Video Architecture
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#A5A89C] max-w-md">
            Engineered with pretrained foundation models to deliver sub-second moment discovery without full video re-encoding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.index}
                className="group relative bg-[#12140F] border border-[#22271C] hover:border-[#38402A] rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(210,255,0,0.06)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-xs font-bold text-[#A5A89C] group-hover:text-[#D2FF00] transition-colors">
                      {card.index} //
                    </span>
                    <Badge variant="lime" size="sm">
                      {card.highlight}
                    </Badge>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-[#1A1E14] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-5 group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(210,255,0,0.1)]">
                    <Icon className="w-6 h-6 stroke-[1.8]" />
                  </div>

                  <h3 className="text-lg font-bold font-sans uppercase text-[#EBEEE0] tracking-tight mb-2">
                    {card.title}
                  </h3>
                  <p className="text-xs font-mono text-[#D2FF00] mb-3">{card.tag}</p>
                  <p className="text-xs text-[#A5A89C] leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#22271C]">
                  <button
                    type="button"
                    onClick={() => onNavigateToSearch(card.sampleQuery, card.modality)}
                    className="w-full flex items-center justify-between text-xs font-medium text-[#EBEEE0] hover:text-[#D2FF00] transition-colors group/btn cursor-pointer"
                  >
                    <span className="truncate mr-2">&ldquo;{card.sampleQuery}&rdquo;</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 transform group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Query Gallery */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-[#12140F] border border-[#22271C] rounded-3xl p-6 sm:p-10">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D2FF00]">
              Interactive Test Suite
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0] mt-1">
              Curated Retrieval Benchmarks
            </h3>
            <p className="text-xs sm:text-sm text-[#A5A89C] mt-2">
              Select any benchmark query below to immediately execute search on your indexed video library:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CURATED_QUERIES.map((q, idx) => (
              <div
                key={idx}
                onClick={() => onNavigateToSearch(q.text, q.modality)}
                className="group p-4 rounded-xl bg-[#1A1E14]/80 hover:bg-[#282C20] border border-[#282C20] hover:border-[#D2FF00]/50 transition-all cursor-pointer flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        q.modality === 'multimodal'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : q.modality === 'visual'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      }`}
                    >
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

      {/* Pipeline Architecture Schematic */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-[#12140F] border border-[#22271C] rounded-3xl p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#22271C] gap-4 mb-8">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#D2FF00]">
                Research System Stack
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0] mt-1">
                Verified Deep Learning Pipeline
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToDiagnostics}
              leftIcon={<Terminal className="w-3.5 h-3.5" />}
            >
              System Diagnostics
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#1A1E14] border border-[#282C20]">
              <span className="text-[10px] font-mono text-[#D2FF00] uppercase block mb-1">
                Phase 01-02
              </span>
              <h4 className="text-sm font-bold text-[#EBEEE0] uppercase">Demux & Probe</h4>
              <p className="text-xs text-[#A5A89C] mt-1">
                FFprobe metadata extraction and 16kHz audio separation with zero frame drift.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1E14] border border-[#282C20]">
              <span className="text-[10px] font-mono text-[#D2FF00] uppercase block mb-1">
                Phase 03-04
              </span>
              <h4 className="text-sm font-bold text-[#EBEEE0] uppercase">Speech Semantic</h4>
              <p className="text-xs text-[#A5A89C] mt-1">
                Faster-Whisper transcription and dense all-MiniLM-L6-v2 vector embeddings.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1E14] border border-[#282C20]">
              <span className="text-[10px] font-mono text-[#D2FF00] uppercase block mb-1">
                Phase 05
              </span>
              <h4 className="text-sm font-bold text-[#EBEEE0] uppercase">Visual CLIP</h4>
              <p className="text-xs text-[#A5A89C] mt-1">
                Zero-shot frame recognition via CLIP ViT-B/32 and consecutive frame clustering.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1E14] border border-[#282C20]">
              <span className="text-[10px] font-mono text-[#D2FF00] uppercase block mb-1">
                Phase 06-08
              </span>
              <h4 className="text-sm font-bold text-[#EBEEE0] uppercase">Temporal Fusion</h4>
              <p className="text-xs text-[#A5A89C] mt-1">
                Cross-modal temporal alignment, RRF ranking, rate limiting, and evaluation suite.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="text-center max-w-4xl mx-auto px-4 pt-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#1A1E14] to-[#12140F] border border-[#282C20] relative overflow-hidden">
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-32 bg-[#D2FF00]/10 blur-3xl pointer-events-none" />
          <h3 className="text-3xl sm:text-5xl font-extrabold font-sans uppercase tracking-tight text-[#EBEEE0] mb-4">
            Ready to retrieve?
          </h3>
          <p className="text-sm sm:text-base text-[#A5A89C] max-w-xl mx-auto mb-8">
            Upload your lecture or long-form recording, or search through existing indexed videos with multimodal precision.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              variant="primary"
              onClick={() => onNavigateToSearch()}
              leftIcon={<Zap className="w-4 h-4" />}
            >
              Start Searching
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={onNavigateToVideos}
              leftIcon={<Film className="w-4 h-4" />}
            >
              Upload New Video
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
