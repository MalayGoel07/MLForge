import ThemeButton from "./ThemeButton";

const models = [
  { role: "Linear Regression", model: "Regression" },
  { role: "Logistic Regression", model: "Classification" },
  { role: "Decision Tree", model: "Classification" },
  { role: "Random Forest", model: "Ensemble" },
];

const modelAccuracies = [
  { model: "Linear Regression", accuracy: "82.4%" },
  { model: "Logistic Regression", accuracy: "88.1%" },
  { model: "Decision Tree", accuracy: "85.7%" },
  { model: "Random Forest", accuracy: "93.2%" },
];

const placementRows = Array.from({ length: 100 }, (_, index) => {
  const serialNo = index + 1;
  const cgpa = (6 + ((serialNo * 37) % 40) / 10).toFixed(1);
  const iq = 90 + ((serialNo * 13) % 51);
  const placementPossibility = Math.min(98,Math.max(24, Math.round(Number(cgpa) * 8 + (iq - 90) * 0.7)));
  return { serialNo, cgpa, iq, placementPossibility: `${placementPossibility}%`,};});

export default function CBXLanding({ onNavigate, theme = "black", onSelectTheme }) {
  const navigate = (route) => {
    if (typeof onNavigate === "function") {onNavigate(route);}
    else {
      console.warn( "HomePage] onNavigate prop missing or not a function — falling back to window.location");
      window.location.href = route;
    }
  };

  return (
    <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none text-white font-sans pt-14 scrollbar-thin scrollbar-thumb-[#8a8a8a] scroll-smooth">
      <nav className="t-nav fixed top-0 left-0 w-full flex items-center justify-between px-6 py-4 border-b backdrop-blur-md z-50">
        <span className="text-xl font-bold tracking-tight">
          <span className="t-accent">ML</span>
          <span className="t-accent">-Forge</span>
        </span>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#models" className="hover:text-white transition-colors">Models</a>
          <a href="#demo" className="hover:text-white transition-colors">Demo</a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeButton onNavigate={onNavigate} showSettings={false} />
          <button onClick={()=> navigate("/home")} className="t-btn bg-[#8a8a8a] hover:bg-[#5a5a5a] text-white text-sm px-4 py-1.5 rounded-lg transition-colors">Get Started</button>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto pt-6 pb-6 text-center backdrop-blur-sm z-50">
        <div className="inline-flex items-center gap-2 bg-[#000000] border border-[#2a2a2a] rounded-full px-4 py-1.5 text-xs text-[#c9c9c9] mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d0d0d0] animate-pulse inline-block"></span>
          Multi-model ML WorkShop
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-tight"> One interface
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d0d0d0] to-[#5a5a5a]"> Many Models</span>
        </h1>
        <p className="text-gray-400 text-[16px] max-w-xl mx-auto mb-10">MlForge routes your data to the right data management system, then give details and distributes data to all available models.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={()=> navigate("/home")} className="bg-[#5a5a5a] hover:bg-[#444444] text-white px-6 py-2.5 rounded-lg font-medium transition-colors">Start Testing</button>
          <a href="#models" className="border border-[#5a5a5a] hover:border-[#b0b0b0] text-gray-300 hover:text-white px-6 py-2.5 rounded-lg font-medium transition-colors">View Models</a>
        </div>
      </section>

      <section id="demo" className="max-w-4xl mx-auto px-8 pb-8 backdrop-blur-sm z-50">
        <div className="bg-[#050505] border border-[#2a2a2a] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d0d0d0]"></span>
              <span className="text-[#d0d0d0] font-bold text-sm tracking-wide">MlForge</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs text-gray-300">P</div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-[#050505] border border-[#2a2a2a] rounded-xl overflow-hidden text-sm text-gray-300">
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead className="sticky top-0 bg-[#000000] text-gray-300 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Serial No.</th>
                      <th className="px-4 py-3 font-semibold">CGPA</th>
                      <th className="px-4 py-3 font-semibold">IQ</th>
                      <th className="px-4 py-3 font-semibold">Placement Possibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placementRows.map((row) => (
                      <tr key={row.serialNo} className="border-t border-[#2a2a2a] hover:bg-[#000000] transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-400">{row.serialNo}</td>
                        <td className="px-4 py-3">{row.cgpa}</td>
                        <td className="px-4 py-3">{row.iq}</td>
                        <td className="px-4 py-3 text-[#d0d0d0] font-medium">{row.placementPossibility}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#d0d0d0] font-semibold text-xs uppercase tracking-widest">ML Model Accuracy</span>
                <span className="text-gray-500 text-xs">Latest run</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {modelAccuracies.map((item) => (
                  <div key={item.model} className="flex items-center justify-between rounded-lg bg-[#000000] border border-[#2a2a2a] px-4 py-3">
                    <span className="text-sm text-gray-300">{item.model}</span>
                    <span className="text-sm font-semibold text-[#d0d0d0]">{item.accuracy}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 px-1">
              <span>Machine Learning Visuals</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-5xl mx-auto px-8 pb-10 backdrop-blur-sm z-50">
        <p className="text-xs tracking-widest text-[#d0d0d0] uppercase mb-3 text-center">Why MlForge</p>
        <h2 className="text-3xl font-bold text-center mb-8">Built different</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { title: "Enhanced Routing", desc: "Routes the input data, analyzes your data and peform EDA, distributes data to all models.", icon: "⇄" },
            { title: "ML Models", desc: "Dedicated models for Regression and Classification run in parallel for the task at hand.", icon: "◈" },
            { title: "Ultima Output", desc: "ML model synthesizes output responses into one table, with final accuracies.", icon: "⊕" },
          ].map((f) => (
            <div key={f.title} className="bg-[#000000] border border-[#2a2a2a] rounded-xl p-6 hover:border-[#8a8a8a]/40 transition-colors">
              <div className="text-2xl mb-4 text-[#d0d0d0]">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="models" className="max-w-5xl mx-auto px-8 pb-8 backdrop-blur-sm z-50">
        <p className="text-xs tracking-widest text-[#d0d0d0] uppercase mb-3 text-center">Under the hood</p>
        <h2 className="text-3xl font-bold text-center mb-8">The Models lineup</h2>
        <div className="bg-[#000000] border border-[#2a2a2a] rounded-2xl overflow-hidden">
          {models.map((m, i) => (
            <div key={m.role} className={`flex items-center justify-between px-6 py-4 text-sm ${i < models.length - 1 ? "border-b border-[#2a2a2a]" : ""} hover:bg-[#111111] transition-colors`} >
              <span className="text-white font-medium">{m.role}</span>
              <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
                {m.model}
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#161616] py-8 text-center px-8 backdrop-blur-sm z-50">
        <h2 className="text-3xl font-bold mb-4">Ready to try models?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm">MlForge brings together all the ML models and perform proper data management.</p>
        <button onClick={()=> navigate("/home")} className="bg-[#5a5a5a] hover:bg-[#444444] text-white px-8 py-3 rounded-lg font-medium transition-colors">Launch MlForge</button>
      </section>

      <footer className="border-t border-[#161616] px-8 py-6 flex items-center justify-between text-xs text-gray-600 backdrop-blur-sm z-50">
        <span><span className="text-[#d0d0d0]">WorkShop</span><span className="text-[#d0d0d0]">-X</span><span> : </span><span>Multi-model ML visualization system</span></span>
        <span>Multi-model | ML</span>
      </footer>
    </div>
  );
}
