// Video Center — following/subscriptions page

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResultItem } from '../types/video';
import { useFollows } from '../hooks/useFollows';
import { searchVideosByCreator } from '../services/qdn/videoService';
import { VideoGrid } from '../components/video/VideoGrid';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/shared/LoadingSpinner';

export const FollowingPage = () => {
  const navigate = useNavigate();
  const { followedNames, toggleFollow } = useFollows();
  const [videos, setVideos] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    if (followedNames.length === 0) {
      setVideos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Search for videos from all followed names
      const results = await Promise.all(
        followedNames.map((name) =>
          searchVideosByCreator(name, 0, 50).catch(() => [] as SearchResultItem[]),
        ),
      );

      // Flatten, deduplicate by name+identifier, sort by newest first
      const seen = new Set<string>();
      const merged = results
        .flat()
        .filter((item) => {
          const key = `${item.name}-${item.identifier}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0));

      setVideos(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load followed channels.');
    } finally {
      setLoading(false);
    }
  }, [followedNames]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleVideoClick = useCallback(
    (item: SearchResultItem) => {
      navigate(`/video/${encodeURIComponent(item.name)}/${encodeURIComponent(item.identifier)}`);
    },
    [navigate],
  );

  if (loading) {
    return <LoadingSpinner message="Loading videos from followed channels…" />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadVideos} />;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Following</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {followedNames.length === 0
            ? "You're not following any channels yet."
            : `${videos.length} video${videos.length !== 1 ? 's' : ''} from ${followedNames.length} channel${followedNames.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {followedNames.length === 0 && (
        <EmptyState
          title="No followed channels"
          description="Follow creators from their channel page to see their videos here."
        />
      )}

      {followedNames.length > 0 && videos.length === 0 && !loading && (
        <EmptyState
          title="No videos from followed channels"
          description="The creators you follow haven't published any videos yet."
        />
      )}

      {videos.length > 0 && (
        <VideoGrid videos={videos} onVideoClick={handleVideoClick} />
      )}

      {/* Following management */}
      {followedNames.length > 0 && (
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Manage followed channels
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {followedNames.map((name) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#eef2ff',
                  borderRadius: 20,
                  fontSize: '0.8125rem',
                }}
              >
                <button
                  onClick={() => navigate(`/channel/${encodeURIComponent(name)}`)}
                  style={{
                    color: '#6366f1',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.8125rem',
                  }}
                >
                  {name}
                </button>
                <button
                  onClick={() => toggleFollow(name)}
                  style={{
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                  title="Unfollow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
