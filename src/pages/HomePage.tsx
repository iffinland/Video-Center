// Video Center — home/discovery page

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResultItem } from '../types/video';
import { useVideos } from '../hooks/useVideos';
import { VideoGrid } from '../components/video/VideoGrid';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/shared/LoadingSpinner';

type Props = {
  searchQuery: string;
};

export const HomePage = ({ searchQuery }: Props) => {
  const navigate = useNavigate();
  const { videos, loading, error, hasMore, loadMore } = useVideos(20);

  const handleVideoClick = useCallback(
    (item: SearchResultItem) => {
      navigate(`/video/${encodeURIComponent(item.name)}/${encodeURIComponent(item.identifier)}`);
    },
    [navigate],
  );

  // Client-side search filter when query is active
  const filtered = searchQuery
    ? videos.filter((v) => {
        const q = searchQuery.toLowerCase();
        const title = ((v as Record<string, unknown>).title as string) || v.identifier;
        return (
          title.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          (v.description && v.description.toLowerCase().includes(q))
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
            {searchQuery && videos.length !== filtered.length && ` (filtered from ${videos.length})`}
          </p>
        )}
      </div>

      {loading && videos.length === 0 && <LoadingSpinner message="Loading videos from QDN…" />}

      {error && videos.length === 0 && (
        <ErrorMessage message={error} onRetry={() => window.location.reload()} />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={searchQuery ? 'No matching videos' : 'No videos yet'}
          description={
            searchQuery
              ? 'Try a different search term.'
              : 'Be the first to publish a video on Video Center!'
          }
        />
      )}

      {filtered.length > 0 && (
        <>
          <VideoGrid videos={filtered} onVideoClick={handleVideoClick} />
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={loadMore}
                disabled={loading}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: loading ? '#d1d5db' : '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {loading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
          {loading && videos.length > 0 && <LoadingSpinner message="Loading more…" />}
        </>
      )}
    </div>
  );
};
