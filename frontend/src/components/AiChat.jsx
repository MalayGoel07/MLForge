import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import { authHeaders, clearToken, getToken } from "../api/auth";
import { aiPanel, useAIPanelOpen, useAIContext, useInsertHandler, useSettingsRequest } from "./aiPanelStore";

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const ACCEPTED = "image/*,.csv,.json,.txt,.md";
const isAccepted = (f) => f.type.startsWith("image/") || /\.(csv|json|txt|md)$/i.test(f.name);

const SUGGESTIONS = [
    { icon: "sparkle", label: "Which model suits my dataset?", prompt: "Which model should I start with for my dataset? Ask me what you need to know about the data." },
    { icon: "alert", label: "Debug an error in my pipeline", prompt: "Help me debug an error in my pipeline. Here is the traceback:\n\n" },
    { icon: "file", label: "Write code to clean my data", prompt: "Write Python code to handle missing values and outliers in a pandas DataFrame." },
    { icon: "settings", label: "Tune hyperparameters", prompt: "How should I tune the hyperparameters of my model? Suggest a search strategy and ranges." },
];

const newChat = () => ({ id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] });
const formatTime = (ts) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const groupLabel = (ts) => {
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(new Date()) - day(new Date(ts))) / 864e5);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return "Previous 7 days";
    if (diff < 30) return "Previous 30 days";
    return "Older";
};

// ---------- shared style tokens ----------
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70";
const iconBtn = `inline-flex items-center justify-center rounded-md p-1.5 text-[#8b949e] transition hover:bg-[#30363d]/70 hover:text-white ${focusRing}`;
const field = "w-full rounded-lg border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-[#c9d1d9] outline-none transition placeholder:text-[#6e7681] focus:border-[#388bfd] focus:ring-2 focus:ring-[#388bfd]/20";

// ---------- icons ----------
const ICONS = {
    plus: "M12 5v14M5 12h14",
    close: "M18 6 6 18M6 6l12 12",
    history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2",
    settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    copy: "M8 8h12v12H8zM4 16V4h12",
    check: "M20 6 9 17l-5-5",
    refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
    send: "M12 19V5M5 12l7-7 7 7",
    stop: "M7 7h10v10H7z",
    paperclip: "m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
    sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z",
    trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
    chevron: "m6 9 6 6 6-6",
    arrowDown: "M12 5v14M5 12l7 7 7-7",
    arrowLeft: "M19 12H5M12 19l-7-7 7-7",
    alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
    image: "M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 16l-5-5-9 8",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    insert: "M12 3v12M7 10l5 5 5-5M5 21h14",
};

function Icon({ name, size = 16, fill = false, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d={ICONS[name]} />
        </svg>
    );
}

function IconButton({ icon, label, onClick, active, size = 16 }) {
    return (
        <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
            className={`${iconBtn} ${active ? "bg-[#30363d] text-white" : ""}`}>
            <Icon name={icon} size={size} />
        </button>
    );
}

function Avatar() {
    return (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#1f6feb]/30 bg-[#1f6feb]/15 text-[#58a6ff]">
            <Icon name="sparkle" size={13} />
        </div>
    );
}

