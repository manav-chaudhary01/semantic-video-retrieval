import React from 'react';
import { Header, type NavTab } from './Header';
import type { HealthResponse } from '../../types';

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
  return (
    <div className="min-h-screen flex flex-col bg-[#0B0C0A] text-[#EBEEE0]">
      <Header
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        health={health}
        isHealthLoading={isHealthLoading}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-[#22271C] bg-[#12140F]/80 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-extrabold font-sans text-sm tracking-tight text-[#EBEEE0] uppercase">
                Semantic Video Retrieval
              </span>
              <span className="text-[10px] font-mono text-[#D2FF00] bg-[#D2FF00]/10 px-1.5 py-0.5 rounded border border-[#D2FF00]/20">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-[#A5A89C]">
              Deep Learning Multimodal Video Search Platform &bull; Academic Research Edition
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[#A5A89C]">
            <span className="hover:text-[#D2FF00] transition-colors cursor-pointer" onClick={() => onSelectTab('home')}>
              [Overview]
            </span>
            <span className="hover:text-[#D2FF00] transition-colors cursor-pointer" onClick={() => onSelectTab('search')}>
              [Search Studio]
            </span>
            <span className="hover:text-[#D2FF00] transition-colors cursor-pointer" onClick={() => onSelectTab('videos')}>
              [Video Ingestion]
            </span>
            <span className="hover:text-[#D2FF00] transition-colors cursor-pointer" onClick={() => onSelectTab('health')}>
              [Diagnostics]
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
