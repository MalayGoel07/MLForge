import { useEffect, useState } from "react";
import api from "../api/api";
import { clearToken } from "../api/auth";
import { THEMES, getTheme } from "./ThemeButton";

const FONT_MIN = 0.9;
const FONT_MAX = 1.15;
const FONT_PRESETS = [
  { label: "Small", value: 0.9 },
  { label: "Default", value: 1 },
  { label: "Large", value: 1.05 },
  { label: "XL", value: 1.15 },
];
const FONT_SCALE_KEY = "mlforge-font-scale";

const getStoredFontScale = () => {
  const value = Number(localStorage.getItem(FONT_SCALE_KEY));
  return Number.isFinite(value) && value >= FONT_MIN && value <= FONT_MAX ? value : 1;
};

const optionClass = (active) =>
  `rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
    active
      ? "border-gray-400 bg-gray-400/10 text-gray-100"
      : "border-gray-700 bg-black text-gray-300 hover:border-gray-400"
  }`;

export default function Setting({ onNavigate, theme, onSelectTheme }) {
  const [scale, setScale] = useState(getStoredFontScale);
  const activeTheme = getTheme(theme);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", scale);
    localStorage.setItem(FONT_SCALE_KEY, String(scale));
  }, [scale]);

  const chooseTheme = (id) => onSelectTheme(id);
  const reset = () => {
    chooseTheme("black");
    setScale(1);
  };
  const logout = () => {
    clearToken();
    onNavigate("/");
  };
  const deleteAccount = async () => {
    if (!window.confirm("Delete your account and all stored files? This cannot be undone.")) return;
    try {
      await api.delete("/me");
      clearToken();
      onNavigate("/");
    } catch (error) {
      window.alert(error.message || "Unable to delete your account. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-page px-4 py-8 text-fg">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-card p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-acc">Settings</h1>
          <button type="button" onClick={() => onNavigate("/home")} className="text-sm text-acc-soft hover:text-acc">
            Close
          </button>
        </div>

        <section className="border-b border-line py-4" aria-labelledby="theme-heading">
          <h2 id="theme-heading" className="mb-3 text-sm font-medium text-fg">Theme</h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="theme-heading">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={theme === item.id}
                onClick={() => chooseTheme(item.id)}
                className={`${optionClass(theme === item.id)} flex flex-col items-center gap-2`}
              >
                <span className="flex h-8 w-full overflow-hidden rounded-lg border border-line">
                  <span className="flex-1" style={{ backgroundColor: item.dot }} />
                  <span className="flex-1 bg-card" />
                  <span className="flex-1 bg-acc" />
                </span>
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-acc-soft">Choose a neutral light or dark appearance.</p>
        </section>

        <section className="border-b border-line py-4" aria-labelledby="font-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="font-heading" className="text-sm font-medium text-fg">Font size</h2>
            <span className="font-mono text-xs text-acc-soft">{Math.round(scale * 100)}%</span>
          </div>
          <input
            type="range"
            min={FONT_MIN}
            max={FONT_MAX}
            step={0.05}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            aria-label="Font size"
            className="w-full accent-gray-400"
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {FONT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setScale(preset.value)}
                className={optionClass(Math.abs(scale - preset.value) < 0.01)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-black px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-acc">Preview</p>
            <p className="text-sm leading-7 text-fg">The quick brown fox jumps over the lazy dog.</p>
          </div>
        </section>

        <div className="space-y-3 py-4">
          <button type="button" onClick={reset} className="h-11 w-full rounded-xl border border-line text-sm font-medium text-fg transition-colors hover:border-acc">
            Reset to defaults
          </button>
        </div>

        <section className="space-y-2 border-t border-line pt-4" aria-labelledby="account-heading">
          <h2 id="account-heading" className="mb-3 text-sm font-medium text-fg">Account</h2>
          <button type="button" onClick={logout} className="h-11 w-full rounded-xl border border-line text-sm font-medium text-fg transition-colors hover:border-acc">
            Log out
          </button>
          <button type="button" onClick={deleteAccount} className="h-11 w-full rounded-xl border border-red-500/60 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10">
            Delete account
          </button>
        </section>
      </div>
      <span className="sr-only">Current theme: {activeTheme.label}</span>
    </main>
  );
}
