import {
  normalizeSettings,
  STORAGE_KEY,
  ThemeMode,
  ThemeSettings,
} from '@/entrypoints/shared/theme';

type ThemeScheme = 'light' | 'dark';

const STYLE_ID = 'centurio-theme-style';
const INVERT_ATTR = 'data-centurio-invert';
const SCHEME_ATTR = 'data-centurio-scheme';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let baselineIsDark: boolean | null = null;

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const start = () => {
      if (baselineIsDark === null) {
        baselineIsDark = computePageIsDark();
      }
      applyFromStorage();
      browser.storage.onChanged.addListener(onStorageChanged);
      prefersDark.addEventListener('change', onSystemSchemeChange);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  },
});

const onStorageChanged = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) {
    return;
  }

  const nextSettings = normalizeSettings(changes[STORAGE_KEY].newValue);
  applyThemeFromSettings(nextSettings);
};

const onSystemSchemeChange = () => {
  applyFromStorage();
};

const applyFromStorage = async () => {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const settings = normalizeSettings(stored[STORAGE_KEY]);
  applyThemeFromSettings(settings);
};

const applyThemeFromSettings = (settings: ThemeSettings) => {
  const hostname = location.hostname || location.host;
  if (!hostname) {
    clearTheme();
    return;
  }

  const siteMode = settings.siteOverrides[hostname];
  if (!siteMode) {
    clearTheme();
    return;
  }

  const targetScheme = resolveScheme(siteMode);
  const pageIsDark = baselineIsDark ?? computePageIsDark();
  const invert = shouldInvert(targetScheme, pageIsDark);

  applyTheme(targetScheme, invert);
};

const resolveScheme = (mode: ThemeMode): ThemeScheme =>
  mode === 'system' ? (prefersDark.matches ? 'dark' : 'light') : mode;

const shouldInvert = (scheme: ThemeScheme, pageIsDark: boolean) =>
  scheme === 'dark' ? !pageIsDark : pageIsDark;

const applyTheme = (scheme: ThemeScheme, invert: boolean) => {
  const root = document.documentElement;
  ensureStyleElement();

  root.setAttribute(SCHEME_ATTR, scheme);
  root.setAttribute(INVERT_ATTR, invert ? 'true' : 'false');
};

const clearTheme = () => {
  const root = document.documentElement;
  root.removeAttribute(SCHEME_ATTR);
  root.removeAttribute(INVERT_ATTR);

  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
};

const ensureStyleElement = () => {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html[${SCHEME_ATTR}="dark"] { color-scheme: dark; }
html[${SCHEME_ATTR}="light"] { color-scheme: light; }
html[${INVERT_ATTR}="true"] {
  filter: invert(1) hue-rotate(180deg);
  background-color: #0f1116;
}
html[${INVERT_ATTR}="true"] img,
html[${INVERT_ATTR}="true"] video,
html[${INVERT_ATTR}="true"] iframe,
html[${INVERT_ATTR}="true"] picture,
html[${INVERT_ATTR}="true"] svg,
html[${INVERT_ATTR}="true"] canvas {
  filter: invert(1) hue-rotate(180deg);
}
`;

  (document.head || document.documentElement).appendChild(style);
};

type Rgb = { r: number; g: number; b: number; a: number };

const computePageIsDark = (): boolean => {
  const background = getReadableBackground() ?? { r: 255, g: 255, b: 255, a: 1 };
  return relativeLuminance(background) < 0.5;
};

const getReadableBackground = (): Rgb | null => {
  const bodyColor = document.body
    ? parseColor(getComputedStyle(document.body).backgroundColor)
    : null;
  if (bodyColor && bodyColor.a > 0.05) {
    return bodyColor;
  }

  const rootColor = parseColor(
    getComputedStyle(document.documentElement).backgroundColor,
  );
  if (rootColor && rootColor.a > 0.05) {
    return rootColor;
  }

  return null;
};

const parseColor = (value: string): Rgb | null => {
  const match = value
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/i);

  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
};

const relativeLuminance = ({ r, g, b }: Rgb) => {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};
