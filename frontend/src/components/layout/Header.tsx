import React from 'react';
import { Film, Search, Video, Activity, Sparkles } from 'lucide-react';
import type { HealthResponse } from '../../types';
import { Badge } from '../common/Badge';

export type NavTab = 'home' | 'search' | 'videos' | 'health';

export interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
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
    <header className="border-b border-[#22271C] bg-[#0B0C0A]/85 backdrop-blur-xl sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#1A1E14] border border-[#282C20] group-hover:border-[#D2FF00]/60 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(210,255,0,0.1)]">
            <Film className="w-5 h-5 text-[#D2FF00] group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-sans text-[#EBEEE0] text-base sm:text-lg tracking-tight uppercase">
                Semantic Video
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-[#D2FF00]/10 text-[#D2FF00] border border-[#D2FF00]/30 tracking-wider">
                Deep Retrieval
              </span>
            </div>
            <p className="text-[10px] text-[#A5A89C] font-mono tracking-wider uppercase">
              Multimodal Temporal Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#12140F] p-1.5 rounded-2xl border border-[#22271C]">
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'search'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('videos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'videos'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>

          <button
            onClick={() => onSelectTab('health')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'health'
                ? 'bg-[#D2FF00] text-[#0B0C0A] shadow-[0_0_15px_rgba(210,255,0,0.3)]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
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
              Connecting
            </Badge>
          ) : health?.status === 'healthy' ? (
            <Badge variant="lime" size="sm" dot>
              Online ({health.version})
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#22271C] bg-[#12140F] py-2 px-2 text-[11px] font-mono">
        <button
          onClick={() => onSelectTab('home')}
          className={`px-2.5 py-1 rounded-lg ${currentTab === 'home' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Overview
        </button>
        <button
          onClick={() => onSelectTab('search')}
          className={`px-2.5 py-1 rounded-lg ${currentTab === 'search' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Search
        </button>
        <button
          onClick={() => onSelectTab('videos')}
          className={`px-2.5 py-1 rounded-lg ${currentTab === 'videos' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Library
        </button>
        <button
          onClick={() => onSelectTab('health')}
          className={`px-2.5 py-1 rounded-lg ${currentTab === 'health' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Diagnostics
        </button>
      </div>
    </header>
  );
};
