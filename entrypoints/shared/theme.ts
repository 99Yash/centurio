export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeSettings = {
  defaultMode: ThemeMode;
  siteOverrides: Record<string, ThemeMode>;
};

export const STORAGE_KEY = 'centurio:theme-settings';

export const defaultSettings: ThemeSettings = {
  defaultMode: 'system',
  siteOverrides: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

export const normalizeSettings = (value: unknown): ThemeSettings => {
  if (!isRecord(value)) {
    return defaultSettings;
  }

  const defaultMode = isThemeMode(value.defaultMode)
    ? value.defaultMode
    : defaultSettings.defaultMode;
  const siteOverrides: Record<string, ThemeMode> = {};

  if (isRecord(value.siteOverrides)) {
    for (const [hostname, mode] of Object.entries(value.siteOverrides)) {
      if (isThemeMode(mode)) {
        siteOverrides[hostname] = mode;
      }
    }
  }

  return { defaultMode, siteOverrides };
};
