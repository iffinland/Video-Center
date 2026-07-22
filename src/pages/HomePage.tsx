// Video Center — V2 home/discovery page

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VideoCreate } from '../services/architectureV2/types';
import { useVideos } from '../hooks/useVideos';
import { useAccount } from '../hooks/useAccount';
import { VideoGrid } from '../components/video/VideoGrid';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/shared/LoadingSpinner';

type Props = {
  searchQuery: string;
};

export const HomePage = ({ searchQuery }: Props) => {
  const navigate = useNavigate();
  const { identity, error: accountError, loading: accountLoading } = useAccount();
  const { videos, loading, error, diagnostics, refresh } = useVideos(identity);

  const handleVideoClick = useCallback(
    (video: VideoCreate) => {
      navigate(
        `/video/${encodeURIComponent(video.publisherName)}/${encodeURIComponent(video.entityId)}`,
      );
    },
    [navigate],
  );

  // Client-side search filter when query is active
  const filtered = searchQuery
    ? videos.filter((v) => {
        const q = searchQuery.toLowerCase();
        return (
          v.title.toLowerCase().includes(q) ||
          v.publisherName.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
    : videos;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {searchQuery ? `Results for "${searchQuery}"` : 'Discover'}
        </h1>
        {!loading && !error && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {filtered.length} video{filtered.length !== 1 ? 's' : ''}
            {searchQuery &&
              videos.length !== filtered.length &&
              ` (filtered from ${videos.length})`}
          </p>
        )}
      </div>

      {accountLoading && <LoadingSpinner message="Loading account…" />}

      {accountError && <ErrorMessage message={accountError} />}

      {!accountLoading && loading && <LoadingSpinner message="Loading videos from QDN…" />}

      {error && <ErrorMessage message={error} onRetry={refresh} />}

      {!accountLoading && !loading && !error && filtered.length === 0 && (
        <EmptyState
          title={searchQuery ? 'No matching videos' : 'No videos yet'}
          description={
            searchQuery
              ? 'Try a different search term.'
              : 'Be the first to publish a video on Video Center!'
          }
        />
      )}

      {diagnostics.length > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            fontSize: '0.75rem',
            color: '#92400e',
          }}
        >
          {diagnostics.slice(0, 3).map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}

      {filtered.length > 0 && <VideoGrid videos={filtered} onVideoClick={handleVideoClick} />}
    </div>
  );
};
