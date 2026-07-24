import { COLOR_OPTIONS, PLAYSTYLE_OPTIONS } from "../lib/scryfall";

export type FilterState = {
  colors: string[];
  colorMode: "exact" | "include" | "atMost";
  playstyle: string;
  set: string;
  partners: boolean;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  showPartners?: boolean;
};

export function CommanderFilters({ value, onChange, showPartners = true }: Props) {
  function toggleColor(id: string) {
    const has = value.colors.includes(id);
    onChange({
      ...value,
      colors: has ? value.colors.filter((c) => c !== id) : [...value.colors, id],
    });
  }

  return (
    <div className="panel">
      <div className="field-grid">
        <div className="field">
          <label>Colors</label>
          <div className="check-row">
            {COLOR_OPTIONS.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={value.colors.includes(c.id)}
                  onChange={() => toggleColor(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="colorMode">Color mode</label>
          <select
            id="colorMode"
            value={value.colorMode}
            onChange={(e) =>
              onChange({ ...value, colorMode: e.target.value as FilterState["colorMode"] })
            }
          >
            <option value="include">Include at least these</option>
            <option value="exact">Exact identity</option>
            <option value="atMost">At most these</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="playstyle">Playstyle</label>
          <select
            id="playstyle"
            value={value.playstyle}
            onChange={(e) => onChange({ ...value, playstyle: e.target.value })}
          >
            {PLAYSTYLE_OPTIONS.map((p) => (
              <option key={p.id || "any"} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="set">Set code (optional)</label>
          <input
            id="set"
            placeholder="e.g. lci, mh3"
            value={value.set}
            onChange={(e) => onChange({ ...value, set: e.target.value })}
          />
        </div>
      </div>
      {showPartners && (
        <div className="check-row" style={{ marginTop: "0.85rem" }}>
          <label className="check">
            <input
              type="checkbox"
              checked={value.partners}
              onChange={(e) => onChange({ ...value, partners: e.target.checked })}
            />
            Allow / prefer partner-style commanders
          </label>
        </div>
      )}
    </div>
  );
}

export const DEFAULT_FILTERS: FilterState = {
  colors: [],
  colorMode: "include",
  playstyle: "",
  set: "",
  partners: false,
};
