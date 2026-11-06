import ThemeButton from "./ThemeButton";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]";

const Icon = ({ d, size = 18, className = "" }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}><path d={d} /></svg>
);

const ICONS = {
  tester: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.28 5.22a.75.75 0 0 0-1.06 0L7 8.44 5.78 7.22a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0 0-1.06Z",
  analyze: "M1.5 14.25a.75.75 0 0 1 0-1.5H2V8h2.5v4.75h1.5V3.5h2.5v9.25H10V6h2.5v6.75H14a.75.75 0 0 1 0 1.5H1.5Z",
  create: "M7.25 1.75a.75.75 0 0 1 1.5 0V7.25h5.5a.75.75 0 0 1 0 1.5H8.75v5.5a.75.75 0 0 1-1.5 0V8.75H1.75a.75.75 0 0 1 0-1.5h5.5V1.75Z",
  clean: "M2.5 1h11a.5.5 0 0 1 .4.8L9.5 7.7v5.55a.5.5 0 0 1-.8.4l-2-1.5a.5.5 0 0 1-.2-.4V7.7L2.1 1.8A.5.5 0 0 1 2.5 1Z",
  library: "M0 1.75A.75.75 0 0 1 .75 1h4.25a3.25 3.25 0 0 1 3 1.99A3.25 3.25 0 0 1 11 1h4.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H10.5a1.75 1.75 0 0 0-1.75 1.75.75.75 0 0 1-1.5 0A1.75 1.75 0 0 0 5.5 13H.75a.75.75 0 0 1-.75-.75V1.75Z",
  compiler: "M4.7 3.2a.75.75 0 0 1 0 1.06L1.96 7l2.74 2.74a.75.75 0 1 1-1.06 1.06l-3.27-3.27a.75.75 0 0 1 0-1.06L3.64 3.2a.75.75 0 0 1 1.06 0Zm6.6 0a.75.75 0 0 1 1.06 0l3.27 3.27a.75.75 0 0 1 0 1.06l-3.27 3.27a.75.75 0 1 1-1.06-1.06L14.04 7 11.3 4.26a.75.75 0 0 1 0-1.06Z",
  chevron: "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z",
};

// Ordered the way a project usually runs: make data, fix it, understand it, model it.
const WORKFLOW = [
  { route: "/createdata", title: "Create dataset", desc: "Generate synthetic datasets for quick experiments.", icon: ICONS.create },
  { route: "/cleandata", title: "Cleanse data", desc: "Handle missing values, duplicates and bad types.", icon: ICONS.clean },
  { route: "/analyze", title: "Analyse data", desc: "Profile columns, spot outliers and explore distributions.", icon: ICONS.analyze },
  { route: "/compare", title: "Model tester", desc: "Train and compare models side by side on the same dataset.", icon: ICONS.tester },
  { route: "/playground", title: "Test Predictions", desc: "Build and deploy machine learning models.", icon: ICONS.compiler },
];

const CODE_TOOLS = [
  { route: "/compiler", title: "Compiler", desc: "Write, compile and run code in a notebook.", icon: ICONS.compiler },
  { route: "/textcode", title: "Library", desc: "Browse your written code for practice.", icon: ICONS.library },
];

// Real links (open in new tab, right-click, copy address) that still route through onNavigate.
function NavLink({ route, onGo, className, children }) {
  return (
    <a
      href={route}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onGo(route);
      }}
    >
      {children}
    </a>
  );
}

const gridBg = {
  backgroundImage:
    "linear-gradient(to right, rgba(139,148,158,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,148,158,0.10) 1px, transparent 1px)",
  backgroundSize: "36px 36px",
  WebkitMaskImage: "linear-gradient(to bottom, black 20%, transparent 95%)",
  maskImage: "linear-gradient(to bottom, black 20%, transparent 95%)",
};

