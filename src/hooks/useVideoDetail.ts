// Video Center — V2 single video detail hook

import { useCallback, useEffect, useState } from 'react';
import type { VideoCreate } from '../services/architectureV2/types';
import type { IdentityValidator } from '../services/architectureV2/validation';
import {
  fetchVideoMetadataV2,
  resolveVideoMediaUrl as fetchMediaUrl,
  resolveVideoThumbnailUrl as fetchThumbnailUrl,
} from '../services/qdn/videoServiceV2';

export type UseVideoDetailResult = {
  video: VideoCreate | null;
  mediaUrl: string;
  thumbnailUrl: string;
  loading: boolean;
  error: string | null;
};

export const useVideoDetail = (
  publisherName: string | undefined,
  identifier: string | undefined,
  identity: IdentityValidator | null,
): UseVideoDetailResult => {
  const [video, setVideo] = useState<VideoCreate | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!publisherName || !identifier) {
      setError('Missing video publisher or identifier.');
      return;
    }
    if (!identity) {
      setError('Identity validation is not available.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const metadata = await fetchVideoMetadataV2(publisherName, identifier, identity);
      setVideo(metadata);

      const [media, thumb] = await Promise.all([
        fetchMediaUrl(metadata).catch(() => ''),
        fetchThumbnailUrl(metadata).catch(() => ''),
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
  }, [publisherName, identifier, identity]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { video, mediaUrl, thumbnailUrl, loading, error };
};
