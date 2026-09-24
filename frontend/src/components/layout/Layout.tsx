import React from 'react';
import { Header } from './Header';
import type { HealthResponse } from '../../types';

export interface LayoutProps {
  children: React.ReactNode;
  currentTab: 'search' | 'videos' | 'health';
  onSelectTab: (tab: 'search' | 'videos' | 'health') => void;
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
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        health={health}
        isHealthLoading={isHealthLoading}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>Semantic Video Retrieval &bull; Deep Learning Academic Research Platform</p>
      </footer>
    </div>
  );
};
