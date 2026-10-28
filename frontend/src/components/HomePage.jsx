import ThemeButton from "./ThemeButton";

const Icon = ({ d }) => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);

const ICONS = {
  tester: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.28 5.22a.75.75 0 0 0-1.06 0L7 8.44 5.78 7.22a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0 0-1.06Z",
  analyze: "M1.5 14.25a.75.75 0 0 1 0-1.5H2V8h2.5v4.75h1.5V3.5h2.5v9.25H10V6h2.5v6.75H14a.75.75 0 0 1 0 1.5H1.5Z",
  create: "M7.25 1.75a.75.75 0 0 1 1.5 0V7.25h5.5a.75.75 0 0 1 0 1.5H8.75v5.5a.75.75 0 0 1-1.5 0V8.75H1.75a.75.75 0 0 1 0-1.5h5.5V1.75Z",
  clean: "M2.5 1h11a.5.5 0 0 1 .4.8L9.5 7.7v5.55a.5.5 0 0 1-.8.4l-2-1.5a.5.5 0 0 1-.2-.4V7.7L2.1 1.8A.5.5 0 0 1 2.5 1Z",
  library: "M0 1.75A.75.75 0 0 1 .75 1h4.25a3.25 3.25 0 0 1 3 1.99A3.25 3.25 0 0 1 11 1h4.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H10.5a1.75 1.75 0 0 0-1.75 1.75.75.75 0 0 1-1.5 0A1.75 1.75 0 0 0 5.5 13H.75a.75.75 0 0 1-.75-.75V1.75Z",
  compiler: "M4.7 3.2a.75.75 0 0 1 0 1.06L1.96 7l2.74 2.74a.75.75 0 1 1-1.06 1.06l-3.27-3.27a.75.75 0 0 1 0-1.06L3.64 3.2a.75.75 0 0 1 1.06 0Zm6.6 0a.75.75 0 0 1 1.06 0l3.27 3.27a.75.75 0 0 1 0 1.06l-3.27 3.27a.75.75 0 1 1-1.06-1.06L14.04 7 11.3 4.26a.75.75 0 0 1 0-1.06Z",
};

const TOOLS = [
  { route: "/compare", title: "Model tester", desc: "Train and compare models side by side on the same dataset.", icon: ICONS.tester },
  { route: "/analyze", title: "Analyse data", desc: "Profile columns, spot outliers and explore distributions.", icon: ICONS.analyze },
  { route: "/createdata", title: "Create dataset", desc: "Generate synthetic datasets for quick experiments.", icon: ICONS.create },
  { route: "/cleandata", title: "Cleanse data", desc: "Handle missing values, duplicates and bad types.", icon: ICONS.clean },
];

const QUICK = [
  { route: "/textcode", title: "Library", desc: "Browse written code for your practice.", icon: ICONS.library },
  { route: "/compiler", title: "Compiler", desc: "Write, compile and run code in a notebook.", icon: ICONS.compiler },
];

export default function HomePage({ onNavigate, theme = "forest", onSelectTheme }) {
  const navigate = (route) => {
    if (typeof onNavigate === "function") onNavigate(route);
    else {
      console.warn("[HomePage] onNavigate prop missing or not a function — falling back to window.location");
      window.location.href = route;
    }
  };

  return (
    <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none font-sans scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="t-accent text-lg font-semibold tracking-tight text-white">MLForge</h1>
            <span className="hidden rounded-full border border-[#30363d] px-2 py-0.5 text-[11px] text-[#8b949e] sm:inline">Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeButton theme={theme} onSelect={onSelectTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <section className="border-b border-[#30363d] pb-10">
          <div className="t-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="t-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full"></span>
            Multi-model ML workshop
          </div>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Machine learning, all organized in one place.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#8b949e]">
            Test models, analyse and clean data, and run code, all without digging through menus.
          </p>
        </section>

        {/* Tools + quick actions */}
        <section className="grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-black">Tools</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {TOOLS.map((t) => (
                <button
                  key={t.route}
                  type="button"
                  onClick={() => navigate(t.route)}
                  className="group rounded-md border border-[#30363d] bg-[#161b22] p-4 text-left transition hover:border-[#8b949e] hover:bg-[#1c2128]"
                >
                  <div className="flex items-center gap-2">
                    <span className="t-accent"><Icon d={t.icon} /></span>
                    <span className="text-sm font-semibold text-[#e6edf3] group-hover:underline">{t.title}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#8b949e]">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-md border border-[#30363d] bg-[#161b22]">
            <div className="border-b border-[#30363d] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#e6edf3]">Quick actions</h3>
            </div>
            <ul className="divide-y divide-[#30363d]">
              {QUICK.map((q) => (
                <li key={q.route}>
                  <button
                    type="button"
                    onClick={() => navigate(q.route)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#1c2128]"
                  >
                    <span className="t-accent mt-0.5"><Icon d={q.icon} /></span>
                    <span>
                      <span className="block text-sm font-semibold text-[#e6edf3]">{q.title}</span>
                      <span className="mt-0.5 block text-xs text-[#8b949e]">{q.desc}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </main>

      <footer className="border-t border-[#30363d] py-6 text-center text-xs text-[#8b949e]">
        MLForge · Test, analyze and experiment on datasets and models
      </footer>
    </div>
  );
}