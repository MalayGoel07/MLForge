import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ThemeButton from "./ThemeButton";
import { aiPanel } from "./aiPanelStore";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const KERNEL_BOOT = `
import sys, io, os, ast, json, base64, traceback, contextlib, warnings
os.environ["MPLBACKEND"] = "AGG"
warnings.filterwarnings("ignore", message=".*non-interactive.*")

_NS = {"__name__": "__main__"}

def _reset():
    _NS.clear()
    _NS["__name__"] = "__main__"
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is not None:
        plt.close("all")

def _run_cell(src):
    out, err = io.StringIO(), io.StringIO()
    res = {"stdout": "", "stderr": "", "result": None, "html": None, "images": [], "error": None}
    try:
        tree = ast.parse(src, mode="exec")
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            exec(compile(tree, "<cell>", "exec"), _NS)
            if last is not None:
                val = eval(compile(last, "<cell>", "eval"), _NS)
                if val is not None:
                    _NS["_"] = val
                    if hasattr(val, "_repr_html_"):
                        try:
                            res["html"] = val._repr_html_()
                        except Exception:
                            pass
                    res["result"] = repr(val)
    except BaseException:
        et, ev, tb = sys.exc_info()
        res["error"] = "".join(traceback.format_exception(et, ev, tb.tb_next if tb else None))

    plt = sys.modules.get("matplotlib.pyplot")
    if plt is not None:
        try:
            for n in plt.get_fignums():
                buf = io.BytesIO()
                plt.figure(n).savefig(buf, format="png", bbox_inches="tight", dpi=110)
                res["images"].append(base64.b64encode(buf.getvalue()).decode("ascii"))
        except Exception:
            pass
        finally:
            plt.close("all")

    res["stdout"] = out.getvalue()
    res["stderr"] = err.getvalue()
    return json.dumps(res)
`;

let kernelPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.onload = resolve;
        el.onerror = () => reject(new Error("Could not download the Python runtime"));
        document.head.appendChild(el);
    });
}

function getKernel() {
    if (!kernelPromise) {
        kernelPromise = (async () => {
            if (!window.loadPyodide) await loadScript(`${PYODIDE_URL}pyodide.js`);
            const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
            await py.runPythonAsync(KERNEL_BOOT);
            return py;
        })().catch((err) => {
            kernelPromise = null;
            throw err;
        });
    }
    return kernelPromise;
}

/* ------------------------------------------------------------------ */

let idCounter = 0;
const newCell = (code = "") => ({ id: `cell-${++idCounter}`, code, output: null, status: "idle", count: null });

const NOTEBOOK_STYLES = `
.nb-html table{border-collapse:collapse;font-size:12px;color:#d4e6d5}
.nb-html th,.nb-html td{border:1px solid #243724;padding:4px 10px;text-align:right}
.nb-html thead{background:#172617;color:#adc9ae}
.nb-html style{display:none}
`;

function CodeArea({ cellId, value, onChange, onKeyDown }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
        <textarea
            ref={ref}
            data-cell={cellId}
            rows={1}
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write Python here. Shift+Enter runs the cell."
            className="block w-full resize-none overflow-hidden bg-transparent px-4 py-3 text-sm leading-6 text-[#d4e6d5] placeholder:text-gray-600 focus:outline-none"
        />
    );
}

function CellOutput({ output }) {
    if (!output) return null;
    const hasContent = output.stdout || output.stderr || output.result || output.html || output.images?.length || output.error;
    if (!hasContent) return null;
    return (
        <div className="space-y-3 border-t border-[#243724] bg-[#0b100b] px-4 py-3 text-xs leading-5">
            {output.stdout && <pre className="whitespace-pre-wrap break-words text-[#d4e6d5]">{output.stdout}</pre>}
            {output.stderr && <pre className="whitespace-pre-wrap break-words text-amber-400">{output.stderr}</pre>}
            {output.html ? (
                <div className="nb-html overflow-x-auto" dangerouslySetInnerHTML={{ __html: output.html }} />
            ) : (
                output.result && <pre className="whitespace-pre-wrap break-words text-[#adc9ae]">{output.result}</pre>
            )}
            {output.images?.map((b64, i) => (
                <img key={i} src={`data:image/png;base64,${b64}`} alt={`Plot output ${i + 1}`} className="max-w-full rounded bg-white" />
            ))}
            {output.error && <pre className="whitespace-pre-wrap break-words text-red-400">{output.error}</pre>}
        </div>
    );
}

