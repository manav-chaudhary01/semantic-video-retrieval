import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/layout/Layout';
import { SearchPage } from './pages/SearchPage';
import { VideosPage } from './pages/VideosPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import type { HealthResponse } from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'search' | 'videos' | 'health'>('health');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

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

  return (
    <Layout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      health={health}
      isHealthLoading={isHealthLoading}
    >
      {currentTab === 'search' && <SearchPage />}
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
