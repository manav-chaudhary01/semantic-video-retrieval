import React from 'react';
import { Film, Search, Video, Activity, Sparkles } from 'lucide-react';
import type { HealthResponse } from '../../types';

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
    <header className="border-b border-[#22271C] bg-[#0B0C0A]/90 backdrop-blur-xl sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-[#12140F] border border-[#282C20] group-hover:border-[#D2FF00]/60 flex items-center justify-center transition-all">
            <Film className="w-4 h-4 text-[#D2FF00] group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <span className="font-extrabold font-display text-[#EBEEE0] text-sm sm:text-base tracking-tight uppercase block leading-none">
              Semantic Video Retrieval
            </span>
            <span className="text-[10px] text-[#A5A89C] font-mono tracking-wider uppercase mt-1 block">
              Spoken &bull; Visual &bull; Multimodal
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#12140F] p-1.5 rounded-xl border border-[#22271C]">
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[#D2FF00] text-[#0B0C0A]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'search'
                ? 'bg-[#D2FF00] text-[#0B0C0A]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('videos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'videos'
                ? 'bg-[#D2FF00] text-[#0B0C0A]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>

          <button
            onClick={() => onSelectTab('health')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase font-sans transition-all cursor-pointer ${
              currentTab === 'health'
                ? 'bg-[#D2FF00] text-[#0B0C0A]'
                : 'text-[#A5A89C] hover:text-[#EBEEE0] hover:bg-[#1A1E14]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </nav>

        {/* Backend Status indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {isHealthLoading ? (
            <span className="inline-flex items-center gap-1.5 text-[#A5A89C] bg-[#12140F] border border-[#22271C] px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A5A89C] animate-pulse" />
              Connecting
            </span>
          ) : health?.status === 'healthy' ? (
            <span className="inline-flex items-center gap-1.5 text-[#D2FF00] bg-[#12140F] border border-[#282C20] px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D2FF00]" />
              Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-950/40 border border-rose-900/60 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-[#22271C] bg-[#12140F] py-2 px-2 text-[11px] font-mono">
        <button
          onClick={() => onSelectTab('home')}
          className={`px-3 py-1 rounded ${currentTab === 'home' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Overview
        </button>
        <button
          onClick={() => onSelectTab('search')}
          className={`px-3 py-1 rounded ${currentTab === 'search' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Search
        </button>
        <button
          onClick={() => onSelectTab('videos')}
          className={`px-3 py-1 rounded ${currentTab === 'videos' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Library
        </button>
        <button
          onClick={() => onSelectTab('health')}
          className={`px-3 py-1 rounded ${currentTab === 'health' ? 'text-[#D2FF00] font-bold' : 'text-[#A5A89C]'}`}
        >
          Diagnostics
        </button>
      </div>
    </header>
  );
};