// ---------- syntax highlighting (dependency-free) ----------
const KEYWORDS = new Set("def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False async await const let var function new this export default typeof null undefined true false".split(" "));
const HL_LANGS = new Set(["", "python", "py", "js", "javascript", "jsx", "ts", "typescript", "tsx", "json"]);
const TOKEN_RE = /(#.*|\/\/.*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;

const highlight = (code, lang) => {
    if (!HL_LANGS.has(lang.toLowerCase())) return code;
    const re = new RegExp(TOKEN_RE);
    const out = [];
    let last = 0, m, k = 0;
    while ((m = re.exec(code))) {
        if (m.index > last) out.push(code.slice(last, m.index));
        let cls = "";
        if (m[1]) cls = "italic text-[#8b949e]";
        else if (m[2]) cls = "text-[#a5d6ff]";
        else if (m[3]) cls = "text-[#79c0ff]";
        else if (KEYWORDS.has(m[4])) cls = "text-[#ff7b72]";
        else if (code[re.lastIndex] === "(") cls = "text-[#d2a8ff]";
        out.push(cls ? <span key={k++} className={cls}>{m[0]}</span> : m[0]);
        last = re.lastIndex;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
};

// ---------- lightweight markdown ----------
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

const renderInline = (text) => {
    const re = new RegExp(INLINE_RE);
    const out = [];
    let last = 0, m, k = 0;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        if (m[1]) out.push(<code key={k++} className="rounded bg-[#6e7681]/25 px-1.5 py-0.5 font-mono text-[12px] text-[#e6edf3]">{m[1].slice(1, -1)}</code>);
        else if (m[2]) out.push(<strong key={k++} className="font-semibold text-[#e6edf3]">{m[2].slice(2, -2)}</strong>);
        else if (m[3]) out.push(<em key={k++}>{m[3].slice(1, -1)}</em>);
        else out.push(<a key={k++} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] underline-offset-2 hover:underline">{m[4]}</a>);
        last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
};

const splitRow = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || "");
const BLOCK_START = /^(#{1,4}\s|\s*[-*+]\s|\s*\d+[.)]\s|>)/;

function Markdown({ text }) {
    const lines = text.split("\n");
    const blocks = [];
    let i = 0, k = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        let m;

        if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
            blocks.push(
                <p key={k++} className={`mb-1.5 mt-4 font-semibold text-[#e6edf3] first:mt-0 ${m[1].length <= 2 ? "text-[15px]" : "text-sm"}`}>{renderInline(m[2])}</p>
            );
            i++; continue;
        }
        if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
            blocks.push(<hr key={k++} className="my-3 border-[#30363d]" />);
            i++; continue;
        }
        if (line.includes("|") && isTableSep(lines[i + 1])) {
            const head = splitRow(line);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].trim() && lines[i].includes("|")) { rows.push(splitRow(lines[i])); i++; }
            blocks.push(
                <div key={k++} className="my-3 overflow-x-auto rounded-lg border border-[#30363d]">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-[#161b22] text-[#e6edf3]">
                            <tr>{head.map((h, c) => <th key={c} className="border-b border-[#30363d] px-3 py-2 font-semibold">{renderInline(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((r, ri) => (
                                <tr key={ri} className="border-b border-[#21262d] last:border-0">
                                    {r.map((cell, c) => <td key={c} className="px-3 py-2 align-top">{renderInline(cell)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
            blocks.push(<ul key={k++} className="my-2 list-disc space-y-1 pl-5 marker:text-[#6e7681]">{items.map((t, n) => <li key={n}>{renderInline(t)}</li>)}</ul>);
            continue;
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
            blocks.push(<ol key={k++} className="my-2 list-decimal space-y-1 pl-5 marker:text-[#8b949e]">{items.map((t, n) => <li key={n}>{renderInline(t)}</li>)}</ol>);
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quote = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
            blocks.push(<blockquote key={k++} className="my-2 border-l-2 border-[#30363d] pl-3 text-[#8b949e]">{renderInline(quote.join(" "))}</blockquote>);
            continue;
        }

        const para = [];
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]) && !(para.length && lines[i].includes("|") && isTableSep(lines[i + 1]))) {
            para.push(lines[i]); i++;
        }
        if (!para.length) { para.push(line); i++; }
        blocks.push(<p key={k++} className="my-2 whitespace-pre-wrap break-words first:mt-0 last:mb-0">{renderInline(para.join("\n"))}</p>);
    }
    return <>{blocks}</>;
}

// Split a reply into text and ```fenced``` code segments (works on half-streamed replies too)
const parseBlocks = (text) => {
    const out = [];
    const re = /```(\w*)\n?([\s\S]*?)(```|$)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push({ type: "text", content: text.slice(last, m.index) });
        out.push({ type: "code", lang: m[1], content: m[2].replace(/\n$/, ""), closed: m[3] === "```" });
        last = re.lastIndex;
    }
    if (last < text.length) out.push({ type: "text", content: text.slice(last) });
    return out;
};

function CodeBlock({ lang, code, closed, canInsert, onInsert }) {
    const [copied, setCopied] = useState(false);
    const [inserted, setInserted] = useState(false);
    const flash = (set) => { set(true); setTimeout(() => set(false), 1500); };
    const copy = async () => { try { await navigator.clipboard.writeText(code); flash(setCopied); } catch { /* clipboard blocked */ } };
    const isPython = ["", "python", "py"].includes(lang.toLowerCase());
    const highlighted = useMemo(() => highlight(code, lang), [code, lang]);
    const btn = `inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#8b949e] transition hover:bg-[#30363d] hover:text-white ${focusRing}`;
    return (
        <div className="my-3 overflow-hidden rounded-lg border border-[#30363d] bg-[#010409]">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] py-1 pl-3 pr-1.5">
                <span className="font-mono text-[11px] text-[#8b949e]">{lang || "code"}</span>
                {closed && (
                    <div className="flex items-center gap-0.5">
                        <button type="button" onClick={copy} className={btn}>
                            <Icon name={copied ? "check" : "copy"} size={12} className={copied ? "text-[#3fb950]" : ""} />
                            {copied ? "Copied" : "Copy"}
                        </button>
                        {canInsert && isPython && (
                            <button type="button" onClick={() => { onInsert(code); flash(setInserted); }} className={`${btn} !text-[#3fb950] hover:!text-[#56d364]`}>
                                <Icon name={inserted ? "check" : "insert"} size={12} />
                                {inserted ? "Inserted" : "Insert into notebook"}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 text-[#e6edf3]"><code>{highlighted}</code></pre>
        </div>
    );
}

// Mount this ONCE (in App.jsx), outside your routes, so it shows on every page.
export default function AIChat({ onNavigate }) {
    const open = useAIPanelOpen();
    const [chats, setChats] = useState(() => [newChat()]);
    const [activeId, setActiveId] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const loaded = useRef(false);
    const dirty = useRef(new Set());
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [historyOpen, setHistoryOpen] = useState(false);
    const [search, setSearch] = useState("");
    const scrollRef = useRef(null);
    const stick = useRef(true);
    const [showJump, setShowJump] = useState(false);
    const abortRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);
    const [dragging, setDragging] = useState(false);
    const [confirmState, setConfirmState] = useState(null);
    const activeChat = useMemo(() => chats.find((c) => c.id === activeId) || chats[0], [chats, activeId]);
    const aiContext = useAIContext();
    const insertHandler = useInsertHandler();
    const settingsRequest = useSettingsRequest();
    const [ctxByChat, setCtxByChat] = useState({});   // chatId -> context
    const ctxChatId = useRef({});                      // ctx.id -> chatId (reuse chat on re-click)
    const [copiedKey, setCopiedKey] = useState("");
    const handledCtx = useRef(0);

    // ---------- AI model picker ----------
    const [localModels, setLocalModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("ai_model") || "");
    const [modelsError, setModelsError] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({ full_name: "", system_prompt: "", gemini_api_key: "", gemini_api_key_set: false, clear_gemini_api_key: false });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const [settingsNotice, setSettingsNotice] = useState("");

    const loadModels = async () => {
        try {
            const { data } = await api.get("/ai/models");
            const names = (data.models || []).filter((m) => typeof m === "string");
            setLocalModels(names);
            setModelsError(names.length ? "" : "No models found. Configure Ollama or GEMINI_API_KEY.");
            // keep the saved choice if it's still installed, otherwise fall back to the default
            setSelectedModel((cur) => (names.includes(cur) ? cur : data.default || ""));
        } catch {
            setLocalModels([]);
            setModelsError("Can't load models. Check Ollama or the backend configuration.");
        }
    };

    // Rescan installed models whenever the panel opens
    useEffect(() => {
        if (open) loadModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Remember the choice across reloads
    useEffect(() => {
        if (selectedModel) localStorage.setItem("ai_model", selectedModel);
    }, [selectedModel]);

    const openSettings = async () => {
        setSettingsOpen(true);
        setHistoryOpen(false);
        setSettingsError("");
        setSettingsNotice("");
        try {
            const { data } = await api.get("/me", { headers: authHeaders() });
            setSettings((current) => ({ ...current, ...data, gemini_api_key: "", clear_gemini_api_key: false }));
        } catch (err) {
            if (handleAuthError(err)) return;
            setSettingsError("Couldn't load your settings.");
        }
    };

    useEffect(() => {
        if (settingsRequest) openSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsRequest]);

    const saveSettings = async (event) => {
        event.preventDefault();
        setSettingsSaving(true);
        setSettingsError("");
        setSettingsNotice("");
        try {
            await api.put("/me", {
                full_name: settings.full_name,
                system_prompt: settings.system_prompt,
                ...(settings.gemini_api_key.trim() ? { gemini_api_key: settings.gemini_api_key.trim() } : {}),
                clear_gemini_api_key: settings.clear_gemini_api_key,
            }, { headers: authHeaders() });
            setSettings((current) => ({
                ...current,
                gemini_api_key: "",
                gemini_api_key_set: current.clear_gemini_api_key ? false : (current.gemini_api_key.trim() ? true : current.gemini_api_key_set),
                clear_gemini_api_key: false,
            }));
            setSettingsNotice("Settings saved.");
            loadModels();
        } catch (err) {
            if (handleAuthError(err)) return;
            setSettingsError(err.message || "Couldn't save your settings.");
        } finally {
            setSettingsSaving(false);
        }
    };

    const deleteAccount = () => setConfirmState({
        title: "Delete your account?",
        body: "This permanently deletes your account, saved API key and all chats. This can't be undone.",
        confirmLabel: "Delete account",
        onConfirm: async () => {
            try {
                await api.delete("/me", { headers: authHeaders() });
                clearToken();
                setSettingsOpen(false);
                aiPanel.close();
                onNavigate("/login");
            } catch (err) {
                if (handleAuthError(err)) return;
                setSettingsError(err.message || "Couldn't delete your account.");
            }
        },
    });

    const logout = () => {
        clearToken();
        setSettingsOpen(false);
        aiPanel.close();
        onNavigate("/login");
    };

    const copyMessage = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // fallback for non-secure origins
            const ta = document.createElement("textarea");
            ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
        }
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 1500);
    };

    const handleAuthError = (err) => {
        if (err.response?.status !== 401) return false;
        clearToken();
        aiPanel.close();
        onNavigate("/login");
        return true;
    };

    // Load chats the first time the panel is opened
    useEffect(() => {
        if (!open || loaded.current) return;
        if (!getToken()) { aiPanel.close(); onNavigate("/login"); return; }
        loaded.current = true;
        api.get("/chats", { headers: authHeaders() }).then(({ data }) => {
            const saved = data.chats || [];
            if (saved.length) { setChats(saved); setActiveId(saved[0].id); }
        }).catch((err) => {
            if (handleAuthError(err)) return;
            loaded.current = false; // allow retry on next open
            setError("Couldn't load your chats. Is the backend running?");
        }).finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Esc closes the top-most layer first (confirm > settings > history > panel)
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            if (confirmState) setConfirmState(null);
            else if (settingsOpen) setSettingsOpen(false);
            else if (historyOpen) setHistoryOpen(false);
            else aiPanel.close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, confirmState, settingsOpen, historyOpen]);

    // Focus the composer when the panel opens
    useEffect(() => { if (open) textareaRef.current?.focus(); }, [open]);

    // Open (or reuse) a chat when the page sends context
    useEffect(() => {
        if (!open || isLoading || !aiContext || handledCtx.current === aiContext.nonce) return;
        handledCtx.current = aiContext.nonce;
        const existing = ctxChatId.current[aiContext.id];
        if (existing && chats.some((c) => c.id === existing)) {
            setActiveId(existing); setCtxByChat((p) => ({ ...p, [existing]: aiContext }));
            setHistoryOpen(false); return;
        }
        const chat = {
            ...newChat(),
            title: aiContext.title || "Model comparison",
            messages: [{ role: "assistant", content: aiContext.greeting, ts: Date.now() }],
        };
        ctxChatId.current[aiContext.id] = chat.id;
        dirty.current.add(chat.id);
        setChats((prev) => [chat, ...prev]);
        setActiveId(chat.id);
        setCtxByChat((p) => ({ ...p, [chat.id]: aiContext }));
        setHistoryOpen(false); setError("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isLoading, aiContext]);

    // Save changed chats after a reply has finished streaming
    useEffect(() => {
        if (isSending || isLoading) return;
        chats.forEach((chat) => {
            if (!dirty.current.has(chat.id) || chat.messages.length === 0) return;
            dirty.current.delete(chat.id);
            const payload = { ...chat, messages: chat.messages.filter((m) => m.role === "user" || m.content) };
            api.put(`/chats/${chat.id}`, payload, { headers: authHeaders() }).catch((err) => {
                if (handleAuthError(err)) return;
                dirty.current.add(chat.id);
                setError("Couldn't save this chat to your account.");
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chats, isSending, isLoading]);

    // Follow the stream only while the reader is at the bottom
    const lastLen = activeChat?.messages.at(-1)?.content?.length || 0;
    useEffect(() => { stick.current = true; }, [activeChat?.id, open]);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !stick.current) return;
        el.scrollTo({ top: el.scrollHeight, behavior: isSending ? "auto" : "smooth" });
    }, [activeChat?.id, activeChat?.messages.length, lastLen, isSending, open]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        stick.current = near;
        setShowJump(!near);
    };

    const jumpToLatest = () => {
        stick.current = true;
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, [input]);

    const filteredChats = useMemo(() => {
        const q = search.trim().toLowerCase();
        const sorted = [...chats]
            .filter((c) => c.messages.length > 0 || c.id === activeChat?.id)
            .sort((a, b) => b.updatedAt - a.updatedAt);
        return q ? sorted.filter((c) => c.title.toLowerCase().includes(q)) : sorted;
    }, [chats, search, activeChat?.id]);

    const groupedChats = useMemo(() => {
        const groups = [];
        filteredChats.forEach((c) => {
            const label = groupLabel(c.updatedAt);
            const g = groups.at(-1);
            if (g && g.label === label) g.items.push(c);
            else groups.push({ label, items: [c] });
        });
        return groups;
    }, [filteredChats]);

    const updateChat = (id, updater) => {
        dirty.current.add(id);
        setChats((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    };

    const startNewChat = () => {
        const empty = chats.find((c) => c.messages.length === 0);
        if (empty) setActiveId(empty.id);
        else {
            const chat = newChat();
            setChats((prev) => [chat, ...prev]);
            setActiveId(chat.id);
        }
        setError(""); setInput(""); setHistoryOpen(false); setSettingsOpen(false);
        textareaRef.current?.focus();
    };

    const selectChat = (id) => { setActiveId(id); setError(""); setHistoryOpen(false); };

    const deleteChat = (id) => {
        dirty.current.delete(id);
        if (chats.find((c) => c.id === id)?.messages.length) {
            api.delete(`/chats/${id}`, { headers: authHeaders() }).catch((err) => {
                if (handleAuthError(err)) return;
                setError("Couldn't delete that chat on the server.");
            });
        }
        const remaining = chats.filter((c) => c.id !== id);
        if (!remaining.length) {
            const fresh = newChat();
            setChats([fresh]); setActiveId(fresh.id);
        } else {
            setChats(remaining);
            if (id === activeId) setActiveId(remaining[0].id);
        }
    };

    const clearAll = () => setConfirmState({
        title: "Delete all chat history?",
        body: "Every saved conversation will be removed from your account. This can't be undone.",
        confirmLabel: "Delete all",
        onConfirm: () => {
            dirty.current.clear();
            api.delete("/chats", { headers: authHeaders() }).catch((err) => {
                if (handleAuthError(err)) return;
                setError("Couldn't clear your history on the server.");
            });
            const fresh = newChat();
            setChats([fresh]); setActiveId(fresh.id);
            setHistoryOpen(false);
        },
    });

    const addFiles = (list) => {
        if (!list.length) return;
        const supported = list.filter(isAccepted);
        const tooBig = supported.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
        const valid = supported.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
        const room = MAX_FILES - attachments.length;
        const accepted = valid.slice(0, Math.max(room, 0));
        if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(", ")} exceeds ${MAX_FILE_MB} MB.`);
        else if (valid.length > room) setError(`You can attach up to ${MAX_FILES} files per message.`);
        else if (supported.length < list.length) setError("Only images, CSV, JSON, TXT and MD files are supported.");
        else setError("");
        setAttachments((prev) => [
            ...prev,
            ...accepted.map((file) => ({
                id: crypto.randomUUID(),
                file,
                previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
            })),
        ]);
    };

    const handleFilesChosen = (event) => {
        const chosen = Array.from(event.target.files || []);
        event.target.value = "";
        addFiles(chosen);
    };

    const handlePaste = (event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        event.preventDefault();
        addFiles(files);
    };

    const removeAttachment = (id) => {
        setAttachments((prev) => {
            const target = prev.find((a) => a.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((a) => a.id !== id);
        });
    };

    const stopReply = () => abortRef.current?.abort();

    const runReply = async ({ chatId, text, history, files }) => {
        setError(""); setIsSending(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const baseURL = (api.defaults?.baseURL || "http://localhost:8000").replace(/\/$/, "");
            const form = new FormData();
            form.append("message", text);
            form.append("history", JSON.stringify(history));
            if (selectedModel) form.append("model", selectedModel);
            const ctx = ctxByChat[chatId];
            if (ctx) form.append("context", ctx.text);
            files.forEach((file) => form.append("files", file));

            const res = await fetch(`${baseURL}/chat`, { method: "POST", headers: authHeaders(), body: form, signal: controller.signal });
            if (res.status === 401) {
                clearToken();
                aiPanel.close();
                onNavigate("/login");
                throw new Error("Session expired. Please log in again.");
            }
            if (!res.ok) {
                let detail = "";
                try { detail = (await res.json()).detail; } catch { /* body wasn't JSON */ }
                throw new Error(typeof detail === "string" && detail ? detail : `Request failed (${res.status})`);
            }
            if (!res.body) throw new Error("Empty response from server.");

            updateChat(chatId, (c) => ({
                ...c,
                messages: [...c.messages, { role: "assistant", content: "", ts: Date.now() }],
            }));

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let reply = "";
            const handleEvent = (evt) => {
                const dataLines = evt.split(/\r?\n/)
                    .filter((item) => item.startsWith("data:"))
                    .map((item) => item.slice(5).trim())
                    .filter(Boolean);
                const rawEvents = dataLines.length ? dataLines : [evt.trim()];
                rawEvents.forEach((raw) => {
                    if (!raw || raw === "[DONE]") return;
                    const parsed = JSON.parse(raw);
                    if (parsed.error) throw new Error(parsed.error);
                    if (!parsed.t) return;
                    reply += parsed.t;
                    const snapshot = reply;
                    updateChat(chatId, (c) => ({
                        ...c,
                        messages: c.messages.map((m, i) => (i === c.messages.length - 1 ? { ...m, content: snapshot } : m)),
                        updatedAt: Date.now(),
                    }));
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split(/\r?\n\r?\n/);
                buffer = events.pop();
                events.forEach(handleEvent);
            }
            buffer += decoder.decode();
            if (buffer.trim()) handleEvent(buffer);
        } catch (err) {
            // keep whatever streamed before a manual stop; drop only empty placeholders
            updateChat(chatId, (c) => ({
                ...c,
                messages: c.messages.filter((m) => !(m.role === "assistant" && m.content === "")),
            }));
            if (err.name !== "AbortError") setError(err.message || "Something went wrong. Try again.");
        } finally {
            abortRef.current = null;
            setIsSending(false);
        }
    };

    const sendMessage = () => {
        const text = input.trim();
        if ((!text && !attachments.length) || isSending || isLoading) return;
        const chatId = activeChat.id;
        const sentFiles = attachments;
        const userMsg = { role: "user", content: text, ts: Date.now(), attachments: sentFiles.map(({ file }) => ({ name: file.name, isImage: file.type.startsWith("image/") })) };
        const history = activeChat.messages.map(({ role, content }) => ({ role, content }));
        stick.current = true;
        updateChat(chatId, (c) => ({
            ...c,
            title: c.messages.length === 0 ? (text || sentFiles[0]?.file.name || "New chat").slice(0, 40) : c.title,
            messages: [...c.messages, userMsg],
            updatedAt: Date.now(),
        }));
        setInput("");
        sentFiles.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        setAttachments([]);
        runReply({ chatId, text, history, files: sentFiles.map(({ file }) => file) });
    };

    const regenerate = () => {
        if (isSending || isLoading) return;
        const msgs = activeChat.messages;
        const userIdx = msgs.length - 2;
        if (msgs.at(-1)?.role !== "assistant" || msgs[userIdx]?.role !== "user") return;
        const history = msgs.slice(0, userIdx).map(({ role, content }) => ({ role, content }));
        updateChat(activeChat.id, (c) => ({ ...c, messages: c.messages.slice(0, -1) }));
        runReply({ chatId: activeChat.id, text: msgs[userIdx].content, history, files: [] });
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            sendMessage();
        }
    };

    const useSuggestion = (prompt) => {
        setInput(prompt);
        textareaRef.current?.focus();
    };

    const lastMsg = activeChat.messages.at(-1);
    const showThinking = isSending && (lastMsg?.role === "user" || !lastMsg?.content);
    const canSend = !isSending && !isLoading && (input.trim() || attachments.length);
    const ctx = ctxByChat[activeChat.id];

    return (
        <>
            {/* Backdrop on mobile only; on desktop the page stays usable behind the panel */}
            {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden" onClick={aiPanel.close} aria-hidden="true" />}
            <aside
                role="dialog"
                aria-label="AI assistant"
                aria-hidden={!open}
                className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#30363d] bg-[#0d1117] font-sans text-[#c9d1d9] shadow-2xl shadow-black/60 transition-[transform,visibility] duration-200 motion-reduce:transition-none md:w-[min(460px,45vw)] ${open ? "visible translate-x-0" : "invisible translate-x-full"}`}
            >
                {/* Header */}
                <header className="flex items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1f6feb]/30 bg-[#1f6feb]/15 text-[#58a6ff]">
                        <Icon name="sparkle" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold leading-tight text-[#e6edf3]">AI Assistant</h2>
                        <p className="truncate text-[11px] leading-tight text-[#8b949e]">{activeChat.title}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <IconButton icon="plus" label="New chat" onClick={startNewChat} />
                        <IconButton icon="history" label="Chat history" onClick={() => { setSettingsOpen(false); setHistoryOpen((v) => !v); }} active={historyOpen} />
                        <IconButton icon="settings" label="Settings" onClick={openSettings} active={settingsOpen} />
                        <IconButton icon="close" label="Close (Esc)" onClick={aiPanel.close} />
                    </div>
                </header>

                <div
                    className="relative flex min-h-0 flex-1 flex-col"
                    onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragging(true); } }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                >
                    {/* Drop overlay */}
                    {dragging && (
                        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#388bfd] bg-[#0d1117]/90 text-sm text-[#e6edf3]">
                            <Icon name="paperclip" size={22} className="text-[#58a6ff]" />
                            Drop files to attach
                        </div>
                    )}

                    {/* History overlay */}
                    {historyOpen && (
                        <div className="absolute inset-0 z-10 flex flex-col bg-[#0d1117]">
                            <div className="border-b border-[#30363d] p-3">
                                <div className="relative">
                                    <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7681]" />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search chats"
                                        aria-label="Search chats"
                                        className={`${field} !py-1.5 pl-8 text-xs`}
                                    />
                                </div>
                            </div>
                            <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#8a8a8a]" aria-label="Chat history">
                                {isLoading && (
                                    <div className="space-y-2 p-2" aria-hidden="true">
                                        {[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#161b22] motion-reduce:animate-none" />)}
                                    </div>
                                )}
                                {!isLoading && groupedChats.length === 0 && (
                                    <p className="p-4 text-center text-xs text-[#8b949e]">{search ? "No chats match your search." : "No conversations yet. Send a message to start one."}</p>
                                )}
                                {!isLoading && groupedChats.map((group) => (
                                    <section key={group.label}>
                                        <h3 className="px-3 pb-1 pt-3 text-[11px] font-medium text-[#8b949e]">{group.label}</h3>
                                        {group.items.map((chat) => {
                                            const isActive = chat.id === activeChat.id;
                                            return (
                                                <div key={chat.id} className={`group relative mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2 transition ${isActive ? "bg-[#1f6feb]/15" : "hover:bg-[#161b22]"}`}>
                                                    {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#388bfd]" />}
                                                    <button type="button" onClick={() => selectChat(chat.id)} className={`min-w-0 flex-1 rounded text-left ${focusRing}`} aria-current={isActive ? "true" : undefined}>
                                                        <p className="truncate text-sm text-[#e6edf3]">{chat.title}</p>
                                                        <p className="mt-0.5 text-[11px] text-[#8b949e]">
                                                            {formatTime(chat.updatedAt)}{chat.messages.length ? `, ${chat.messages.length} message${chat.messages.length === 1 ? "" : "s"}` : ""}
                                                        </p>
                                                    </button>
                                                    <button type="button" onClick={() => deleteChat(chat.id)} aria-label={`Delete chat ${chat.title}`}
                                                        className={`shrink-0 rounded-md p-1.5 text-[#8b949e] transition hover:bg-[#f85149]/15 hover:text-[#ff7b72] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 ${focusRing}`}>
                                                        <Icon name="trash" size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </section>
                                ))}
                            </nav>
                            <div className="border-t border-[#30363d] p-3">
                                <button type="button" onClick={clearAll} className={`w-full rounded-lg border border-[#f85149]/40 px-3 py-2 text-xs font-medium text-[#ff7b72] transition hover:bg-[#f85149]/10 ${focusRing}`}>
                                    Clear all history
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Settings overlay */}
                    {settingsOpen && (
                        <div className="absolute inset-0 z-20 flex flex-col bg-[#0d1117]">
                            <div className="flex items-center gap-2 border-b border-[#30363d] px-3 py-2.5">
                                <IconButton icon="arrowLeft" label="Back to chat" onClick={() => setSettingsOpen(false)} />
                                <div>
                                    <h3 className="text-sm font-semibold leading-tight text-[#e6edf3]">Settings</h3>
                                    <p className="text-[11px] leading-tight text-[#8b949e]">Personalize the assistant and manage your account.</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[#8a8a8a]">
                                <form onSubmit={saveSettings} className="space-y-5">
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-[#e6edf3]">Display name</span>
                                        <input
                                            value={settings.full_name || ""}
                                            onChange={(e) => setSettings((current) => ({ ...current, full_name: e.target.value }))}
                                            placeholder="How should the assistant address you?"
                                            maxLength={80}
                                            className={field}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-[#e6edf3]">
                                            Assistant instruction
                                            <span className="font-normal text-[#6e7681]">{(settings.system_prompt || "").length}/4000</span>
                                        </span>
                                        <textarea
                                            value={settings.system_prompt || ""}
                                            onChange={(e) => setSettings((current) => ({ ...current, system_prompt: e.target.value }))}
                                            rows={5}
                                            maxLength={4000}
                                            placeholder="Example: Explain concepts like a patient tutor."
                                            className={`${field} resize-y`}
                                        />
                                        <span className="mt-1 block text-[11px] text-[#8b949e]">Applied to every new reply you request.</span>
                                    </label>
                                    <div>
                                        <label className="block">
                                            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#e6edf3]">
                                                Your Gemini API key
                                                {settings.gemini_api_key_set && !settings.clear_gemini_api_key && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#238636]/15 px-2 py-0.5 text-[11px] font-medium text-[#3fb950]">
                                                        <Icon name="check" size={11} /> Saved
                                                    </span>
                                                )}
                                            </span>
                                            <input
                                                type="password"
                                                value={settings.gemini_api_key}
                                                onChange={(e) => setSettings((current) => ({ ...current, gemini_api_key: e.target.value, clear_gemini_api_key: false }))}
                                                placeholder={settings.gemini_api_key_set ? "Enter a new key to replace the saved one" : "Paste your Gemini API key"}
                                                autoComplete="new-password"
                                                className={field}
                                            />
                                            <span className="mt-1 block text-[11px] text-[#8b949e]">Stored on the backend and never displayed.</span>
                                        </label>
                                        {settings.gemini_api_key_set && (
                                            <label className="mt-2 flex items-center gap-2 text-xs text-[#c9d1d9]">
                                                <input
                                                    type="checkbox"
                                                    className="accent-[#388bfd]"
                                                    checked={settings.clear_gemini_api_key}
                                                    onChange={(e) => setSettings((current) => ({ ...current, clear_gemini_api_key: e.target.checked }))}
                                                />
                                                Remove my saved Gemini key
                                            </label>
                                        )}
                                    </div>
                                    {settingsError && <p role="alert" className="text-xs text-[#ff7b72]">{settingsError}</p>}
                                    {settingsNotice && <p role="status" className="text-xs text-[#3fb950]">{settingsNotice}</p>}
                                    <button type="submit" disabled={settingsSaving} className={`w-full rounded-lg bg-[#238636] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:opacity-50 ${focusRing}`}>
                                        {settingsSaving ? "Saving..." : "Save settings"}
                                    </button>
                                </form>

                                <div className="mt-8 space-y-3 border-t border-[#30363d] pt-5">
                                    <h4 className="text-xs font-semibold text-[#e6edf3]">Account</h4>
                                    <button type="button" onClick={logout} className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-xs font-semibold text-[#c9d1d9] transition hover:bg-[#21262d] ${focusRing}`}>
                                        <Icon name="logout" size={14} /> Log out
                                    </button>
                                </div>
                                <div className="mt-5 rounded-lg border border-[#f85149]/30 p-3">
                                    <h4 className="text-xs font-semibold text-[#ff7b72]">Delete account</h4>
                                    <p className="mt-1 text-xs text-[#8b949e]">Permanently removes your account, API key and saved chats.</p>
                                    <button type="button" onClick={deleteAccount} className={`mt-3 rounded-lg border border-[#f85149]/60 px-3 py-1.5 text-xs font-medium text-[#ff7b72] transition hover:bg-[#f85149]/10 ${focusRing}`}>
                                        Delete account
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirm dialog */}
                    {confirmState && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmState(null)}>
                            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
                                className="w-full max-w-sm rounded-xl border border-[#30363d] bg-[#161b22] p-4 shadow-2xl shadow-black/60"
                                onClick={(e) => e.stopPropagation()}>
                                <h3 id="confirm-title" className="text-sm font-semibold text-[#e6edf3]">{confirmState.title}</h3>
                                <p id="confirm-body" className="mt-1.5 text-xs leading-5 text-[#8b949e]">{confirmState.body}</p>
                                <div className="mt-4 flex justify-end gap-2">
                                    <button type="button" autoFocus onClick={() => setConfirmState(null)} className={`rounded-lg border border-[#30363d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition hover:bg-[#21262d] ${focusRing}`}>Cancel</button>
                                    <button type="button" onClick={() => { const run = confirmState.onConfirm; setConfirmState(null); run(); }} className={`rounded-lg bg-[#da3633] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#f85149] ${focusRing}`}>
                                        {confirmState.confirmLabel}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto scroll-smooth px-4 py-4 scrollbar-thin scrollbar-thumb-[#8a8a8a]">
                        <div className="flex min-h-full flex-col gap-5">
                            {activeChat.messages.length === 0 && (
                                <div className="my-auto py-6">
                                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#1f6feb]/30 bg-[#1f6feb]/15 text-[#58a6ff]">
                                        <Icon name="sparkle" size={22} />
                                    </div>
                                    <h3 className="text-center text-base font-semibold text-[#e6edf3]">What are you working on?</h3>
                                    <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-5 text-[#8b949e]">
                                        Ask about your data, a model choice or an error in your pipeline. Attach a CSV or screenshot for more context.
                                    </p>
                                    <div className="mt-5 grid gap-2">
                                        {SUGGESTIONS.map((s) => (
                                            <button key={s.label} type="button" onClick={() => useSuggestion(s.prompt)}
                                                className={`flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2.5 text-left text-sm text-[#c9d1d9] transition hover:border-[#388bfd]/60 hover:bg-[#1c2128] ${focusRing}`}>
                                                <Icon name={s.icon} size={15} className="shrink-0 text-[#8b949e]" />
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeChat.messages.map((msg, i) => {
                                const isUser = msg.role === "user";
                                if (!isUser && !msg.content) return null;
                                const isLast = i === activeChat.messages.length - 1;
                                const streaming = isSending && isLast && !isUser;

                                if (isUser) {
                                    return (
                                        <div key={i} className="flex flex-col items-end gap-1.5">
                                            {msg.attachments?.length > 0 && (
                                                <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
                                                    {msg.attachments.map((a, j) => (
                                                        <span key={j} className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-md border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs text-[#8b949e]">
                                                            <Icon name={a.isImage ? "image" : "file"} size={12} className="shrink-0" />
                                                            <span className="truncate">{a.name}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.content && (
                                                <div className="max-w-[88%] rounded-2xl rounded-br-md border border-[#30363d] bg-[#1c2128] px-3.5 py-2 text-sm leading-6 text-[#e6edf3]">
                                                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                const key = `${activeChat.id}-${i}`;
                                const prev = activeChat.messages[i - 1];
                                const canRegenerate = isLast && prev?.role === "user" && prev.content && !prev.attachments?.length;
                                return (
                                    <div key={i} className="group flex gap-3">
                                        <Avatar />
                                        <div className="min-w-0 flex-1 text-sm leading-6 text-[#c9d1d9]">
                                            {parseBlocks(msg.content).map((b, n) => b.type === "code"
                                                ? <CodeBlock key={n} lang={b.lang} code={b.content} closed={b.closed} canInsert={!!insertHandler} onInsert={insertHandler} />
                                                : b.content.trim() && <Markdown key={n} text={b.content.trim()} />)}
                                            {streaming && <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-[7px] animate-pulse rounded-sm bg-[#58a6ff] align-middle motion-reduce:animate-none" />}
                                            {!streaming && (
                                                <div className={`mt-1.5 flex items-center gap-0.5 transition-opacity focus-within:opacity-100 ${isLast ? "" : "md:opacity-0 md:group-hover:opacity-100"}`}>
                                                    <button type="button" onClick={() => copyMessage(msg.content, key)} className={iconBtn} title={copiedKey === key ? "Copied" : "Copy"} aria-label="Copy response">
                                                        <Icon name={copiedKey === key ? "check" : "copy"} size={14} className={copiedKey === key ? "text-[#3fb950]" : ""} />
                                                    </button>
                                                    {canRegenerate && (
                                                        <button type="button" onClick={regenerate} className={iconBtn} title="Regenerate" aria-label="Regenerate response">
                                                            <Icon name="refresh" size={14} />
                                                        </button>
                                                    )}
                                                    {msg.ts && <span className="ml-1.5 text-[11px] text-[#6e7681]">{formatTime(msg.ts)}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {showThinking && (
                                <div className="flex gap-3" role="status" aria-live="polite">
                                    <Avatar />
                                    <div className="flex items-center gap-1 pt-2.5">
                                        {[0, 1, 2].map((n) => (
                                            <span key={n} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8b949e] motion-reduce:animate-none" style={{ animationDelay: `${n * 120}ms` }} />
                                        ))}
                                        <span className="sr-only">Assistant is thinking</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Jump to latest */}
                    {showJump && (
                        <button type="button" onClick={jumpToLatest} aria-label="Scroll to latest message"
                            className={`absolute bottom-3 left-1/2 z-[5] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs text-[#c9d1d9] shadow-lg shadow-black/40 transition hover:bg-[#30363d] hover:text-white ${focusRing}`}>
                            <Icon name="arrowDown" size={12} /> Latest
                        </button>
                    )}
                </div>

                {/* Composer */}
                <div className="border-t border-[#30363d] bg-[#0d1117] px-3 pb-3 pt-2.5">
                    {ctx && (
                        <div className="mb-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#161b22] py-1 pl-2.5 pr-1.5 text-[11px] text-[#8b949e]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
                                Context: {ctx.label}
                                <button type="button" aria-label="Remove context" className={`rounded-full p-0.5 hover:bg-[#30363d] hover:text-white ${focusRing}`}
                                    onClick={() => setCtxByChat(({ [activeChat.id]: _, ...rest }) => rest)}>
                                    <Icon name="close" size={11} />
                                </button>
                            </span>
                        </div>
                    )}
                    {(error || modelsError) && (
                        <div role="alert" className="mb-2 flex items-start gap-2 rounded-lg border border-[#f85149]/30 bg-[#f85149]/10 px-3 py-2 text-xs leading-5 text-[#ffa198]">
                            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 flex-1">{error || modelsError}</span>
                            {error && (
                                <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className={`rounded p-0.5 hover:bg-[#f85149]/20 ${focusRing}`}>
                                    <Icon name="close" size={12} />
                                </button>
                            )}
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={handleFilesChosen} />
                    {attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {attachments.map(({ id, file, previewUrl }) => (
                                <div key={id} className="relative flex max-w-[11rem] items-center gap-2 rounded-lg border border-[#30363d] bg-[#161b22] p-1.5 pr-7">
                                    {previewUrl
                                        ? <img src={previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                                        : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#21262d] text-[#8b949e]"><Icon name="file" size={15} /></span>}
                                    <span className="truncate text-xs text-[#c9d1d9]" title={file.name}>{file.name}</span>
                                    <button type="button" onClick={() => removeAttachment(id)} aria-label={`Remove ${file.name}`} className={`absolute right-1 top-1 rounded p-0.5 text-[#8b949e] transition hover:bg-[#f85149]/20 hover:text-[#ff7b72] ${focusRing}`}>
                                        <Icon name="close" size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="rounded-xl border border-[#30363d] bg-[#010409] transition focus-within:border-[#388bfd] focus-within:ring-2 focus-within:ring-[#388bfd]/20">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            rows={1}
                            placeholder="Message the assistant"
                            aria-label="Chat message"
                            className="block max-h-[140px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm leading-6 text-[#c9d1d9] outline-none placeholder:text-[#6e7681]"
                        />
                        <div className="flex items-center gap-1 px-2 pb-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending || isLoading || attachments.length >= MAX_FILES}
                                aria-label="Attach files or images"
                                title={`Attach files (up to ${MAX_FILES}, ${MAX_FILE_MB} MB each)`}
                                className={`${iconBtn} disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                                <Icon name="paperclip" size={16} />
                            </button>

                            <div className="relative min-w-0">
                                <label htmlFor="ai-model-select" className="sr-only">AI model</label>
                                <select
                                    id="ai-model-select"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    onFocus={loadModels}
                                    disabled={isSending || isLoading || !localModels.length}
                                    title={modelsError || selectedModel || "AI model"}
                                    className={`h-8 w-full max-w-[13rem] cursor-pointer appearance-none truncate rounded-md bg-transparent py-1 pl-2 pr-6 text-xs text-[#8b949e] transition hover:bg-[#21262d] hover:text-[#c9d1d9] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                                >
                                    {!localModels.length && <option value="">No models</option>}
                                    {localModels.map((m) => (
                                        <option key={m} value={m} className="bg-[#21262d] text-[#c9d1d9]">
                                            {m.startsWith("gemini:") ? `Gemini (${m.slice(7)})` : m}
                                        </option>
                                    ))}
                                </select>
                                <Icon name="chevron" size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6e7681]" />
                            </div>

                            <span className="flex-1" />

                            {isSending ? (
                                <button type="button" onClick={stopReply} aria-label="Stop generating" title="Stop generating"
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#30363d] bg-[#21262d] text-white transition hover:bg-[#30363d] ${focusRing}`}>
                                    <Icon name="stop" size={14} fill />
                                </button>
                            ) : (
                                <button type="button" onClick={sendMessage} disabled={!canSend} aria-label="Send message" title="Send (Enter)"
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#238636] text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:bg-[#21262d] disabled:text-[#6e7681] ${focusRing}`}>
                                    <Icon name="send" size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}