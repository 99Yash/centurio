import { useEffect, useState } from 'react';
import './App.css';
import {
  defaultSettings,
  normalizeSettings,
  STORAGE_KEY,
  ThemeMode,
  ThemeSettings,
} from '@/entrypoints/shared/theme';

function App() {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      const stored = await browser.storage.local.get(STORAGE_KEY);
      if (!isMounted) {
        return;
      }
      setSettings(normalizeSettings(stored[STORAGE_KEY]));
      setIsReady(true);
    };

    const loadActiveHost = async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!isMounted) {
        return;
      }
      setActiveHost(getHostname(tab?.url));
    };

    loadSettings();
    loadActiveHost();

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      setSettings(normalizeSettings(changes[STORAGE_KEY].newValue));
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      isMounted = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const siteMode = activeHost ? settings.siteOverrides[activeHost] : undefined;
  const isSiteEnabled = Boolean(activeHost && siteMode);


  const updateSettings = async (next: ThemeSettings) => {
    setSettings(next);
    await browser.storage.local.set({ [STORAGE_KEY]: next });
  };

  const setMode = async (mode: ThemeMode) => {
    if (!activeHost) {
      await updateSettings({ ...settings, defaultMode: mode });
      return;
    }

    const nextOverrides = { ...settings.siteOverrides, [activeHost]: mode };
    await updateSettings({ ...settings, defaultMode: mode, siteOverrides: nextOverrides });
  };

  const setSiteOverride = async (enabled: boolean) => {
    if (!activeHost) {
      return;
    }

    const nextOverrides = { ...settings.siteOverrides };
    if (enabled) {
      const mode = siteMode ?? settings.defaultMode;
      nextOverrides[activeHost] = mode;
    } else {
      delete nextOverrides[activeHost];
    }

    await updateSettings({ ...settings, siteOverrides: nextOverrides });
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="title">Centurio</div>
          <div className="subtitle">Theme overrides for docs</div>
        </div>
        <span className="pill">{isSiteEnabled && siteMode ? MODE_LABELS[siteMode] : 'Off'}</span>
      </header>

      <section className="card">
        <div className="section-title">Theme</div>
        <div className="segmented" role="group" aria-label="Theme mode">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`segment${siteMode === mode ? ' active' : ''}`}
              aria-pressed={siteMode === mode}
              onClick={() => setMode(mode)}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <div className="section-hint">
          {activeHost
            ? isSiteEnabled
              ? `Applied to ${activeHost}`
              : 'Not active yet. Choose a mode to enable.'
            : 'Open a page to enable overrides.'}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Scope</div>
        <div className="scope-row">
          <div className="scope-meta">
            <div className="scope-label">Enable for site</div>
            <div className="scope-value">
              {activeHost ?? (isReady ? 'No active page' : 'Loading...')}
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isSiteEnabled}
              onChange={(event) => setSiteOverride(event.target.checked)}
              disabled={!activeHost}
            />
            <span className="slider" />
          </label>
        </div>
        <div className="section-hint">
          {activeHost
            ? isSiteEnabled
              ? 'Overrides only apply while enabled.'
              : 'Disabled by default. Turn this on or pick a mode.'
            : 'Open a page to enable overrides.'}
        </div>
      </section>

      <footer className="footer">
        Preferred mode: {MODE_LABELS[settings.defaultMode]}
      </footer>
    </div>
  );
}

export default App;

const getHostname = (url?: string): string | null => {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname;
    }
  } catch {
    return null;
  }

  return null;
};

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};
