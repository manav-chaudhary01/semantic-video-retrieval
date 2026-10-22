import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/layout/Layout';
import type { NavTab } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { VideosPage } from './pages/VideosPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import type { HealthResponse } from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

  // States to pass from Homepage to Search Studio
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [activeSearchModality, setActiveSearchModality] = useState<'text' | 'visual' | 'multimodal'>('multimodal');

  const fetchHealth = useCallback(async () => {
    setIsHealthLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleNavigateToSearch = (initialQuery?: string, modality?: 'text' | 'visual' | 'multimodal') => {
    if (initialQuery !== undefined) {
      setActiveSearchQuery(initialQuery);
    }
    if (modality !== undefined) {
      setActiveSearchModality(modality);
    }
    setCurrentTab('search');
  };

  return (
    <Layout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      health={health}
      isHealthLoading={isHealthLoading}
    >
      {currentTab === 'home' && (
        <HomePage
          onNavigateToSearch={handleNavigateToSearch}
          onNavigateToVideos={() => setCurrentTab('videos')}
          onNavigateToDiagnostics={() => setCurrentTab('health')}
        />
      )}
      {currentTab === 'search' && (
        <SearchPage
          key={`${activeSearchQuery}-${activeSearchModality}`}
          initialQuery={activeSearchQuery}
          initialModality={activeSearchModality}
        />
      )}
      {currentTab === 'videos' && <VideosPage />}
      {currentTab === 'health' && (
        <SystemHealthPage
          initialHealth={health}
          onRefreshHealth={fetchHealth}
          isLoading={isHealthLoading}
        />
      )}
    </Layout>
  );
};

export default App;
