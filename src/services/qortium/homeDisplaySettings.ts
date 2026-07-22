// Video Center — Home display settings integration
// Canonical reference: Discussion-Boards/src/services/qortium/homeDisplaySettings.ts
// Reads Qortium Home theme settings (light/dark, accent color, text size)

import { requestQortium } from './qortiumClient';

export const HOME_ACCENTS = [
  'green',
  'blue',
  'orange',
  'purple',
  'red',
  'teal',
  'cyan',
  'pink',
  'yellow',
] as const;

export const HOME_TEXT_SIZES = [
  'extra-small',
  'small',
  'medium',
  'large',
  'extra-large',
  'huge',
] as const;

export type HomeAccent = (typeof HOME_ACCENTS)[number];
export type HomeTextSize = (typeof HOME_TEXT_SIZES)[number];
export type HomeTheme = 'light' | 'dark';
export type HomeDisplaySettingsSource = 'default' | 'home-url' | 'home-bridge';
export type HomeDisplaySettingsAvailability = 'available' | 'partial' | 'unavailable' | 'malformed';

export type HomeDisplaySettings = {
  theme: HomeTheme;
  accent: HomeAccent;
  textScale: HomeTextSize;
  language: string;
  source: HomeDisplaySettingsSource;
  availability: HomeDisplaySettingsAvailability;
};

export const DEFAULT_HOME_DISPLAY_SETTINGS: HomeDisplaySettings = {
  theme: 'light',
  accent: 'green',
  textScale: 'medium',
  language: 'en',
  source: 'default',
  availability: 'unavailable',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T);

const resolveTheme = (value: unknown, prefersDark: boolean): HomeTheme | null => {
  if (value === 'system') return prefersDark ? 'dark' : 'light';
  return value === 'light' || value === 'dark' ? value : null;
};

export const getHomeDisplayEnvironment = () => ({
  prefersDark:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
});

export const normalizeHomeDisplaySettings = (
  value: unknown,
  fallback: HomeDisplaySettings = DEFAULT_HOME_DISPLAY_SETTINGS,
  source: HomeDisplaySettingsSource = 'home-bridge',
): HomeDisplaySettings => {
  if (!isRecord(value)) {
    return {
      ...fallback,
      source,
      availability: value === undefined || value === null ? 'unavailable' : 'malformed',
    };
  }

  const env = getHomeDisplayEnvironment();
  const themeValue = value.theme ?? value.displayTheme;
  const accentValue = value.accent ?? value.displayAccent;
  const textScaleValue = value.textSize ?? value.textScale;

  const theme = resolveTheme(themeValue, env.prefersDark) ?? fallback.theme;
  const accent = includes(HOME_ACCENTS, accentValue) ? accentValue : fallback.accent;
  const textScale = includes(HOME_TEXT_SIZES, textScaleValue) ? textScaleValue : fallback.textScale;

  return {
    theme,
    accent,
    textScale,
    language: fallback.language,
    source,
    availability: 'available',
  };
};

export const readHomeDisplaySettingsFromUrl = (search: string): HomeDisplaySettings => {
  try {
    const params = new URLSearchParams(search);
    const raw: Record<string, string> = {};
    for (const key of ['theme', 'accent', 'textSize']) {
      const val = params.get(key);
      if (val) raw[key] = val;
    }
    if (Object.keys(raw).length === 0) return DEFAULT_HOME_DISPLAY_SETTINGS;
    return normalizeHomeDisplaySettings(raw, DEFAULT_HOME_DISPLAY_SETTINGS, 'home-url');
  } catch {
    return DEFAULT_HOME_DISPLAY_SETTINGS;
  }
};

export const loadHomeDisplaySettings = async (
  current: HomeDisplaySettings,
): Promise<HomeDisplaySettings> => {
  try {
    const raw = await requestQortium<unknown>({ action: 'GET_HOME_SETTINGS' });
    return normalizeHomeDisplaySettings(raw, current);
  } catch {
    return { ...current, availability: 'unavailable' };
  }
};

/** Apply settings to <html> element attributes for CSS-driven theming */
export const applyHomeDisplaySettings = (settings: HomeDisplaySettings, root: HTMLElement) => {
  root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-accent', settings.accent);
  const sizeMap: Record<HomeTextSize, string> = {
    'extra-small': 'xs',
    small: 'sm',
    medium: 'md',
    large: 'lg',
    'extra-large': 'xl',
    huge: '2xl',
  };
  root.setAttribute('data-text-size', sizeMap[settings.textScale] ?? 'md');

  if (settings.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};
