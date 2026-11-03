import React from 'react';
import { Film, Search, Video, Activity, Sparkles, ArrowUpRight } from 'lucide-react';
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
    <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Brand - Miles minimal typographic logo */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 group-hover:border-white/40 flex items-center justify-center transition-all">
            <Film className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <span className="font-semibold font-display text-white text-sm sm:text-base tracking-tight uppercase block leading-none">
              Semantic Video Retrieval
            </span>
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase mt-1 block">
              Spoken &bull; Visual &bull; Multimodal
            </span>
          </div>
        </div>

        {/* Navigation Tabs - Miles Floating Pill Bar */}
        <nav className="hidden md:flex items-center gap-1 bg-neutral-900/80 p-1.5 rounded-full border border-white/10">
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              currentTab === 'search'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('videos')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              currentTab === 'videos'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>

          <button
            onClick={() => onSelectTab('health')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight font-sans transition-all cursor-pointer ${
              currentTab === 'health'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </nav>

        {/* Right Action: Status indicator + Pill CTA button */}
        <div className="flex items-center gap-3">
          {/* Status Dot */}
          <div className="hidden sm:flex items-center text-xs font-mono">
            {isHealthLoading ? (
              <span className="inline-flex items-center gap-1.5 text-neutral-400 bg-neutral-900 border border-white/10 px-3 py-1 rounded-full text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
                Connecting
              </span>
            ) : health?.status === 'healthy' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-300 bg-rose-950/40 border border-rose-800/40 px-3 py-1 rounded-full text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Offline
              </span>
            )}
          </div>

          {/* Miles-inspired CTA Button ("Search Engine") */}
          <button
            onClick={() => onSelectTab('search')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <span>Query Engine</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-white/10 bg-black/90 py-2.5 px-2 text-xs font-mono">
        <button
          onClick={() => onSelectTab('home')}
          className={`px-3 py-1 rounded-full ${currentTab === 'home' ? 'bg-white text-black font-semibold' : 'text-neutral-400'}`}
        >
          Overview
        </button>
        <button
          onClick={() => onSelectTab('search')}
          className={`px-3 py-1 rounded-full ${currentTab === 'search' ? 'bg-white text-black font-semibold' : 'text-neutral-400'}`}
        >
          Search
        </button>
        <button
          onClick={() => onSelectTab('videos')}
          className={`px-3 py-1 rounded-full ${currentTab === 'videos' ? 'bg-white text-black font-semibold' : 'text-neutral-400'}`}
        >
          Library
        </button>
        <button
          onClick={() => onSelectTab('health')}
          className={`px-3 py-1 rounded-full ${currentTab === 'health' ? 'bg-white text-black font-semibold' : 'text-neutral-400'}`}
        >
          Status
        </button>
      </div>
    </header>
  );
};
