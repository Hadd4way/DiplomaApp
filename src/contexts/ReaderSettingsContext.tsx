import * as React from 'react';
import type { ReaderSettings, ReaderSettingsPatch } from '../../shared/ipc';
import { READER_SETTINGS_DEFAULTS } from '../../shared/ipc';
import { getAppThemeCssVariables } from '@/lib/reader-theme';

type ReaderSettingsContextValue = {
  settings: ReaderSettings;
  loading: boolean;
  error: string | null;
  updateSettings: (patch: ReaderSettingsPatch) => void;
};

const ReaderSettingsContext = React.createContext<ReaderSettingsContextValue | null>(null);

const SETTINGS_WRITE_DEBOUNCE_MS = 300;
const DESKTOP_FALLBACK_TOKEN = '';

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<ReaderSettings>(READER_SETTINGS_DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pendingPatchRef = React.useRef<ReaderSettingsPatch>({});
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLocalChangesRef = React.useRef(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const variables = getAppThemeCssVariables(settings.theme);
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
    document.body.style.backgroundColor = settings.theme === 'dark' ? '#111827' : settings.theme === 'sepia' ? '#f2eadf' : '#f3f5f7';
    document.body.style.color = settings.theme === 'dark' ? '#e5edf7' : settings.theme === 'sepia' ? '#4b3725' : '#1e293b';
  }, [settings.theme]);

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      if (!window.api?.readerSettings) {
        if (!canceled) {
          setError('Reader settings API is unavailable. Restart the app to reload Electron preload.');
          setLoading(false);
        }
        return;
      }

      try {
        setError(null);
        const result = await window.api.readerSettings.get({ token: DESKTOP_FALLBACK_TOKEN });
        if (canceled) {
          return;
        }
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (hasLocalChangesRef.current) {
          return;
        }
        setSettings(result.settings);
      } catch (loadError) {
        if (!canceled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load reader settings.');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      canceled = true;
    };
  }, []);

  const flushPendingPatch = React.useCallback(async () => {
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(patch).length === 0) {
      return;
    }
    if (!window.api?.readerSettings) {
      setError('Reader settings API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    try {
      const result = await window.api.readerSettings.update({
        token: DESKTOP_FALLBACK_TOKEN,
        patch
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSettings(result.settings);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save reader settings.');
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushPendingPatch();
    };
  }, [flushPendingPatch]);

  const updateSettings = React.useCallback((patch: ReaderSettingsPatch) => {
    hasLocalChangesRef.current = true;
    setSettings((current) => ({
      theme: patch.theme ?? current.theme,
      epubFontSize: patch.epubFontSize ?? current.epubFontSize,
      epubLineHeight: patch.epubLineHeight ?? current.epubLineHeight
    }));
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setError(null);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushPendingPatch();
    }, SETTINGS_WRITE_DEBOUNCE_MS);
  }, [flushPendingPatch]);

  const value = React.useMemo<ReaderSettingsContextValue>(
    () => ({
      settings,
      loading,
      error,
      updateSettings
    }),
    [error, loading, settings, updateSettings]
  );

  return <ReaderSettingsContext.Provider value={value}>{children}</ReaderSettingsContext.Provider>;
}

export function useReaderSettings(): ReaderSettingsContextValue {
  const context = React.useContext(ReaderSettingsContext);
  if (!context) {
    throw new Error('useReaderSettings must be used within ReaderSettingsProvider.');
  }
  return context;
}
