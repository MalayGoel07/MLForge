
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
  return Number.isFinite(value) && value >= FONT_MIN && value <= FONT_MAX
    ? value
    : 1;
};

// AI theme styling
const optionClass = (active) =>
  `rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
    active
      ? "border-[#388bfd] bg-[#1f6feb]/15 text-[#58a6ff]"
      : "border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:border-[#388bfd]/70 hover:bg-[#21262d]"
  }`;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70";

export default function Setting({ isOpen, onClose, theme, onSelectTheme }) {
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
    onClose();
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account and all stored files? This cannot be undone."
      )
    )
      return;

    try {
      await api.delete("/me");
      clearToken();
      onClose();
    } catch (error) {
      window.alert(
        error.message || "Unable to delete your account. Please try again."
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Settings panel */}
      <aside
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className={`fixed inset-y-0 left-0 z-50 flex w-full flex-col
          border-r border-[#30363d] bg-[#0d1117] font-sans
          text-[#c9d1d9] shadow-2xl shadow-black/60
          transition-[transform,visibility] duration-200
          motion-reduce:transition-none md:w-[min(460px,45vw)]
          ${isOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1f6feb]/30 bg-[#1f6feb]/15 text-[#58a6ff]">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#e6edf3]">
                Settings
              </h1>
              <p className="text-[11px] text-[#8b949e]">
                Personalize your workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 text-[#8b949e] transition hover:bg-[#21262d] hover:text-white ${focusRing}`}
            aria-label="Close settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">

          {/* Theme */}
          <section className="border-b border-[#30363d] py-4">
            <h2 className="mb-3 text-sm font-semibold text-[#e6edf3]">
              Appearance
            </h2>

            <p className="mb-3 text-xs text-[#8b949e]">
              Choose your preferred workspace theme.
            </p>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Theme">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === item.id}
                  onClick={() => chooseTheme(item.id)}
                  className={`${optionClass(theme === item.id)} flex flex-col items-center gap-2 ${focusRing}`}
                >
                  <span className="flex h-9 w-full overflow-hidden rounded-lg border border-[#30363d]">
                    <span
                      className="flex-1"
                      style={{ backgroundColor: item.dot }}
                    />
                    <span className="flex-1 bg-[#161b22]" />
                    <span className="flex-1 bg-[#388bfd]" />
                  </span>

                  <span className="flex items-center gap-1.5">
                    {theme === item.id && (
                      <span className="text-[#58a6ff]">✓</span>
                    )}
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Font size */}
          <section className="border-b border-[#30363d] py-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e6edf3]">
                Font size
              </h2>

              <span className="rounded-md bg-[#1f6feb]/15 px-2 py-1 font-mono text-xs text-[#58a6ff]">
                {Math.round(scale * 100)}%
              </span>
            </div>

            <input
              type="range"
              min={FONT_MIN}
              max={FONT_MAX}
              step={0.05}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              aria-label="Font size"
              className="w-full cursor-pointer accent-[#388bfd]"
            />

            <div className="mt-3 grid grid-cols-4 gap-2">
              {FONT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setScale(preset.value)}
                  className={`${optionClass(Math.abs(scale - preset.value) < 0.01)} ${focusRing}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
              <p className="mb-2 text-xs font-semibold text-[#58a6ff]">
                Preview
              </p>

              <p
                className="leading-7 text-[#e6edf3]"
                style={{ fontSize: `${14 * scale}px` }}
              >
                The quick brown fox jumps over the lazy dog.
              </p>

              <p className="mt-1 text-[11px] text-[#8b949e]">
                Your font preference is saved automatically.
              </p>
            </div>
          </section>

          {/* Reset */}
          <div className="space-y-3 py-5">
            <button
              type="button"
              onClick={reset}
              className={`h-11 w-full rounded-xl border border-[#30363d] bg-[#161b22] text-sm font-medium text-[#c9d1d9] transition hover:border-[#388bfd] hover:bg-[#21262d] ${focusRing}`}
            >
              ↺ Reset to defaults
            </button>
          </div>

          {/* Account */}
          <section className="space-y-3 border-t border-[#30363d] pt-5">
            <h2 className="mb-3 text-sm font-semibold text-[#e6edf3]">
              Account
            </h2>

            <button
              type="button"
              onClick={logout}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#30363d] bg-[#161b22] text-sm font-medium text-[#c9d1d9] transition hover:border-[#388bfd] hover:bg-[#21262d] ${focusRing}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
              Log out
            </button>

            {/* Delete account */}
            <div className="rounded-xl border border-[#f85149]/30 bg-[#161b22] p-4">
              <h3 className="text-sm font-semibold text-[#ff7b72]">
                Danger zone
              </h3>

              <p className="mt-1 text-xs leading-5 text-[#8b949e]">
                Permanently delete your account and all associated files.
                This action cannot be undone.
              </p>

              <button
                type="button"
                onClick={deleteAccount}
                className={`mt-3 rounded-lg border border-[#f85149]/50 px-4 py-2 text-xs font-semibold text-[#ff7b72] transition hover:bg-[#f85149]/15 ${focusRing}`}
              >
                Delete account
              </button>
            </div>
          </section>
        </div>

        <span className="sr-only">
          Current theme: {activeTheme.label}
        </span>
      </aside>
    </>
  );
}
