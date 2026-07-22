// Video Center — V2 publish flow hook
// Uses qvc-v2 envelope pattern.

import { useCallback, useState } from 'react';
import type { PublishProgress } from '../types/video';
import {
  publishVideoV2,
  validatePublishV2Input,
  type PublishVideoV2Input,
} from '../services/qdn/videoServiceV2';
import type { AccountProfile } from '../types/video';

export type UsePublishResult = {
  progress: PublishProgress;
  publish: (input: Omit<PublishVideoV2Input, 'identity'>, account: AccountProfile) => Promise<void>;
  reset: () => void;
};

const initialState: PublishProgress = { state: 'idle', message: '' };

export const usePublish = (): UsePublishResult => {
  const [progress, setProgress] = useState<PublishProgress>(initialState);

  const publish = useCallback(
    async (input: Omit<PublishVideoV2Input, 'identity'>, account: AccountProfile) => {
      try {
        setProgress({ state: 'validating', message: 'Validating publishing identity…' });

        if (!account || !account.name || !account.address) {
          setProgress({
            state: 'error',
            message: 'Publishing requires a registered Qortium name.',
            error: 'No account selected or account missing registered name.',
          });
          return;
        }

        const identity = {
          publisherName: account.name,
          walletAddress: account.address,
        };

        const fullInput: PublishVideoV2Input = { ...input, identity };

        const validationError = validatePublishV2Input(fullInput);
        if (validationError) {
          setProgress({ state: 'error', message: 'Validation failed.', error: validationError });
          return;
        }

        setProgress({
          state: 'ready',
          message: 'Ready to publish. Approve the request in Qortium Home…',
        });

        setProgress({
          state: 'awaiting_approval',
          message: 'Waiting for approval in Qortium Home…',
        });

        const metadata = await publishVideoV2(fullInput);

        setProgress({
          state: 'verifying',
          message: 'Verifying published resources on QDN…',
          publishedVideoId: metadata.entityId,
          publishedName: identity.publisherName,
        });

        setProgress({
          state: 'success',
          message: 'Video published successfully!',
          publishedVideoId: metadata.entityId,
          publishedName: identity.publisherName,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Publish failed.';
        const lowerMessage = message.toLowerCase();

        if (
          lowerMessage.includes('denied') ||
          lowerMessage.includes('rejected') ||
          lowerMessage.includes('cancelled')
        ) {
          setProgress({
            state: 'approval_denied',
            message: 'Publishing was cancelled or denied.',
            error: message,
          });
        } else {
          setProgress({ state: 'error', message: 'Publishing failed.', error: message });
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
