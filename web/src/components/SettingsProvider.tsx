import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
  type DeckListFormat,
  type HomePageId,
} from "../lib/settings";
import { ensureHxdecSets } from "../lib/hxdec";

type SettingsContextValue = {
  settings: AppSettings;
  /** True after settings have been read from localStorage (sync on first paint). */
  hydrated: boolean;
  setSettings: (patch: Partial<AppSettings>) => void;
  setDeckFormat: (format: DeckListFormat) => void;
  setDefaultHome: (home: HomePageId) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Load synchronously so default-home redirect works on the first paint.
  const [settings, setSettingsState] = useState<AppSettings>(() => loadSettings());
  const [hydrated] = useState(true);

  useEffect(() => {
    void ensureHxdecSets().catch(() => {
      /* HXDEC export can retry later */
    });
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setDeckFormat = useCallback((format: DeckListFormat) => {
    setSettingsState((prev) => ({ ...prev, deckFormat: format }));
  }, []);

  const setDefaultHome = useCallback((home: HomePageId) => {
    setSettingsState((prev) => ({ ...prev, defaultHome: home }));
  }, []);

  const value = useMemo(
    () => ({ settings, hydrated, setSettings, setDeckFormat, setDefaultHome }),
    [settings, hydrated, setSettings, setDeckFormat, setDefaultHome],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
