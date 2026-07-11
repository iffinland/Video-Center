// Video Center — account state hook
// Canonical reference: qortium-blog account flow (VERIFIED-E2E)

import { useCallback, useEffect, useState } from 'react';
import type { AccountProfile } from '../types/video';
import { getSelectedAccount } from '../services/qortium/accountService';
import { hasQortiumBridge } from '../services/qortium/qortiumClient';

type UseAccountResult = {
  account: AccountProfile | null;
  loading: boolean;
  error: string | null;
  hasBridge: boolean;
  refresh: () => void;
};

export const useAccount = (): UseAccountResult => {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasBridge = hasQortiumBridge();

  const fetchAccount = useCallback(async () => {
    if (!hasBridge) {
      setLoading(false);
      setError('Account selection is only available inside Qortium Home.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await getSelectedAccount();
      setAccount(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account.');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [hasBridge]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return {
    account,
    loading,
    error,
    hasBridge,
    refresh: fetchAccount,
  };
};
