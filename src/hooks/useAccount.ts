// Video Center — V2 account state hook
// Provides account profile + IdentityValidator for V2 operations.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccountProfile } from '../types/video';
import { getSelectedAccount } from '../services/qortium/accountService';
import { hasQortiumBridge } from '../services/qortium/qortiumClient';
import { resolveNameToAddress } from '../services/qortium/walletService';
import { createIdentityValidator } from '../services/qdn/videoServiceV2';
import type { IdentityValidator } from '../services/architectureV2/validation';

export type UseAccountResult = {
  account: AccountProfile | null;
  identity: IdentityValidator | null;
  loading: boolean;
  error: string | null;
  hasBridge: boolean;
  refresh: () => void;
};

export const useAccount = (): UseAccountResult => {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addressCache, setAddressCache] = useState<Map<string, string>>(new Map());

  // Evaluate bridge availability on every render so the hook reacts if the
  // bridge becomes available after the initial mount (e.g., iframe timing).
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

      // Build address cache from known names
      const cache = new Map<string, string>();
      if (profile.address) {
        for (const name of profile.names) {
          cache.set(name, profile.address);
        }
      }
      setAddressCache(cache);
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

  // Create identity validator from cached addresses
  const identity = useMemo<IdentityValidator | null>(() => {
    const currentCache = addressCache;
    // Require BOTH conditions: cache must be populated AND account must have
    // an address. Using || (not &&) prevents creating a validator with an
    // empty cache in the brief window where account is set but cache is not.
    if (currentCache.size === 0 || !account?.address) return null;

    return createIdentityValidator((name: string) => {
      // Check cache first
      const cached = currentCache.get(name);
      if (cached) return cached;

      // Schedule async resolution (fire-and-forget to populate cache)
      resolveNameToAddress(name)
        .then((addr) => {
          if (addr) {
            setAddressCache((prev) => new Map(prev).set(name, addr));
          }
        })
        .catch(() => {});

      // Return null for now — wallet binding check will fail gracefully
      return null;
    });
  }, [addressCache, account?.address]);

  return {
    account,
    identity,
    loading,
    error,
    hasBridge,
    refresh: fetchAccount,
  };
};