// Strip obvious secrets before anything leaves the notebook
const redact = (s) => s
    .replace(/(api[_-]?key|secret|token|password|passwd)(\s*[=:]\s*)(["'])[^"']+\3/gi, "$1$2$3[redacted]$3")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, "[redacted]")
    .replace(/\bgh[pos]_[A-Za-z0-9]{20,}/g, "[redacted]");
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…[truncated]` : s || "");
const tail = (s, n) => (s && s.length > n ? `…${s.slice(-n)}` : s || "");

const cellBlock = (c, i, full) => {
    const o = c.output || {};
    const lines = [`--- Cell ${i + 1} (${c.status}) ---`, "Code:", clip(c.code.trim(), full ? 1500 : 500) || "(empty)"];
    if (o.stdout) lines.push("Output:", clip(o.stdout.trim(), full ? 800 : 250));
    if (o.result) lines.push("Result:", clip(o.result, full ? 800 : 250));
    if (o.stderr) lines.push("Warnings:", clip(o.stderr.trim(), 200));
    if (o.error) lines.push("Error:", tail(o.error.trim(), full ? 1500 : 500)); // the exception message is at the end
    if (o.images?.length) lines.push(`[${o.images.length} plot(s) produced]`);
    return lines.join("\n");
};

export default function MLNotebook({ onNavigate, theme = "forest", onSelectTheme }) {
    const [cells, setCells] = useState(() => [newCell()]);
    const [kernelStatus, setKernelStatus] = useState("loading"); // loading | ready | error
    const [kernelError, setKernelError] = useState("");
    const [files, setFiles] = useState([]);
    const [kernelAttempt, setKernelAttempt] = useState(0);
    const pyRef = useRef(null);
    const cellsRef = useRef(cells);
    const queueRef = useRef(Promise.resolve());
    const runCount = useRef(0);
    const fileInputRef = useRef(null);

    const updateCell = (id, patch) => setCells((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    const focusCell = (id) => setTimeout(() => document.querySelector(`[data-cell="${id}"]`)?.focus(), 0);

    const addCell = (afterIndex, code = "") => {
        const cell = newCell(code);
        setCells((cs) => {
            const next = [...cs];
            next.splice(afterIndex + 1, 0, cell);
            return next;
        });
        focusCell(cell.id);
    };

    useEffect(() => {cellsRef.current = cells;}, [cells]);
    
    const isBusy = cells.some((c) => c.status === "running" || c.status === "queued");
    useEffect(() => {
        let cancelled = false;
        getKernel()
            .then((py) => {
                if (cancelled) return;
                py.runPython("_reset()");
                pyRef.current = py;
                setKernelStatus("ready");
            })
            .catch((err) => {
                if (cancelled) return;
                setKernelError(err.message);
                setKernelStatus("error");
            });
        return () => {
            cancelled = true;
        };
    }, [kernelAttempt]);

    useEffect(() => {
        aiPanel.setInsertHandler((code) => {
            const list = cellsRef.current;
            const last = list[list.length - 1];
            if (last && !last.code.trim()) { updateCell(last.id, { code }); focusCell(last.id); }
            else addCell(list.length - 1, code);
        });
        return () => aiPanel.setInsertHandler(null);   // button disappears when you leave the page
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const retryKernel = () => {
        setKernelStatus("loading");
        setKernelError("");
        setKernelAttempt((n) => n + 1);
    };

    const execute = async (id) => {
        const py = pyRef.current;
        const cell = cellsRef.current.find((c) => c.id === id);
        if (!py || !cell) return;

        updateCell(id, { status: "running" });
        await new Promise((r) => setTimeout(r, 30)); // let the "running" state paint first

        let output;
        try {
            await py.loadPackagesFromImports(cell.code, { messageCallback: () => {}, errorCallback: () => {} });
            output = JSON.parse(py.globals.get("_run_cell")(cell.code));
        } catch (err) {
            output = { error: String(err) };
        }
        runCount.current += 1;
        updateCell(id, { status: output.error ? "error" : "done", output, count: runCount.current });
    };

    const enqueue = (id) => {
        if (kernelStatus !== "ready") return;
        updateCell(id, { status: "queued" });
        queueRef.current = queueRef.current.then(() => execute(id));
    };

    const runAll = () => cellsRef.current.forEach((c) => enqueue(c.id));

    const deleteCell = (id) => setCells((cs) => (cs.length === 1 ? [newCell()] : cs.filter((c) => c.id !== id)));

    const moveCell = (index, dir) =>
        setCells((cs) => {
            const target = index + dir;
            if (target < 0 || target >= cs.length) return cs;
            const next = [...cs];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const clearOutputs = () => setCells((cs) => cs.map((c) => ({ ...c, output: null, status: "idle", count: null })));
    const hasCode = cells.some((c) => c.code.trim());
    const shareWithAI = (focusId) => {
        const list = cellsRef.current;
        // Focus the clicked cell; from the toolbar, focus the last cell that errored (if any)
        const focusIdx = focusId
            ? list.findIndex((c) => c.id === focusId)
            : list.map((c) => c.status).lastIndexOf("error");
        const f = focusIdx >= 0 ? list[focusIdx] : null;

        const parts = [
            "Page: ML Notebook (Python runs in the browser via Pyodide; cells share variables)",
            `Uploaded files: ${files.length ? files.join(", ") : "none"}`,
            `Cells: ${list.length}`,
        ];
        if (f) parts.push("FOCUS CELL:", cellBlock(f, focusIdx, true));
        const others = list
            .map((c, i) => [c, i])
            .filter(([c, i]) => i !== focusIdx && c.code.trim())
            .map(([c, i]) => cellBlock(c, i, false));
        if (others.length) parts.push("OTHER CELLS:", ...others);

        const greeting = f?.status === "error"
            ? `I see an error in cell ${focusIdx + 1}. Want me to explain it or suggest a fix?`
            : f
                ? `I have cell ${focusIdx + 1} in front of me. What would you like help with?`
                : `I can see your notebook (${list.length} cell${list.length === 1 ? "" : "s"}). How can I help with your code?`;

        aiPanel.openWithContext({
            id: `notebook-${f?.id ?? "all"}-${runCount.current}`,
            title: f ? `Notebook: cell ${focusIdx + 1}` : "Notebook",
            label: f ? `Notebook · cell ${focusIdx + 1}` : "Notebook",
            greeting,
            text: redact(parts.join("\n")).slice(0, 6000),
        });
    };

    const restartKernel = () => {
        pyRef.current?.runPython("_reset()");
        runCount.current = 0;
        setCells((cs) => cs.map((c) => ({ ...c, status: "idle", count: null })));
    };

    const handleKeyDown = (e, id, index) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const el = e.target;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            updateCell(id, { code: `${el.value.slice(0, start)}    ${el.value.slice(end)}` });
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + 4;
            });
            return;
        }
        if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            enqueue(id);
            if (e.shiftKey) {
                const next = cellsRef.current[index + 1];
                if (next) focusCell(next.id);
                else addCell(index);
            }
        }
    };

    const handleUpload = async (event) => {
        const py = pyRef.current;
        const picked = Array.from(event.target.files || []);
        if (!py || picked.length === 0) return;
        for (const f of picked) {
            py.FS.writeFile(`/home/pyodide/${f.name}`, new Uint8Array(await f.arrayBuffer()));
        }
        setFiles((current) => [...new Set([...current, ...picked.map((f) => f.name)])]);
        event.target.value = "";
    };

    const insertReadSnippet = (name) => {
        const lower = name.toLowerCase();
        const snippet = lower.endsWith(".json")
            ? `import pandas as pd\ndf = pd.read_json("${name}")\ndf.head()`
            : lower.endsWith(".xlsx")
              ? `import pandas as pd\ndf = pd.read_excel("${name}")\ndf.head()`
              : `import pandas as pd\ndf = pd.read_csv("${name}")\ndf.head()`;
        addCell(cellsRef.current.length - 1, snippet);
    };

    const exportNotebook = () => {
        const toLines = (text) => text.split("\n").map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line));
        const notebook = {
            cells: cells.map((c) => {
                const outputs = [];
                if (c.output?.stdout) outputs.push({ output_type: "stream", name: "stdout", text: toLines(c.output.stdout) });
                c.output?.images?.forEach((b64) => outputs.push({ output_type: "display_data", data: { "image/png": b64 }, metadata: {} }));
                return { cell_type: "code", metadata: {}, execution_count: c.count, source: toLines(c.code), outputs };
            }),
            metadata: {
                kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
                language_info: { name: "python" },
            },
            nbformat: 4,
            nbformat_minor: 4,
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(notebook, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "workshop-notebook.ipynb";
        a.click();
        URL.revokeObjectURL(url);
    };

    const kernelBadge = () => {
        if (kernelStatus === "loading") return { label: "Loading Python...", className: "border-[#618c61] text-[#adc9ae]" };
        if (kernelStatus === "error") return { label: "Kernel failed", className: "border-red-800 text-red-400" };
        if (isBusy) return { label: "Busy", className: "border-amber-600 text-amber-400" };
        return { label: "Ready", className: "border-[#7aa88a] text-[#d4e6d5] bg-[#172617]" };
    };
    const badge = kernelBadge();

    const toolbarBtn ="rounded-lg border border-[#243724] bg-[#101a10] px-3 py-2 text-xs text-[#d4e6d5] transition hover:border-[#618c61] disabled:cursor-not-allowed disabled:opacity-50";
    const iconBtn = "rounded border border-transparent px-2 py-1 text-xs text-gray-500 transition hover:border-[#243724] hover:text-[#d4e6d5] disabled:opacity-30";
    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <style>{NOTEBOOK_STYLES}</style>
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">ML Notebook</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Write and run Python cell by cell. Variables stay in memory between cells.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <section className="mb-5 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={runAll} disabled={kernelStatus !== "ready" || isBusy} className={toolbarBtn}>Run all</button>
                        <button type="button" onClick={() => addCell(cells.length - 1)} className={toolbarBtn}>Add cell</button>
                        <button type="button" onClick={restartKernel} disabled={kernelStatus !== "ready"} className={toolbarBtn}>Restart kernel</button>
                        <button type="button" onClick={clearOutputs} className={toolbarBtn}>Clear outputs</button>
                        <button type="button" onClick={exportNotebook} className={toolbarBtn}>Export .ipynb</button>
                        <button type="button" onClick={() => shareWithAI()} disabled={!files.length} className={toolbarBtn}>✦ Context AI</button>
                        <span className={`ml-auto rounded border px-2 py-1 text-[10px] ${badge.className}`}>{badge.label}</span>
                    </div>

                    {kernelStatus === "error" && (
                        <p className="mt-3 text-xs text-red-400">
                            {kernelError}.{" "}
                            <button type="button" onClick={retryKernel} className="underline hover:text-red-300">Try again</button>
                        </p>
                    )}
                    {kernelStatus === "loading" && (
                        <p className="mt-3 text-xs text-gray-500">First load downloads the Python runtime (around 10 MB). It is cached afterwards.</p>
                    )}

                    <div className="mt-4 border-t border-[#243724] pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <input ref={fileInputRef} type="file" multiple accept=".csv,.json,.xlsx,.txt" className="hidden" onChange={handleUpload} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={kernelStatus !== "ready"} className="rounded-lg border border-red-400 bg-red-400/10 px-3 py-2 text-xs text-[#d4e6d5] transition hover:bg-red-400 hover:border-red-500 hover:text-white disabled:opacity-50">Upload dataset</button>
                            {files.length === 0 && <span className="text-xs text-gray-500">Uploaded files can be read by name, e.g. pd.read_csv("data.csv")</span>}
                            {files.map((name) => (
                                <button key={name} type="button" onClick={() => insertReadSnippet(name)} title="Add a cell that loads this file" className="rounded border border-[#243724] bg-[#101a10] px-2 py-1 text-xs text-[#adc9ae] transition hover:border-[#618c61]">{name}</button>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="space-y-4">
                    {cells.map((cell, index) => {
                        const running = cell.status === "running";
                        const queued = cell.status === "queued";
                        const borderColor = cell.status === "error" ? "border-red-800" : running || queued ? "border-[#618c61]" : "border-[#243724]";
                        return (
                            <div key={cell.id} className={`overflow-hidden rounded-xl border bg-[#101a10] transition ${borderColor}`}>
                                <div className="flex items-center justify-between border-b border-[#243724] bg-[#0e140e] px-3 py-1.5">
                                    <span className="text-xs text-gray-500">In [{running ? "*" : queued ? "…" : cell.count ?? " "}]</span>
                                    <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => shareWithAI(cell.id)}
                                            className={`rounded border px-3 py-1 text-xs transition disabled:opacity-40 ${cell.status === "error" ? "border-red-800 text-red-300 hover:bg-red-600/20" : "border-[#243724] text-[#adc9ae] hover:border-[#618c61]"}`}>
                                            {cell.status === "error" ? "Fix with AI" : "Ask AI"}
                                        </button>
                                        <button type="button" onClick={() => enqueue(cell.id)} disabled={kernelStatus !== "ready" || running || queued} className="rounded border border-[#243724] px-3 py-1 text-xs text-[#d4e6d5] transition hover:border-green-300 hover:bg-green-300/10 disabled:opacity-40">Run</button>
                                        <button type="button" onClick={() => moveCell(index, -1)} disabled={index === 0} className={iconBtn} aria-label="Move cell up">Up</button>
                                        <button type="button" onClick={() => moveCell(index, 1)} disabled={index === cells.length - 1} className={iconBtn} aria-label="Move cell down">Down</button>
                                        <button type="button" onClick={() => addCell(index)} className={iconBtn} aria-label="Add cell below">Add below</button>
                                        <button type="button" onClick={() => deleteCell(cell.id)} className={`${iconBtn} hover:!text-red-400`} aria-label="Delete cell">Delete</button>
                                    </div>
                                </div>
                                <CodeArea
                                    cellId={cell.id}
                                    value={cell.code}
                                    onChange={(code) => updateCell(cell.id, { code })}
                                    onKeyDown={(e) => handleKeyDown(e, cell.id, index)}
                                />
                                <CellOutput output={cell.output} />
                            </div>
                        );
                    })}
                </div>

                <button type="button" onClick={() => addCell(cells.length - 1)} className="mt-4 w-full rounded-lg border border-dashed border-[#243724] px-4 py-3 text-xs text-gray-500 transition hover:border-[#618c61] hover:text-[#d4e6d5]">Add cell</button>
            </section>
        </div>
    );
}