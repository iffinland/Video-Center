// Video Center — video listing hook

import { useCallback, useEffect, useState } from 'react';
import type { SearchResultItem } from '../types/video';
import { searchVideos } from '../services/qdn/videoService';

type UseVideosResult = {
  videos: SearchResultItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

export const useVideos = (limit = 20): UseVideosResult => {
  const [videos, setVideos] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchVideos = useCallback(
    async (currentOffset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const results = await searchVideos(currentOffset, limit);
        const filtered = results.filter(
          (item) => item.identifier && item.name,
        );
        setVideos((prev) =>
          append ? [...prev, ...filtered] : filtered,
        );
        setHasMore(results.length >= limit);
        if (append) {
          setOffset(currentOffset + results.length);
        } else {
          setOffset(results.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos.');
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchVideos(0, false);
  }, [fetchVideos]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchVideos(offset, true);
    }
  }, [loading, hasMore, offset, fetchVideos]);

  const refresh = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    fetchVideos(0, false);
  }, [fetchVideos]);

  return { videos, loading, error, hasMore, loadMore, refresh };
};
