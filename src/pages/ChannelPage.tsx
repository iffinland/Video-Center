// Video Center — channel/creator page

import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SearchResultItem } from '../types/video';
import { useChannel } from '../hooks/useChannel';
import { useFollows } from '../hooks/useFollows';
import { VideoGrid } from '../components/video/VideoGrid';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/shared/LoadingSpinner';

export const ChannelPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const creatorName = name ? decodeURIComponent(name) : undefined;
  const { videos, loading, error, hasMore, loadMore } = useChannel(creatorName, 20);
  const { isFollowing, toggleFollow } = useFollows();

  const handleVideoClick = useCallback(
    (item: SearchResultItem) => {
      navigate(`/video/${encodeURIComponent(item.name)}/${encodeURIComponent(item.identifier)}`);
    },
    [navigate],
  );

  const following = creatorName ? isFollowing(creatorName) : false;

  if (!creatorName) {
    return <ErrorMessage message="No creator name specified." onRetry={() => navigate('/')} />;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Channel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        paddingBottom: '1.25rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          backgroundColor: '#6366f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '1.75rem',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {creatorName.charAt(0).toUpperCase()}
        </div>

        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: 0,
            marginBottom: '0.25rem',
          }}>
            {creatorName}
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem',
            margin: 0,
          }}>
            {loading ? 'Loading…' : `${videos.length} video${videos.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {creatorName && (
          <button
            onClick={() => toggleFollow(creatorName)}
            style={{
              marginLeft: 'auto',
              padding: '0.5rem 1.25rem',
              backgroundColor: following ? '#f3f4f6' : '#6366f1',
              color: following ? '#374151' : '#fff',
              border: following ? '1px solid #d1d5db' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {following ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {/* Channel content */}
      {loading && videos.length === 0 && (
        <LoadingSpinner message={`Loading ${creatorName}'s videos…`} />
      )}

      {error && videos.length === 0 && (
        <ErrorMessage message={error} onRetry={() => navigate(0)} />
      )}

      {!loading && !error && videos.length === 0 && (
        <EmptyState
          title="No videos yet"
          description={`${creatorName} hasn't published any videos yet.`}
        />
      )}

      {videos.length > 0 && (
        <>
          <VideoGrid videos={videos} onVideoClick={handleVideoClick} />

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
