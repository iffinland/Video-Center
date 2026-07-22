// Video Center — V2 comments hook (load, add, edit)
// Uses qvc-v2 envelope pattern with identity validation.

import { useCallback, useEffect, useState } from 'react';
import type { CommentCreate } from '../services/architectureV2/types';
import type { IdentityValidator } from '../services/architectureV2/validation';
import { fetchCommentsV2, publishCommentV2, updateCommentV2 } from '../services/qdn/videoServiceV2';
import type { AccountProfile } from '../types/video';

export type UseCommentsResult = {
  comments: CommentCreate[];
  loading: boolean;
  error: string | null;
  addComment: (body: string) => Promise<void>;
  editComment: (comment: CommentCreate, newBody: string) => Promise<void>;
  refresh: () => void;
};

export const useComments = (
  videoId: string | undefined,
  account: AccountProfile | null,
  publisherName: string,
  identity: IdentityValidator | null,
): UseCommentsResult => {
  const [comments, setComments] = useState<CommentCreate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!videoId) return;
    if (!identity) {
      setError('Identity validation is not available.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchCommentsV2(videoId, identity);
      setComments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  }, [videoId, identity]);

  useEffect(() => {
    load();
  }, [load]);

  const addComment = useCallback(
    async (body: string) => {
      if (!videoId) throw new Error('No video selected.');
      if (!account || !account.address) {
        throw new Error('A registered Qortium name is required to comment.');
      }
      if (!body.trim()) throw new Error('Comment cannot be empty.');
      if (body.length > 2000) throw new Error('Comment must be 2000 characters or fewer.');

      const v2Identity = {
        publisherName,
        walletAddress: account.address,
      };

      const newComment = await publishCommentV2(videoId, v2Identity, body);
      setComments((prev) => [...prev, newComment]);
    },
    [videoId, account, publisherName],
  );

  const editComment = useCallback(
    async (comment: CommentCreate, newBody: string) => {
      if (comment.publisherName !== publisherName) {
        throw new Error('You can only edit your own comments.');
      }
      if (!account || !account.address) {
        throw new Error('Account not available for editing.');
      }
      if (!newBody.trim()) throw new Error('Comment cannot be empty.');
      if (newBody.length > 2000) throw new Error('Comment must be 2000 characters or fewer.');

      const v2Identity = {
        publisherName,
        walletAddress: account.address,
      };

      await updateCommentV2(comment.entityId, v2Identity, newBody);
      // Reload to get the updated state
      await load();
    },
    [account, publisherName, load],
  );

  return {
    comments,
    loading,
    error,
    addComment,
    editComment,
    refresh: load,
  };
};
