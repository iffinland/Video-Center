// Video Center — V2 follow/subscription hook (QDN-persisted)
// Uses qvc-v2 envelope pattern. Replaces localStorage-based MVP.

import { useCallback, useEffect, useState } from 'react';
import type { FollowCreate } from '../services/architectureV2/types';
import type { IdentityValidator } from '../services/architectureV2/validation';
import { publishFollowV2, discoverFollowsV2 } from '../services/qdn/videoServiceV2';
import type { AccountProfile } from '../types/video';

export type UseFollowsResult = {
  followedNames: string[];
  loading: boolean;
  error: string | null;
  isFollowing: (name: string) => boolean;
  toggleFollow: (targetName: string) => Promise<void>;
  refresh: () => void;
};

export const useFollows = (
  account: AccountProfile | null,
  publisherName: string,
  identity: IdentityValidator | null,
): UseFollowsResult => {
  const [follows, setFollows] = useState<FollowCreate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!identity) {
      setError('Identity validation is not available.');
      return;
    }
    if (!publisherName) return;

    setLoading(true);
    setError(null);
    try {
      const result = await discoverFollowsV2(publisherName, identity);
      setFollows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load follows.');
    } finally {
      setLoading(false);
    }
  }, [publisherName, identity]);

  useEffect(() => {
    load();
  }, [load]);

  const followedNames = follows.map((f) => f.targetName);

  const isFollowing = useCallback((name: string) => followedNames.includes(name), [followedNames]);

  const toggleFollow = useCallback(
    async (targetName: string) => {
      if (!account || !account.address) {
        throw new Error('A registered name is required to follow creators.');
      }
      if (!targetName) return;

      const v2Identity = {
        publisherName,
        walletAddress: account.address,
      };

      try {
        // For now, only support adding follows (toggle-off via delete not yet implemented)
        if (!isFollowing(targetName)) {
          const result = await publishFollowV2(v2Identity, targetName);
          setFollows((prev) => [...prev, result]);
        }
        // Note: unfollow would require DELETE_QDN_RESOURCE, which is a write operation
        // and needs Home bridge approval. Will be added in a future phase.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update follow.');
      }
    },
    [account, publisherName, isFollowing],
  );

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return {
    followedNames,
    loading,
    error,
    isFollowing,
    toggleFollow,
    refresh,
  };
};
