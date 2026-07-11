// Video Center — comments hook (load, add, edit)
// Canonical reference: qortium-blog blogService comments pattern (VERIFIED-E2E)

import { useCallback, useEffect, useState } from 'react';
import type { CommentV1 } from '../types/video';
import type { AccountProfile } from '../types/video';
import {
  fetchComments,
  publishComment,
  updateComment,
} from '../services/qdn/videoService';

type UseCommentsResult = {
  comments: CommentV1[];
  loading: boolean;
  error: string | null;
  addComment: (body: string) => Promise<void>;
  editComment: (comment: CommentV1, newBody: string) => Promise<void>;
  refresh: () => void;
};

export const useComments = (
  videoId: string | undefined,
  account: AccountProfile | null,
): UseCommentsResult => {
  const [comments, setComments] = useState<CommentV1[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!videoId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchComments(videoId);
      setComments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    load();
  }, [load]);

  const addComment = useCallback(
    async (body: string) => {
      if (!videoId) throw new Error('No video selected.');
      if (!account || account.names.length === 0) {
        throw new Error('A registered Qortium name is required to comment.');
      }
      if (!body.trim()) throw new Error('Comment cannot be empty.');
      if (body.length > 2000) throw new Error('Comment must be 2000 characters or fewer.');

      const newComment = await publishComment(videoId, account.name, body);
      setComments((prev) => [...prev, newComment].sort((a, b) => a.createdAt - b.createdAt));
    },
    [videoId, account],
  );

  const editComment = useCallback(
    async (comment: CommentV1, newBody: string) => {
      if (!account || !account.names.includes(comment.authorName)) {
        throw new Error('You can only edit your own comments.');
      }
      if (!newBody.trim()) throw new Error('Comment cannot be empty.');
      if (newBody.length > 2000) throw new Error('Comment must be 2000 characters or fewer.');

      const updated = await updateComment(comment, newBody);
      setComments((prev) =>
        prev
          .map((c) => (c.commentId === comment.commentId ? updated : c))
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    },
    [account],
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