export default function HomePage({ onNavigate, theme = "black", onSelectTheme }) {
  const navigate = (route) => {
    if (typeof onNavigate === "function") onNavigate(route);
    else {
      console.warn("[HomePage] onNavigate prop missing or not a function — falling back to window.location");
      window.location.href = route;
    }
  };

  const card = `group flex h-full flex-col rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-left transition hover:border-[#8b949e]/70 hover:bg-[#1c2128] ${focusRing}`;

  return (
    <div className="t-page page-no-overscroll flex min-h-screen flex-col overflow-x-clip overscroll-none font-sans scrollbar-thin scrollbar-thumb-[#58a6ff] scroll-smooth">
      <a href="#main" className={`sr-only z-20 rounded-md bg-[#161b22] px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 ${focusRing}`}>
        Skip to content
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="t-accent flex h-8 w-8 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117]">
              <Icon d={ICONS.analyze} size={16} />
            </span>
            <span className="t-accent text-lg font-semibold tracking-tight text-white">MLForge</span>
            <span className="hidden rounded-full border border-[#30363d] px-2 py-0.5 text-[11px] text-[#8b949e] sm:inline">Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeButton onNavigate={onNavigate} />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative border-b border-[#30363d]">
          <div className="pointer-events-none absolute inset-0" style={gridBg} aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 md:pb-16 md:pt-20">
            <div className="t-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
              <span className="t-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
              AI-assisted ML workshop
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-[#e6edf3] md:text-6xl">
              Machine learning, all organized in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#8b949e] md:text-lg md:leading-8">
              Test models, analyse and clean data, and run code, all without digging through menus.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <NavLink
                route="/createdata"
                onGo={navigate}
                className={`inline-flex items-center gap-2 rounded-lg bg-[#238636] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2ea043] ${focusRing}`}
              >
                Create a dataset
              </NavLink>
              <NavLink
                route="/compiler"
                onGo={navigate}
                className={`inline-flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-2.5 text-sm font-semibold text-[#e6edf3] transition hover:bg-[#1c2128] ${focusRing}`}
              >
                <Icon d={ICONS.compiler} size={16} className="text-[#8b949e]" />
                Open compiler
              </NavLink>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="workflow-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h2 id="workflow-heading" className="text-lg font-semibold text-[#e6edf3]">Data workflow</h2>
            <p className="text-sm text-[#8b949e]">Work through the steps in order, or jump straight to any one.</p>
          </div>
          <ol className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW.map((t, i) => (
              <li key={t.route} className="flex flex-col gap-3">
                <div className="hidden items-center gap-3 lg:flex" aria-hidden="true">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#30363d] bg-[#161b22] text-xs font-medium text-[#8b949e]">{i + 1}</span>
                  {i < WORKFLOW.length - 1 && <span className="-mr-4 h-px flex-1 bg-[#30363d]" />}
                </div>
                <NavLink route={t.route} onGo={navigate} className={`${card} flex-1`}>
                  <div className="flex items-center gap-3">
                    <span className="t-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117]">
                      <Icon d={t.icon} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-[#e6edf3]">
                      <span className="mr-2 text-xs font-medium text-[#6e7681] lg:hidden">{i + 1}.</span>
                      {t.title}
                    </span>
                    <Icon d={ICONS.chevron} size={14} className="shrink-0 text-[#6e7681] transition group-hover:text-[#e6edf3] motion-safe:group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#8b949e]">{t.desc}</p>
                </NavLink>
              </li>
            ))}
          </ol>
        </section>

        {/* Code tools */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12" aria-labelledby="code-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h2 id="code-heading" className="text-lg font-semibold text-[#e6edf3]">Code</h2>
            <p className="text-sm text-[#8b949e]">Run experiments and keep the code you rely on.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {CODE_TOOLS.map((q) => (
              <li key={q.route}>
                <NavLink route={q.route} onGo={navigate} className={card}>
                  <div className="flex items-center gap-3">
                    <span className="t-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117]">
                      <Icon d={q.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#e6edf3]">{q.title}</span>
                      <span className="mt-0.5 block text-sm leading-6 text-[#8b949e]">{q.desc}</span>
                    </span>
                    <Icon d={ICONS.chevron} size={14} className="shrink-0 text-[#6e7681] transition group-hover:text-[#e6edf3] motion-safe:group-hover:translate-x-0.5" />
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-[#30363d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-[#8b949e] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-[#c9d1d9]">MLForge</span>
          <span>Test, analyse and experiment on datasets and models.</span>
        </div>
      </footer>
    </div>
  );
}