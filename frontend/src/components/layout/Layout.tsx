import React, { useEffect } from 'react';
import { Header, type NavTab } from './Header';
import type { HealthResponse } from '../../types';
import { initLenis } from '../../utils/lenis';

export interface LayoutProps {
  children: React.ReactNode;
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  health: HealthResponse | null;
  isHealthLoading: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentTab,
  onSelectTab,
  health,
  isHealthLoading,
}) => {
  // Initialize Lenis smooth scroll lifecycle
  useEffect(() => {
    const cleanup = initLenis();
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-white selection:text-black">
      <Header
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        health={health}
        isHealthLoading={isHealthLoading}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {children}
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-white/10 bg-black py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-neutral-400 font-sans">
          <div className="space-y-1 text-center sm:text-left">
            <span className="font-semibold font-display uppercase tracking-tight text-white block">
              Semantic Video Retrieval
            </span>
            <p className="text-xs text-neutral-500 font-sans">
              Natural-language temporal search across spoken dialogue and visual video frames.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-[11px]">
            <button
              onClick={() => onSelectTab('home')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              onClick={() => onSelectTab('search')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Search
            </button>
            <button
              onClick={() => onSelectTab('videos')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Library
            </button>
            <button
              onClick={() => onSelectTab('health')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Diagnostics
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
