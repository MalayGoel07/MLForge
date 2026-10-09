import ThemeButton from "./ThemeButton";

export default function HomePage({ onNavigate, theme = "forest", onSelectTheme }) {
  const navigate = (route) => {
    if (typeof onNavigate === "function") {onNavigate(route);}
    else {
      console.warn( "HomePage] onNavigate prop missing or not a function — falling back to window.location");
      window.location.href = route;
    }
  };

  return (
    <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-8 font-sans scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
      <div className="mx-auto flex max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="t-accent text-3xl font-bold">MLForge</h1>
              <ThemeButton theme={theme} onSelect={onSelectTheme} />
            </div>
            <p className="mt-1 text-sm text-gray-500">Test, analyze and experiment on dataset, models, and more.</p>
          </div>
        </header>
      </div>

      <section className="grid flex-1 items-center gap-6 py-10 lg:grid-cols-[1fr_380px] max-w-6xl mx-auto">
            <div>
              <div className="flex flex-row items-center p-2 gap-4">
                <p className="t-accent text-xs uppercase tracking-[0.35em]">ML Workspace</p>
                <div className="t-pill inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs">
                  <span className="t-dot w-1.5 h-1.5 rounded-full animate-pulse inline-block"></span>
                  Multi-model ML WorkShop
                </div>
              </div>
                <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Machine learning, <br></br>all organized in <br></br>one place.</h2>
                <p className="mt-5 max-w-2xl text-base leading-6 text-gray-400">Jump into the tools you use most, and keep the day moving without digging through menus.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button onClick={()=> navigate("/compare")} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-gray-200 no-underline transition hover:border-green-400/40 hover:bg-green-500/10 hover:text-green-300">Model tester</button>
                  <button onClick={()=> navigate("/analyze")} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-gray-200 no-underline transition hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-purple-300">Analyse Data</button>
                  <button onClick={()=> navigate("/createdata")} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-gray-200 no-underline transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-300">Create DataSet</button>
                  <button onClick={()=> navigate("/roadmap")} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-gray-200 no-underline transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300">Resources and RoadMap</button>
                </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-lg">
                <div className="t-rule h-px w-full"></div>
                <div className="pt-6">
                  <h3 className="t-accent text-xl font-bold">Quick Actions</h3>
                  <div className="mt-5 grid gap-3">
                    <button className="rounded-xl border border-white/10 bg-black/30 p-4 no-underline transition hover:border-cyan-400/40 hover:bg-cyan-500/10">
                        <span className="block text-base font-semibold text-white">Ai HelperBot</span>
                        <span className="mt-1 block text-xs text-gray-500">Ai-Bot helper for your queries.</span>
                    </button>
                    <button className="rounded-xl border border-white/10 bg-black/30 p-4 no-underline transition hover:border-red-400/40 hover:bg-red-500/10">
                        <span className="block text-base font-semibold text-white">Report Bug</span>
                        <span className="mt-1 block text-xs text-gray-500">Report issues or unexpected behavior quickly.</span>
                    </button>
                  </div>
                </div>
            </aside>
        </section> 
    </div>
  );
}