// Video Center — application root with QDN SPA routing
// Canonical reference: Discussion-Boards/src/App.tsx (VERIFIED-E2E)
//   - _qdnBase basename injection for QDN-hosted routing

import { useCallback, useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { PublishPage } from './pages/PublishPage';
import { ChannelPage } from './pages/ChannelPage';
import { FollowingPage } from './pages/FollowingPage';

const qdnWindow = window as Window & { _qdnBase?: string };
const routerBaseName = qdnWindow._qdnBase || '';

const AppContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (window.location.pathname !== routerBaseName + '/' && window.location.pathname !== routerBaseName) {
        navigate('/');
      }
    },
    [navigate],
  );

  return (
    <Layout onSearch={handleSearch}>
      <Routes>
        <Route path="/" element={<HomePage searchQuery={searchQuery} />} />
        <Route path="/video/:name/:identifier" element={<VideoDetailPage />} />
        <Route path="/channel/:name" element={<ChannelPage />} />
        <Route path="/following" element={<FollowingPage />} />
        <Route path="/publish" element={<PublishPage />} />
      </Routes>
    </Layout>
  );
};

const App = () => {
  return (
    <BrowserRouter basename={routerBaseName}>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
