// Video Center — follow/subscription hook (localStorage-based MVP)
// Uses localStorage until a network-persisted follow model is established.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'video-center-follows';

const loadFollows = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
};

const saveFollows = (names: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Storage full or unavailable — silently fail
  }
};

export const useFollows = () => {
  const [followedNames, setFollowedNames] = useState<string[]>(() => loadFollows());

  useEffect(() => {
    saveFollows(followedNames);
  }, [followedNames]);

  const isFollowing = useCallback(
    (name: string) => followedNames.includes(name),
    [followedNames],
  );

  const toggleFollow = useCallback((name: string) => {
    setFollowedNames((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name);
      }
      return [...prev, name];
    });
  }, []);

  return {
    followedNames,
    isFollowing,
    toggleFollow,
  };
};
