// Video Center — V2 following/subscriptions page

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VideoCreate } from '../services/architectureV2/types';
import { useFollows } from '../hooks/useFollows';
import { useAccount } from '../hooks/useAccount';
import { discoverV2Videos } from '../services/qdn/videoServiceV2';
import { VideoGrid } from '../components/video/VideoGrid';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/shared/LoadingSpinner';

export const FollowingPage = () => {
  const navigate = useNavigate();
  const { account, identity } = useAccount();
  const { followedNames, loading: followsLoading } = useFollows(
    account,
    account?.name ?? '',
    identity,
  );
  const [videos, setVideos] = useState<VideoCreate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    if (!identity) return;
    if (followedNames.length === 0) {
      setVideos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const state = await discoverV2Videos(identity);

      const videoEntities = Object.values(state.authoritative.entities).filter(
        (e): e is VideoCreate =>
          e.entityType === 'video' && followedNames.includes(e.publisherName),
      );

      setVideos(videoEntities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load followed channels.');
    } finally {
      setLoading(false);
    }
  }, [identity, followedNames]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleVideoClick = useCallback(
    (video: VideoCreate) => {
      navigate(
        `/video/${encodeURIComponent(video.publisherName)}/${encodeURIComponent(video.entityId)}`,
      );
    },
    [navigate],
  );

  if (followsLoading) {
    return <LoadingSpinner message="Loading follows…" />;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Following</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {followedNames.length} creator{followedNames.length !== 1 ? 's' : ''} followed
        </p>
      </div>

      {error && <ErrorMessage message={error} onRetry={loadVideos} />}

      {loading && <LoadingSpinner message="Loading videos from followed creators…" />}

      {!loading && !error && videos.length === 0 && (
        <EmptyState
          title="No videos from followed creators"
          description={
            followedNames.length === 0
              ? "You aren't following any creators yet. Visit a creator's channel to follow them."
              : 'The creators you follow have not published any videos yet.'
          }
        />
      )}

      {videos.length > 0 && <VideoGrid videos={videos} onVideoClick={handleVideoClick} />}
    </div>
  );
};
