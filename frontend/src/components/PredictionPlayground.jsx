import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import { authHeaders, clearToken } from "../api/auth";
import ThemeButton from "./ThemeButton";

const MAX_CSV_MB = 5;
const PREVIEW_ROWS = 50;
const LAST_RUN_KEY = "mlforge-last-run";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]";
const field =
  "w-full rounded-lg border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-[#e6edf3] outline-none transition placeholder:text-[#6e7681] focus:border-[#388bfd] focus:ring-2 focus:ring-[#388bfd]/20";
const card = "rounded-xl border border-[#30363d] bg-[#161b22]";

const ICONS = {
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  check: "M20 6 9 17l-5-5",
  back: "M19 12H5M12 19l-7-7 7-7",
  close: "M18 6 6 18M6 6l12 12",
};

function Icon({ name, size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

const fmt = (v) => {
  if (typeof v !== "number") return String(v ?? "");
  return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, "");
};

const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename, columns, rows) => {
  const text = [columns.map(csvCell).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const detailOf = (err, fallback) => {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return d.map((x) => x.msg).join(". ");
  return err.message || fallback;
};

function ResultCard({ name, result, task, target, metrics }) {
  if (result.error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[#f85149]/30 bg-[#f85149]/10 p-4 text-sm text-[#ffa198]" role="alert">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
        <span><strong className="font-semibold">{name}:</strong> {result.error}</span>
      </div>
    );
  }
  const probs = result.probabilities ? Object.entries(result.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 5) : null;
  const chips = Object.entries(metrics || {}).filter(([, v]) => typeof v === "number").slice(0, 2);
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#e6edf3]">{name}</h3>
        <div className="flex flex-wrap justify-end gap-1">
          {chips.map(([k, v]) => (
            <span key={k} className="rounded-full border border-[#30363d] px-2 py-0.5 text-[11px] text-[#8b949e]">{k} {fmt(v)}</span>
          ))}
        </div>
      </div>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-[#58a6ff]">{fmt(result.prediction)}</p>
      <p className="text-xs text-[#8b949e]">{task === "classification" ? "Predicted class" : `Predicted ${target}`}</p>
      {probs && (
        <ul className="mt-4 space-y-2.5">
          {probs.map(([cls, p], i) => (
            <li key={cls}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className={`truncate ${i === 0 ? "text-[#e6edf3]" : "text-[#8b949e]"}`}>{cls}</span>
                <span className="tabular-nums text-[#c9d1d9]">{(p * 100).toFixed(1)}%</span>
              </div>
              <div role="meter" aria-label={`${name} probability of ${cls}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-[#0d1117]">
                <div className={`h-full rounded-full ${i === 0 ? "bg-[#388bfd]" : "bg-[#484f58]"}`} style={{ width: `${p * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PredictionPlayground({ onNavigate, theme = "black", onSelectTheme }) {
  const [runs, setRuns] = useState(null); // null = loading
  const [runId, setRunId] = useState("");
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState("manual");
  const [values, setValues] = useState({});
  const [single, setSingle] = useState(null);
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const handleErr = (err, fallback) => {
    if (err.response?.status === 401) { clearToken(); onNavigate("/login"); return; }
    setError(detailOf(err, fallback));
  };

  // Load the user's trained runs
  useEffect(() => {
    let alive = true;
    api.get("/predict/runs", { headers: authHeaders() }).then(({ data }) => {
      if (!alive) return;
      const list = data.runs || [];
      setRuns(list);
      const wanted = new URLSearchParams(window.location.search).get("run") || sessionStorage.getItem(LAST_RUN_KEY);
      setRunId(list.find((r) => r.run_id === wanted)?.run_id || list[0]?.run_id || "");
    }).catch((err) => { if (alive) { setRuns([]); handleErr(err, "Couldn't load your trained models."); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the schema and models for the chosen run
  useEffect(() => {
    setMeta(null); setSingle(null); setBatch(null); setFile(null); setValues({}); setError("");
    if (!runId) return;
    let alive = true;
    api.get(`/predict/runs/${runId}`, { headers: authHeaders() }).then(({ data }) => {
      if (!alive) return;
      setMeta(data);
      setSelected(Object.keys(data.models));
      try { sessionStorage.setItem(LAST_RUN_KEY, runId); } catch { /* storage blocked */ }
    }).catch((err) => { if (alive) handleErr(err, "Couldn't load that run."); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const toggleModel = (name) => {
    setSelected((cur) => {
      if (!cur.includes(name)) return [...cur, name];
      return cur.length > 1 ? cur.filter((n) => n !== name) : cur; // keep at least one
    });
    setSingle(null); setBatch(null);
  };

  const fillExample = () => setValues(Object.fromEntries(meta.features.map((f) => [f.name, String(f.example ?? "")])));

  const predictSingle = async (e) => {
    e.preventDefault();
    if (busy || !meta) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/predict/runs/${runId}/single`, { models: selected, inputs: values }, { headers: authHeaders() });
      setSingle(data.results);
    } catch (err) { handleErr(err, "Couldn't get a prediction."); }
    finally { setBusy(false); }
  };

  const chooseFile = (f) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") { setError("Choose a .csv file."); return; }
    if (f.size > MAX_CSV_MB * 1024 * 1024) { setError(`${f.name} is larger than ${MAX_CSV_MB} MB.`); return; }
    setError(""); setFile(f); setBatch(null);
  };

  const predictBatch = async () => {
    if (busy || !file) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("models", JSON.stringify(selected));
      const { data } = await api.post(`/predict/runs/${runId}/batch`, form, { headers: authHeaders() });
      setBatch(data);
    } catch (err) { handleErr(err, "Couldn't score that file."); }
    finally { setBusy(false); }
  };

  // ---- derived: single-row comparison summary ----
  const singleSummary = useMemo(() => {
    if (!single || !meta) return null;
    const ok = Object.entries(single).filter(([, r]) => !r.error);
    if (ok.length < 2) return null;
    const preds = ok.map(([, r]) => r.prediction);
    if (meta.task === "classification") {
      const uniq = new Set(preds.map(String));
      return uniq.size === 1
        ? { agree: true, text: `All ${ok.length} models predict ${[...uniq][0]}.` }
        : { agree: false, text: "The models disagree. Compare their confidence below." };
    }
    const nums = preds.map(Number);
    return { agree: true, text: `Predictions range from ${fmt(Math.min(...nums))} to ${fmt(Math.max(...nums))}.` };
  }, [single, meta]);

  // ---- derived: merged batch table ----
  const table = useMemo(() => {
    if (!batch || !meta) return null;
    const names = Object.keys(batch.results).filter((n) => !batch.results[n].error);
    const failed = Object.keys(batch.results).filter((n) => batch.results[n].error);
    const compare = names.length > 1 && meta.task === "classification";
    const rows = batch.rows.map((row, i) => {
      const out = { ...row };
      const preds = [];
      names.forEach((n) => {
        const r = batch.results[n];
        const p = r.prediction[i];
        out[`pred_${n}`] = p;
        preds.push(String(p));
        if (r.probabilities) out[`proba_${n}`] = r.probabilities[i]?.[String(p)] ?? "";
      });
      if (compare) out.models_agree = new Set(preds).size === 1 ? "yes" : "no";
      return out;
    });
    const predCols = names.flatMap((n) => [`pred_${n}`, ...(batch.results[n].probabilities ? [`proba_${n}`] : [])]);
    const columns = [...batch.columns, ...predCols, ...(compare ? ["models_agree"] : [])];
    const agreeRate = compare ? rows.filter((r) => r.models_agree === "yes").length / rows.length : null;
    return { rows, columns, predCols: new Set(predCols), failed, agreeRate };
  }, [batch, meta]);

  const downloadTemplate = () => downloadCsv(`${runId}-template.csv`, meta.features.map((f) => f.name), []);

  const loading = runs === null;
  const noRuns = runs && runs.length === 0;

  return (
    <div className="t-page page-no-overscroll flex min-h-screen flex-col overflow-x-clip overscroll-none font-sans text-[#c9d1d9] scrollbar-thin scrollbar-thumb-[#58a6ff] scroll-smooth">
      <header className="sticky top-0 z-10 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/home" onClick={(e) => { e.preventDefault(); onNavigate("/home"); }} aria-label="Back to home"
              className={`rounded-md p-1.5 text-[#8b949e] transition hover:bg-[#30363d]/70 hover:text-white ${focusRing}`}>
              <Icon name="back" size={18} />
            </a>
            <h1 className="t-accent text-lg font-semibold tracking-tight">Prediction playground</h1>
          </div>
          <ThemeButton onNavigate={onNavigate} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-[#f85149]/30 bg-[#f85149]/10 px-3 py-2.5 text-sm text-[#ffa198]">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className={`rounded p-0.5 hover:bg-[#f85149]/20 ${focusRing}`}><Icon name="close" size={14} /></button>
          </div>
        )}

        {loading && <div className="h-40 animate-pulse rounded-xl bg-[#161b22] motion-reduce:animate-none" aria-label="Loading" />}

        {noRuns && (
          <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
            <h2 className="text-base font-semibold text-[#e6edf3]">No trained models yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#8b949e]">Train models in the Model tester, then come back to try them on your own inputs.</p>
            <a href="/compare" onClick={(e) => { e.preventDefault(); onNavigate("/compare"); }}
              className={`mt-5 inline-flex rounded-lg bg-[#238636] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2ea043] ${focusRing}`}>
              Open Model tester
            </a>
          </div>
        )}

        {runs && runs.length > 0 && (
          <>
            {/* Run + models */}
            <section className={`${card} mb-6 p-4`} aria-label="Run and models">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                  <label htmlFor="run" className="mb-1.5 block text-sm font-medium text-[#e6edf3]">Training run</label>
                  <select id="run" value={runId} onChange={(e) => setRunId(e.target.value)} className={field}>
                    {runs.map((r) => (
                      <option key={r.run_id} value={r.run_id}>
                        {(r.dataset_name || "Dataset")} ({r.task}), {new Date(r.created_at * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </option>
                    ))}
                  </select>
                  {meta && <p className="mt-1.5 text-xs text-[#8b949e]">Predicting <span className="text-[#c9d1d9]">{meta.target}</span></p>}
                </div>
                <div>
                  <p id="models-label" className="mb-1.5 text-sm font-medium text-[#e6edf3]">Models to compare</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="models-label">
                    {meta && Object.keys(meta.models).map((n) => {
                      const on = selected.includes(n);
                      return (
                        <button key={n} type="button" aria-pressed={on} onClick={() => toggleModel(n)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${focusRing} ${on ? "border-[#388bfd] bg-[#1f6feb]/15 text-[#58a6ff]" : "border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#e6edf3]"}`}>
                          {on && <Icon name="check" size={12} />}{n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Tabs */}
            <div className="mb-5 inline-grid grid-cols-2 gap-1 rounded-lg border border-[#30363d] bg-[#010409] p-1" role="group" aria-label="Input method">
              {[["manual", "Manual input"], ["batch", "CSV batch"]].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${focusRing} ${tab === key ? "bg-[#21262d] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}>
                  {label}
                </button>
              ))}
            </div>

            {!meta && <div className="h-40 animate-pulse rounded-xl bg-[#161b22] motion-reduce:animate-none" />}

            {/* Manual */}
            {meta && tab === "manual" && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <form onSubmit={predictSingle} className={`${card} h-fit p-5`} aria-busy={busy}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#e6edf3]">Feature values</h2>
                    <div className="flex gap-1">
                      <button type="button" onClick={fillExample} className={`rounded-md px-2.5 py-1 text-xs text-[#8b949e] transition hover:bg-[#21262d] hover:text-white ${focusRing}`}>Fill example</button>
                      <button type="button" onClick={() => { setValues({}); setSingle(null); }} className={`rounded-md px-2.5 py-1 text-xs text-[#8b949e] transition hover:bg-[#21262d] hover:text-white ${focusRing}`}>Clear</button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {meta.features.map((f) => (
                      <div key={f.name}>
                        <label htmlFor={`f-${f.name}`} className="mb-1.5 block truncate text-sm font-medium text-[#e6edf3]" title={f.name}>{f.name}</label>
                        {f.kind === "number" ? (
                          <input id={`f-${f.name}`} type="number" step="any" inputMode="decimal" value={values[f.name] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                            placeholder={f.example !== null ? fmt(f.example) : ""} className={field} />
                        ) : f.free_text ? (
                          <input id={`f-${f.name}`} type="text" value={values[f.name] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                            placeholder={f.example ? String(f.example) : ""} className={field} />
                        ) : (
                          <select id={`f-${f.name}`} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className={field}>
                            <option value="">Not set</option>
                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                        {f.kind === "number" && f.min !== null && (
                          <p className="mt-1 text-[11px] text-[#6e7681]">Training range {fmt(f.min)} to {fmt(f.max)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[#8b949e]">Empty fields are treated as missing values and filled the same way as during training.</p>
                  <button type="submit" disabled={busy}
                    className={`mt-4 w-full rounded-lg bg-[#238636] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
                    {busy ? "Predicting..." : selected.length > 1 ? `Predict with ${selected.length} models` : "Predict"}
                  </button>
                </form>

                <div className="space-y-4" aria-live="polite">
                  {!single && (
                    <div className="rounded-xl border border-dashed border-[#30363d] p-8 text-center text-sm text-[#8b949e]">
                      Enter values and run a prediction. Results from each selected model appear here.
                    </div>
                  )}
                  {singleSummary && (
                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${singleSummary.agree ? "border-[#3fb950]/30 bg-[#238636]/10 text-[#56d364]" : "border-[#d29922]/30 bg-[#9e6a03]/10 text-[#e3b341]"}`}>
                      <Icon name={singleSummary.agree ? "check" : "alert"} size={16} className="mt-0.5 shrink-0" />
                      {singleSummary.text}
                    </div>
                  )}
                  {single && Object.entries(single).map(([n, r]) => (
                    <ResultCard key={n} name={n} result={r} task={meta.task} target={meta.target} metrics={meta.models[n]?.metrics} />
                  ))}
                </div>
              </div>
            )}

            {/* Batch */}
            {meta && tab === "batch" && (
              <div className="space-y-6">
                <section className={`${card} p-5`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-[#e6edf3]">Upload a CSV</h2>
                      <p className="mt-1 text-xs text-[#8b949e]">
                        Needs these columns: <span className="font-mono text-[#c9d1d9]">{meta.features.map((f) => f.name).join(", ")}</span>. Extra columns are kept in the output.
                      </p>
                    </div>
                    <button type="button" onClick={downloadTemplate} className={`inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition hover:bg-[#21262d] ${focusRing}`}>
                      <Icon name="download" size={14} /> Download template
                    </button>
                  </div>

                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-input"
                    onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
                  <label htmlFor="csv-input"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files?.[0]); }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition focus-within:ring-2 focus-within:ring-[#388bfd]/70 ${dragging ? "border-[#388bfd] bg-[#1f6feb]/10" : "border-[#30363d] hover:border-[#8b949e]/70"}`}>
                    <Icon name={file ? "file" : "upload"} size={22} className="text-[#58a6ff]" />
                    {file ? (
                      <>
                        <span className="text-sm font-medium text-[#e6edf3]">{file.name}</span>
                        <span className="text-xs text-[#8b949e]">{(file.size / 1024).toFixed(1)} KB. Click to choose a different file.</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[#e6edf3]">Drop a CSV here, or click to browse</span>
                        <span className="text-xs text-[#8b949e]">Up to {MAX_CSV_MB} MB</span>
                      </>
                    )}
                  </label>

                  <button type="button" onClick={predictBatch} disabled={!file || busy}
                    className={`mt-4 rounded-lg bg-[#238636] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:bg-[#21262d] disabled:text-[#6e7681] ${focusRing}`}>
                    {busy ? "Scoring..." : selected.length > 1 ? `Predict with ${selected.length} models` : "Predict"}
                  </button>
                </section>

                {table && (
                  <section className={`${card} overflow-hidden`} aria-live="polite" aria-label="Batch results">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] px-5 py-4">
                      <div>
                        <h2 className="text-sm font-semibold text-[#e6edf3]">Results for {batch.total} row{batch.total === 1 ? "" : "s"}</h2>
                        {table.agreeRate !== null && (
                          <p className="mt-1 text-xs text-[#8b949e]">Models agree on <span className="font-medium text-[#e6edf3]">{(table.agreeRate * 100).toFixed(1)}%</span> of rows.</p>
                        )}
                      </div>
                      <button type="button" onClick={() => downloadCsv(`${runId}-predictions.csv`, table.columns, table.rows)}
                        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#238636] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2ea043] ${focusRing}`}>
                        <Icon name="download" size={14} /> Download results
                      </button>
                    </div>

                    {(batch.warnings.length > 0 || table.failed.length > 0) && (
                      <ul className="space-y-1 border-b border-[#30363d] bg-[#9e6a03]/10 px-5 py-3 text-xs text-[#e3b341]">
                        {batch.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        {table.failed.map((n) => <li key={n}>{n} couldn't score this file and was left out.</li>)}
                      </ul>
                    )}

                    <div className="max-h-[420px] overflow-auto" role="region" aria-label="Prediction results table" tabIndex={0}>
                      <table className="w-full min-w-max border-collapse text-left text-sm tabular-nums">
                        <thead className="sticky top-0 bg-[#0d1117] text-xs text-[#8b949e]">
                          <tr>{table.columns.map((c) => (
                            <th key={c} scope="col" className={`whitespace-nowrap px-4 py-2.5 font-medium ${table.predCols.has(c) ? "text-[#58a6ff]" : ""}`}>{c}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                            <tr key={i} className="border-t border-[#21262d] hover:bg-[#0d1117]">
                              {table.columns.map((c) => (
                                <td key={c} className={`whitespace-nowrap px-4 py-2 ${table.predCols.has(c) ? "font-medium text-[#e6edf3]" : "text-[#c9d1d9]"} ${c === "models_agree" && r[c] === "no" ? "!text-[#e3b341]" : ""}`}>
                                  {typeof r[c] === "number" ? fmt(r[c]) : String(r[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {table.rows.length > PREVIEW_ROWS && (
                      <p className="border-t border-[#30363d] px-5 py-3 text-xs text-[#8b949e]">Showing the first {PREVIEW_ROWS} rows. The download contains all {table.rows.length}.</p>
                    )}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}