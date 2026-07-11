// Video Center — single video detail hook

import { useCallback, useEffect, useState } from 'react';
import type { VideoMetadataV1 } from '../types/video';
import {
  fetchVideoMetadata,
  resolveVideoMediaUrl,
  resolveVideoThumbnailUrl,
} from '../services/qdn/videoService';

type UseVideoDetailResult = {
  video: VideoMetadataV1 | null;
  mediaUrl: string;
  thumbnailUrl: string;
  loading: boolean;
  error: string | null;
};

export const useVideoDetail = (
  publisherName: string | undefined,
  identifier: string | undefined,
): UseVideoDetailResult => {
  const [video, setVideo] = useState<VideoMetadataV1 | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!publisherName || !identifier) {
      setError('Missing video publisher or identifier.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const metadata = await fetchVideoMetadata(publisherName, identifier);
      setVideo(metadata);

      const [media, thumb] = await Promise.all([
        resolveVideoMediaUrl(metadata).catch(() => ''),
        resolveVideoThumbnailUrl(metadata).catch(() => ''),
      ]);
      setMediaUrl(media);
      setThumbnailUrl(thumb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video.');
      setVideo(null);
      setMediaUrl('');
      setThumbnailUrl('');
    } finally {
      setLoading(false);
    }
  }, [publisherName, identifier]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { video, mediaUrl, thumbnailUrl, loading, error };
};
