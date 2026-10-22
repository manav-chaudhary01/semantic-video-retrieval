import React, { useEffect, useState } from 'react';
import { Header, type NavTab } from './Header';
import type { HealthResponse } from '../../types';
import { initLenis } from '../../utils/lenis';
import { Copy, Check, Terminal } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  // Initialize Lenis smooth scroll lifecycle
  useEffect(() => {
    const cleanup = initLenis();
    return () => {
      cleanup();
    };
  }, []);

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText('http://127.0.0.1:8000/api/v1/search');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

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

      {/* Miles Editorial Footer */}
      <footer className="border-t border-white/10 bg-black pt-16 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Upper footer grid */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-white/10">
            <div className="space-y-2 max-w-md">
              <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block">
                Multimodal Video Intelligence
              </span>
              <h4 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-white">
                Find the precise video interval through natural language.
              </h4>
              <p className="text-xs text-neutral-400">
                Zero-shot cross-modal retrieval indexing spoken dialogue and continuous visual frames.
              </p>
            </div>

            {/* Quick Action: Copy Endpoint (Miles Contact style) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={handleCopyEndpoint}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-neutral-900/80 hover:bg-neutral-800 text-xs font-mono text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                <span>api/v1/search</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span className="text-[10px] text-neutral-400">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => onSelectTab('search')}
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-medium tracking-tight transition-all cursor-pointer active:scale-95"
              >
                Launch Search
              </button>
            </div>
          </div>

          {/* Lower footer: Links and copyright */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-neutral-400 font-sans">
            <div className="flex flex-wrap items-center gap-6 font-mono text-[11px]">
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

            <div className="font-mono text-[11px] text-neutral-400">
              Semantic Video Retrieval &bull; Architecture Benchmark 24-26
            </div>
          </div>

          {/* Massive Miles Brand Watermark */}
          <div className="pt-8 select-none pointer-events-none opacity-[0.04] text-center">
            <span className="font-display font-black text-6xl sm:text-8xl md:text-9xl tracking-tighter uppercase whitespace-nowrap block">
              SEMANTIC RETRIEVAL
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
