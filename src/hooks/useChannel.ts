// Video Center — V2 channel hook (creator profile + video listing)

import { useCallback, useEffect, useState } from 'react';
import type { VideoCreate } from '../services/architectureV2/types';
import type { IdentityValidator } from '../services/architectureV2/validation';
import { discoverV2Videos } from '../services/qdn/videoServiceV2';

export type UseChannelResult = {
  creatorName: string;
  videos: VideoCreate[];
  loading: boolean;
  error: string | null;
};

export const useChannel = (
  creatorName: string | undefined,
  identity: IdentityValidator | null,
): UseChannelResult => {
  const [videos, setVideos] = useState<VideoCreate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    if (!creatorName) return;
    if (!identity) {
      setError('Identity validation is not available.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const state = await discoverV2Videos(identity);

      const videoEntities = Object.values(state.authoritative.entities).filter(
        (e): e is VideoCreate => e.entityType === 'video' && e.publisherName === creatorName,
      );

      setVideos(videoEntities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel videos.');
    } finally {
      setLoading(false);
    }
  }, [creatorName, identity]);

  useEffect(() => {
    setVideos([]);
    if (creatorName && identity) {
      fetchVideos();
    }
  }, [creatorName, identity, fetchVideos]);

  return {
    creatorName: creatorName ?? '',
    videos,
    loading,
    error,
  };
};
