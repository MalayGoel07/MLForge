import ThemeButton from "./ThemeButton";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]";

const models = [
  { role: "Linear Regression", model: "Regression" },
  { role: "Logistic Regression", model: "Classification" },
  { role: "Decision Tree", model: "Classification" },
  { role: "Random Forest", model: "Ensemble" },
];

const modelAccuracies = [
  { model: "Linear Regression", accuracy: 82.4 },
  { model: "Logistic Regression", accuracy: 88.1 },
  { model: "Decision Tree", accuracy: 85.7 },
  { model: "Random Forest", accuracy: 93.2 },
];
const bestAccuracy = Math.max(...modelAccuracies.map((m) => m.accuracy));

const placementRows = Array.from({ length: 100 }, (_, index) => {
  const serialNo = index + 1;
  const cgpa = (6 + ((serialNo * 37) % 40) / 10).toFixed(1);
  const iq = 90 + ((serialNo * 13) % 51);
  const placementPossibility = Math.min(98, Math.max(24, Math.round(Number(cgpa) * 8 + (iq - 90) * 0.7)));
  return { serialNo, cgpa, iq, placementPossibility };
});

const STEPS = [
  { title: "Enhanced Routing", desc: "Routes the input data, analyzes it, performs EDA and distributes it to all models.", icon: "route" },
  { title: "ML Models", desc: "Dedicated models for regression and classification run in parallel for the task at hand.", icon: "layers" },
  { title: "Ultima Output", desc: "Model results are synthesized into one table, with final accuracies.", icon: "table" },
];

const TYPE_STYLES = {
  Regression: "border-[#388bfd]/40 bg-[#1f6feb]/10 text-[#79c0ff]",
  Classification: "border-[#3fb950]/40 bg-[#238636]/10 text-[#56d364]",
  Ensemble: "border-[#d29922]/40 bg-[#9e6a03]/10 text-[#e3b341]",
};

