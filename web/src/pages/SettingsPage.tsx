import { Seo } from "../components/Seo";
import { useSettings } from "../components/SettingsProvider";
import {
  DECK_FORMAT_META,
  HOME_PAGE_OPTIONS,
  type DeckListFormat,
  type HomePageId,
} from "../lib/settings";

export function SettingsPage() {
  const { settings, setSettings } = useSettings();

  return (
    <div className="tool-page container settings-page">
      <Seo
        title="Settings"
        description="Choose deck export format, toasts, Ko-fi prompts, and your default home page."
        path="/settings"
      />
      <header className="tool-header">
        <h1>Settings</h1>
        <p>Saved in this browser only. Changes apply immediately across MagicGen tools.</p>
      </header>

      <section className="panel settings-panel" id="deck-format">
        <h2>Export / generation format</h2>
        <p className="muted">
          Used when copying or showing generated decks. Paste import still accepts Moxfield,
          Archidekt, HXDEC, Arena-style, and plain lists.
        </p>
        <div className="settings-options">
          {(Object.keys(DECK_FORMAT_META) as DeckListFormat[]).map((id) => {
            const meta = DECK_FORMAT_META[id];
            return (
              <label key={id} className="check settings-option">
                <input
                  type="radio"
                  name="deck-format"
                  checked={settings.deckFormat === id}
                  onChange={() => setSettings({ deckFormat: id })}
                />
                <span>
                  <strong>{meta.label}</strong>
                  {id === "moxfield" ? " (default)" : ""}
                  <span className="muted settings-option__blurb">{meta.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>Notifications</h2>
        <div className="settings-options">
          <label className="check settings-option">
            <input
              type="checkbox"
              checked={settings.toastsEnabled}
              onChange={(e) => setSettings({ toastsEnabled: e.target.checked })}
            />
            <span>Enable toasts</span>
          </label>
          <label className="check settings-option">
            <input
              type="checkbox"
              checked={settings.kofiEnabled}
              onChange={(e) => setSettings({ kofiEnabled: e.target.checked })}
            />
            <span>Enable Ko-fi support prompts</span>
          </label>
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>Default home page</h2>
        <p className="muted">Where you land when opening MagicGen or visiting the site root.</p>
        <div className="field">
          <label htmlFor="default-home">Start on</label>
          <select
            id="default-home"
            value={settings.defaultHome}
            onChange={(e) => setSettings({ defaultHome: e.target.value as HomePageId })}
          >
            {HOME_PAGE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
