import { useState } from 'react';
import { Search, Sparkles, Video as VideoIcon, Mic, Eye, Layers } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/common/Card';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState<'text' | 'visual' | 'multimodal'>('text');

  return (
    <div className="space-y-6">
      {/* Search Header Hero */}
      <div className="text-center max-w-2xl mx-auto pt-4 pb-2">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight sm:text-4xl">
          Search Video by <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Meaning</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Retrieve exact moments, spoken dialogue, or visual scenes from long-form video recordings.
        </p>
      </div>

      {/* Query Bar */}
      <Card className="max-w-3xl mx-auto shadow-2xl border-slate-700/80">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-slate-950/80 rounded-xl px-4 py-2 border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'find where the presenter explains neural network backpropagation'..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!query.trim()}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Search
            </Button>
          </div>

          {/* Modality Selector */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Modality:</span>
              <button
                onClick={() => setModality('text')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  modality === 'text'
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Mic className="w-3 h-3" /> Spoken Dialogue
              </button>
              <button
                onClick={() => setModality('visual')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  modality === 'visual'
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Eye className="w-3 h-3" /> Visual Content
              </button>
              <button
                onClick={() => setModality('multimodal')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  modality === 'multimodal'
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Layers className="w-3 h-3" /> Fused Multimodal
              </button>
            </div>

            <div className="text-[11px] text-slate-500 italic">
              Phase 1 Scaffolding
            </div>
          </div>
        </div>
      </Card>

      {/* Results placeholder */}
      <div className="max-w-3xl mx-auto pt-6">
        <EmptyState
          title="Ready for Video Indexing"
          description="Phase 1 scaffolding is active. Semantic search will become functional after video upload and transcription indexing in Phases 2–4."
          icon={VideoIcon}
        />
      </div>
    </div>
  );
};
