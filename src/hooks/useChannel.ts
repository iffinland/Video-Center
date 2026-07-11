// Video Center — channel hook (creator profile + video listing)

import { useCallback, useEffect, useState } from 'react';
import type { SearchResultItem } from '../types/video';
import { searchVideosByCreator } from '../services/qdn/videoService';

type UseChannelResult = {
  creatorName: string;
  videos: SearchResultItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

export const useChannel = (creatorName: string | undefined, limit = 20): UseChannelResult => {
  const [videos, setVideos] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchVideos = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (!creatorName) return;

      setLoading(true);
      setError(null);
      try {
        const results = await searchVideosByCreator(creatorName, currentOffset, limit);
        setVideos((prev) => (append ? [...prev, ...results] : results));
        setHasMore(results.length >= limit);
        setOffset(currentOffset + results.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load channel videos.');
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [creatorName, limit],
  );

  useEffect(() => {
    setVideos([]);
    setOffset(0);
    setHasMore(true);
    if (creatorName) {
      fetchVideos(0, false);
    }
  }, [creatorName, fetchVideos]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && creatorName) {
      fetchVideos(offset, true);
    }
  }, [loading, hasMore, offset, creatorName, fetchVideos]);

  return {
    creatorName: creatorName ?? '',
    videos,
    loading,
    error,
    hasMore,
    loadMore,
  };
};
