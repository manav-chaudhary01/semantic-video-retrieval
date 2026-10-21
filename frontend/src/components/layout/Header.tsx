import React from 'react';
import { Film, Search, Video, Activity } from 'lucide-react';
import type { HealthResponse } from '../../types';
import { Badge } from '../common/Badge';

export interface HeaderProps {
  currentTab: 'search' | 'videos' | 'health';
  onSelectTab: (tab: 'search' | 'videos' | 'health') => void;
  health: HealthResponse | null;
  isHealthLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  health,
  isHealthLoading,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">Semantic Video</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                Deep Retrieval
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">Multimodal Temporal Video Search</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('videos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'videos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos</span>
          </button>

          <button
            onClick={() => onSelectTab('health')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'health'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </nav>

        {/* Backend Status indicator */}
        <div className="flex items-center gap-2">
          {isHealthLoading ? (
            <Badge variant="neutral" size="sm" dot>
              Connecting...
            </Badge>
          ) : health?.status === 'healthy' ? (
            <Badge variant="success" size="sm" dot>
              Backend Online ({health.version})
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              Backend Offline
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
};
