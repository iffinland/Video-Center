// Video Center — tipping hook

import { useCallback, useState } from 'react';
import { sendTip } from '../services/qortium/walletService';

type UseTipResult = {
  sending: boolean;
  error: string | null;
  success: boolean;
  tip: (recipientName: string, amount: number) => Promise<void>;
  reset: () => void;
};

export const useTip = (): UseTipResult => {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tip = useCallback(async (recipientName: string, amount: number) => {
    setSending(true);
    setError(null);
    setSuccess(false);
    try {
      await sendTip(recipientName, amount);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tip failed.';
      // Detect approval denial
      const lower = message.toLowerCase();
      if (lower.includes('denied') || lower.includes('rejected') || lower.includes('cancelled')) {
        setError('Tip was cancelled or denied in Qortium Home.');
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { sending, error, success, tip, reset };
};
