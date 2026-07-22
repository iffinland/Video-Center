// Video Center — V2 video listing hook
// Uses qvc-v2 envelope pattern with identity validation.

import { useCallback, useEffect, useState } from 'react';
import type { VideoCreate } from '../services/architectureV2/types';
import type { IdentityValidator } from '../services/architectureV2/validation';
import { discoverV2Videos } from '../services/qdn/videoServiceV2';

export type UseVideosResult = {
  videos: VideoCreate[];
  loading: boolean;
  error: string | null;
  diagnostics: string[];
  refresh: () => void;
};

export const useVideos = (identity: IdentityValidator | null): UseVideosResult => {
  const [videos, setVideos] = useState<VideoCreate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const fetchVideos = useCallback(async () => {
    if (!identity) {
      setLoading(false);
      setError('Identity validation is not available.');
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnostics([]);
    try {
      const state = await discoverV2Videos(identity, (partialState) => {
        // Progressive update: render healthy videos immediately without waiting
        // for slow or broken resources. The final state will be emitted last.
        const videoEntities = Object.values(partialState.authoritative.entities).filter(
          (e): e is VideoCreate => e.entityType === 'video',
        );

        setVideos(videoEntities);

        // Only surface quarantine and partial-discovery warnings to the user.
        // Raw UNAVAILABLE_RESOURCE and timeout messages are tracked internally
        // but not shown when healthy videos are present.
        const userDiags: string[] = [];

        if (partialState.discovery.completeness === 'partial') {
          userDiags.push(
            `⚠️ Discovery was partial (${partialState.discovery.resourcesSeen} resources seen). Some videos may be missing.`,
          );
        }

        if (partialState.authoritative.quarantined.length > 0) {
          userDiags.push(
            `⚠️ ${partialState.authoritative.quarantined.length} resource(s) quarantined: ${partialState.authoritative.quarantined.map((q) => q.code).join(', ')}`,
          );
        }

        setDiagnostics(userDiags);

        // Once we have at least one video, stop showing the loading spinner.
        // Background discovery (broken resources) may still be pending.
        if (videoEntities.length > 0) {
          setLoading(false);
        }
      });

      // Final state — ensure everything is consistent after all fetches settle
      const videoEntities = Object.values(state.authoritative.entities).filter(
        (e): e is VideoCreate => e.entityType === 'video',
      );

      setVideos(videoEntities);

      const userDiags: string[] = [];

      if (state.discovery.completeness === 'partial') {
        userDiags.push(
          `⚠️ Discovery was partial (${state.discovery.resourcesSeen} resources seen). Some videos may be missing.`,
        );
      }

      if (state.authoritative.quarantined.length > 0) {
        userDiags.push(
          `⚠️ ${state.authoritative.quarantined.length} resource(s) quarantined: ${state.authoritative.quarantined.map((q) => q.code).join(', ')}`,
        );
      }

      setDiagnostics(userDiags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const refresh = useCallback(() => {
    fetchVideos();
  }, [fetchVideos]);

  return { videos, loading, error, diagnostics, refresh };
};