const ICONS = {
  route: "M5 12h14M13 6l6 6-6 6",
  layers: "M4 6h16M4 12h16M4 18h16",
  table: "M3 5h18v14H3zM3 10h18M9 10v9",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

function Icon({ name, size = 20, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

// Real links (new tab, copy address work) that still go through onNavigate.
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
  WebkitMaskImage: "linear-gradient(to bottom, black 15%, transparent 90%)",
  maskImage: "linear-gradient(to bottom, black 15%, transparent 90%)",
};

export default function CBXLanding({ onNavigate, theme = "black", onSelectTheme }) {
  const navigate = (route) => {
    if (typeof onNavigate === "function") {
      onNavigate(route);
    } else {
      console.warn("[CBXLanding] onNavigate prop missing or not a function — falling back to window.location");
      window.location.href = route;
    }
  };

  const primaryBtn = `t-btn inline-flex items-center justify-center gap-2 rounded-lg bg-[#388bfd] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#58a6ff] ${focusRing}`;
  const secondaryBtn = `inline-flex items-center justify-center rounded-lg border border-[#30363d] bg-[#161b22] px-6 py-2.5 text-sm font-semibold text-[#e6edf3] transition hover:border-[#8b949e]/70 hover:bg-[#1c2128] ${focusRing}`;
  const navLink = `rounded-md px-1 py-0.5 transition-colors hover:text-white ${focusRing}`;

  return (
    <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none pt-14 font-sans text-white scrollbar-thin scrollbar-thumb-[#58a6ff] scroll-smooth">
      <a href="#main" className={`sr-only z-[60] rounded-md bg-[#161b22] px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 ${focusRing}`}>
        Skip to content
      </a>

      {/* Nav */}
      <nav aria-label="Main" className="t-nav fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b px-4 py-3 backdrop-blur-md md:px-6">
        <a href="#main" className={`t-accent rounded-md text-xl font-bold tracking-tight ${focusRing}`}>MLForge</a>
        <div className="hidden items-center gap-8 text-sm text-gray-400 md:flex">
          <a href="#demo" className={navLink}>Demo</a>
          <a href="#how" className={navLink}>How it works</a>
          <a href="#models" className={navLink}>Models</a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeButton onNavigate={onNavigate} showSettings={false} showAIButton={false} />
          <NavLink route="/home" onGo={navigate} className={`t-btn rounded-lg bg-[#58a6ff] px-4 py-1.5 text-sm font-medium text-[#010409] transition hover:bg-[#79c0ff] ${focusRing}`}>
            Get started
          </NavLink>
        </div>
      </nav>

      <main id="main">
        {/* Hero */}
        <section className="relative border-b border-[#30363d]">
          <div className="pointer-events-none absolute inset-0" style={gridBg} aria-hidden="true" />
          <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-14 md:pb-20 md:pt-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#0d1117] px-3.5 py-1.5 text-xs text-[#c9d1d9]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#3fb950] motion-reduce:animate-none" />
              Multi-model ML workshop
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-[#e6edf3] md:text-6xl">
              One interface, many models.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-400 md:text-lg md:leading-8">
              MLForge routes your data to the right data management system, then gives you the details and distributes the data to every available model.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <NavLink route="/home" onGo={navigate} className={primaryBtn}>
                Start testing
                <Icon name="arrow" size={16} />
              </NavLink>
              <a href="#models" className={secondaryBtn}>View models</a>
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" aria-labelledby="demo-heading" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-14">
          <div className="mb-6">
            <h2 id="demo-heading" className="text-2xl font-bold tracking-tight text-[#e6edf3]">See a run at a glance</h2>
            <p className="mt-1.5 text-sm text-gray-400">A sample dataset on the left, and how each model scored on it on the right.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#30363d] bg-[#010409]">
            <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#3fb950]" />
                <span className="text-sm font-semibold text-[#e6edf3]">MLForge</span>
              </div>
              <span className="rounded-full border border-[#30363d] px-2.5 py-0.5 text-[11px] text-gray-400">Sample data</span>
            </div>

            <div className="grid gap-5 p-4 md:p-5 lg:grid-cols-[1.35fr_1fr]">
              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-[#30363d]">
                <div className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-[#e6edf3]">Placement dataset</h3>
                  <span className="text-xs text-gray-500">{placementRows.length} rows</span>
                </div>
                <div className="max-h-[340px] overflow-auto" role="region" aria-label="Sample placement dataset" tabIndex={0}>
                  <table className="w-full min-w-[460px] border-collapse text-left text-sm tabular-nums text-gray-300">
                    <thead className="sticky top-0 bg-[#0d1117] text-xs text-gray-400">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">Serial no.</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">CGPA</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">IQ</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Placement possibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placementRows.map((row) => (
                        <tr key={row.serialNo} className="border-t border-[#21262d] transition-colors hover:bg-[#0d1117]">
                          <td className="px-4 py-2.5 font-mono text-gray-500">{row.serialNo}</td>
                          <td className="px-4 py-2.5">{row.cgpa}</td>
                          <td className="px-4 py-2.5">{row.iq}</td>
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#21262d]" aria-hidden="true">
                                <span className="block h-full rounded-full bg-[#388bfd]" style={{ width: `${row.placementPossibility}%` }} />
                              </span>
                              <span className="font-medium text-[#e6edf3]">{row.placementPossibility}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accuracy */}
              <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#e6edf3]">Model accuracy</h3>
                  <span className="text-xs text-gray-500">Latest run</span>
                </div>
                <ul className="space-y-4">
                  {modelAccuracies.map((item) => {
                    const best = item.accuracy === bestAccuracy;
                    return (
                      <li key={item.model}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="text-gray-300">{item.model}</span>
                          <span className={`font-semibold tabular-nums ${best ? "text-[#58a6ff]" : "text-[#c9d1d9]"}`}>
                            {item.accuracy.toFixed(1)}%
                          </span>
                        </div>
                        <div role="meter" aria-label={`${item.model} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.accuracy}
                          className="h-2 overflow-hidden rounded-full bg-[#0d1117]">
                          <div className={`h-full rounded-full ${best ? "bg-[#388bfd]" : "bg-[#484f58]"}`} style={{ width: `${item.accuracy}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-5 text-xs leading-5 text-gray-500">Highest score is highlighted. Figures shown are sample results.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works (a real sequence, so the steps are numbered) */}
        <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-14">
          <div className="mb-6">
            <h2 id="how-heading" className="text-2xl font-bold tracking-tight text-[#e6edf3]">How MLForge works</h2>
            <p className="mt-1.5 text-sm text-gray-400">From raw data to one comparable result.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 transition-colors hover:border-[#58a6ff]/40">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#30363d] bg-[#161b22] text-xs font-medium text-gray-400">{i + 1}</span>
                  <span className="t-accent flex h-9 w-9 items-center justify-center rounded-lg border border-[#30363d] bg-[#010409]">
                    <Icon name={s.icon} size={18} />
                  </span>
                </div>
                <h3 className="font-semibold text-[#e6edf3]">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Models */}
        <section id="models" aria-labelledby="models-heading" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-14">
          <div className="mb-6">
            <h2 id="models-heading" className="text-2xl font-bold tracking-tight text-[#e6edf3]">Models included</h2>
            <p className="mt-1.5 text-sm text-gray-400">Every model runs on the same dataset, so results are directly comparable.</p>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117]">
            {models.map((m, i) => (
              <li key={m.role} className={`flex items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#161b22] ${i < models.length - 1 ? "border-b border-[#30363d]" : ""}`}>
                <span className="font-medium text-[#e6edf3]">{m.role}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs ${TYPE_STYLES[m.model] || "border-[#30363d] text-gray-400"}`}>{m.model}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="border-t border-[#30363d]">
          <div className="mx-auto max-w-5xl px-5 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#e6edf3]">Ready to try the models?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400">
              MLForge brings the ML models and data management together in one workspace.
            </p>
            <div className="mt-7">
              <NavLink route="/home" onGo={navigate} className={`${primaryBtn} px-8 py-3`}>
                Launch MLForge
              </NavLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#30363d]">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-[#c9d1d9]">MLForge</span>
          <span>Multi-model ML visualization system</span>
        </div>
      </footer>
    </div>
  );
}