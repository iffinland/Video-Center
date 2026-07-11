// Video Center — publish flow hook
// Canonical reference: qortium-blog blogService + mediaService publish patterns (VERIFIED-E2E)

import { useCallback, useState } from 'react';
import type { PublishProgress } from '../types/video';
import { requireOwnedName } from '../services/qortium/accountService';
import {
  publishVideo,
  validatePublishInput,
  type PublishVideoInput,
} from '../services/qdn/videoService';

type UsePublishResult = {
  progress: PublishProgress;
  publish: (input: Omit<PublishVideoInput, 'ownerName'> & { ownerName?: string }, accountNames: string[]) => Promise<void>;
  reset: () => void;
};

const initialState: PublishProgress = { state: 'idle', message: '' };

export const usePublish = (): UsePublishResult => {
  const [progress, setProgress] = useState<PublishProgress>(initialState);

  const publish = useCallback(
    async (
      input: Omit<PublishVideoInput, 'ownerName'> & { ownerName?: string },
      accountNames: string[],
    ) => {
      try {
        // Validate owner name
        setProgress({ state: 'validating', message: 'Validating publishing identity…' });

        let ownerName: string;
        try {
          ownerName = requireOwnedName(accountNames, input.ownerName);
        } catch (err) {
          setProgress({
            state: 'error',
            message: 'Publishing name validation failed.',
            error: err instanceof Error ? err.message : 'Invalid publishing name.',
          });
          return;
        }

        const fullInput: PublishVideoInput = { ...input, ownerName };

        // Validate all fields
        const validationError = validatePublishInput(fullInput);
        if (validationError) {
          setProgress({
            state: 'error',
            message: 'Validation failed.',
            error: validationError,
          });
          return;
        }

        setProgress({ state: 'ready', message: 'Ready to publish. Approve the request in Qortium Home…' });

        // Approval + publish
        setProgress({
          state: 'awaiting_approval',
          message: 'Waiting for approval in Qortium Home…',
        });

        // The publishVideo call will trigger the Home approval dialog
        const metadata = await publishVideo(fullInput);

        setProgress({
          state: 'verifying',
          message: 'Verifying published resources on QDN…',
          publishedVideoId: metadata.videoId,
          publishedName: ownerName,
        });

        // Success
        setProgress({
          state: 'success',
          message: 'Video published successfully!',
          publishedVideoId: metadata.videoId,
          publishedName: ownerName,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Publish failed.';

        // Detect approval denial
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('denied') || lowerMessage.includes('rejected') || lowerMessage.includes('cancelled')) {
          setProgress({
            state: 'approval_denied',
            message: 'Publishing was cancelled or denied.',
            error: message,
          });
        } else {
          setProgress({
            state: 'error',
            message: 'Publishing failed.',
            error: message,
          });
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setProgress(initialState);
  }, []);

  return { progress, publish, reset };
};
