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
    <div className="min-h-screen flex flex-col bg-[#0B0C0A] text-[#EBEEE0]">
      <Header
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        health={health}
        isHealthLoading={isHealthLoading}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-[#22271C] bg-[#0B0C0A] py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#A5A89C]">
          <div className="space-y-1 text-center md:text-left">
            <span className="font-bold font-sans uppercase tracking-tight text-[#EBEEE0] block">
              Semantic Video Retrieval
            </span>
            <p>
              Natural-language temporal search across spoken dialogue and visual video frames.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-[11px]">
            <button
              onClick={() => onSelectTab('home')}
              className="hover:text-[#D2FF00] transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              onClick={() => onSelectTab('search')}
              className="hover:text-[#D2FF00] transition-colors cursor-pointer"
            >
              Search
            </button>
            <button
              onClick={() => onSelectTab('videos')}
              className="hover:text-[#D2FF00] transition-colors cursor-pointer"
            >
              Library
            </button>
            <button
              onClick={() => onSelectTab('health')}
              className="hover:text-[#D2FF00] transition-colors cursor-pointer"
            >
              Diagnostics
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
