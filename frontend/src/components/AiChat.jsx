import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import { authHeaders, clearToken, getToken } from "../api/auth";
import { aiPanel, useAIPanelOpen, useAIContext, useInsertHandler } from "./aiPanelStore";

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const ACCEPTED = "image/*,.csv,.json,.txt,.md";

const newChat = () => ({ id: crypto.randomUUID(), title: "New chat", updatedAt: Date.now(), messages: [] });
const formatTime = (ts) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const iconBtn = "rounded-md p-1.5 text-[#8b949e] transition hover:bg-[#30363d] hover:text-white";

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
    const btn = "rounded px-2 py-0.5 text-[11px] text-[#8b949e] transition hover:bg-[#30363d] hover:text-white";
    return (
        <div className="my-2 overflow-hidden rounded-md border border-[#30363d] bg-[#010409]">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-1">
                <span className="text-[11px] text-[#8b949e]">{lang || "code"}</span>
                {closed && (
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={copy} className={btn}>{copied ? "Copied" : "Copy"}</button>
                        {canInsert && isPython && (
                            <button type="button" onClick={() => { onInsert(code); flash(setInserted); }} className={`${btn} !text-[#3fb950]`}>
                                {inserted ? "Inserted ✓" : "Insert into notebook"}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-5 text-[#e6edf3]"><code>{code}</code></pre>
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
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);
    const activeChat = useMemo(() => chats.find((c) => c.id === activeId) || chats[0], [chats, activeId]);
    const aiContext = useAIContext();
    const insertHandler = useInsertHandler();
    const [ctxByChat, setCtxByChat] = useState({});   // chatId -> context
    const ctxChatId = useRef({});                      // ctx.id -> chatId (reuse chat on re-click)
    const [copiedKey, setCopiedKey] = useState("");
    const handledCtx = useRef(0);

    // ---------- local model picker ----------
    const [localModels, setLocalModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("ai_model") || "");
    const [modelsError, setModelsError] = useState("");

    const loadModels = async () => {
        try {
            const { data } = await api.get("/ai/models");
            const names = (data.models || []).filter((m) => typeof m === "string");
            setLocalModels(names);
            setModelsError(names.length ? "" : "No local models found. Run: ollama pull <model>");
            // keep the saved choice if it's still installed, otherwise fall back to the default
            setSelectedModel((cur) => (names.includes(cur) ? cur : data.default || ""));
        } catch {
            setLocalModels([]);
            setModelsError("Can't reach Ollama. Is it running?");
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

    // Esc closes, focus composer on open
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") aiPanel.close(); };
        window.addEventListener("keydown", onKey);
        textareaRef.current?.focus();
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

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

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages.length, isSending, open]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, [input]);

    const filteredChats = useMemo(() => {
        const q = search.trim().toLowerCase();
        const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
        return q ? sorted.filter((c) => c.title.toLowerCase().includes(q)) : sorted;
    }, [chats, search]);

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
        setError(""); setInput(""); setHistoryOpen(false);
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

    const clearAll = () => {
        if (!window.confirm("Delete all chat history?")) return;
        dirty.current.clear();
        api.delete("/chats", { headers: authHeaders() }).catch((err) => {
            if (handleAuthError(err)) return;
            setError("Couldn't clear your history on the server.");
        });
        const fresh = newChat();
        setChats([fresh]); setActiveId(fresh.id);
    };

    const handleFilesChosen = (event) => {
        const chosen = Array.from(event.target.files || []);
        event.target.value = "";
        if (!chosen.length) return;
        const tooBig = chosen.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
        const valid = chosen.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
        const room = MAX_FILES - attachments.length;
        const accepted = valid.slice(0, Math.max(room, 0));
        if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(", ")} exceeds ${MAX_FILE_MB} MB.`);
        else if (valid.length > room) setError(`You can attach up to ${MAX_FILES} files per message.`);
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

    const removeAttachment = (id) => {
        setAttachments((prev) => {
            const target = prev.find((a) => a.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((a) => a.id !== id);
        });
    };

    const runReply = async ({ chatId, text, history, files }) => {
        setError(""); setIsSending(true);
        try {
            const baseURL = (api.defaults?.baseURL || "http://localhost:8000").replace(/\/$/, "");
            const form = new FormData();
            form.append("message", text);
            form.append("history", JSON.stringify(history));
            if (selectedModel) form.append("model", selectedModel);
            const ctx = ctxByChat[chatId];
            if (ctx) form.append("context", ctx.text);
            files.forEach((file) => form.append("files", file));

            const res = await fetch(`${baseURL}/chat`, { method: "POST", headers: authHeaders(), body: form });
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop();

                for (const evt of events) {
                    if (!evt.startsWith("data: ")) continue;
                    const raw = evt.slice(6);
                    if (raw === "[DONE]") continue;
                    const parsed = JSON.parse(raw);
                    if (parsed.error) throw new Error(parsed.error);
                    reply += parsed.t;
                    const snapshot = reply;
                    updateChat(chatId, (c) => ({
                        ...c,
                        messages: c.messages.map((m, i) => (i === c.messages.length - 1 ? { ...m, content: snapshot } : m)),
                        updatedAt: Date.now(),
                    }));
                }
            }
        } catch (err) {
            updateChat(chatId, (c) => ({
                ...c,
                messages: c.messages.filter((m) => !(m.role === "assistant" && m.content === "")),
            }));
            setError(err.message || "Something went wrong. Try again.");
        } finally {
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
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Backdrop on mobile only; on desktop the page stays usable behind the panel */}
            {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={aiPanel.close} aria-hidden="true" />}
            <aside
                role="dialog"
                aria-label="AI assistant"
                aria-hidden={!open}
                className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#30363d] bg-[#0d1117] font-sans text-[#c9d1d9] shadow-2xl shadow-black/60 transition-all duration-200 md:w-[min(440px,45vw)] ${open ? "visible translate-x-0" : "invisible translate-x-full"}`}
            >
                {/* Header */}
                <header className="flex items-center justify-between gap-2 border-b border-[#30363d] bg-[#161b22] px-3 py-2.5">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-[#e6edf3]">AI Assistant</h2>
                        <p className="truncate text-[11px] text-[#8b949e]">{activeChat.title}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button type="button" onClick={startNewChat} className={iconBtn} title="New chat" aria-label="New chat">
                            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M7.25 1.75a.75.75 0 0 1 1.5 0V7.25h5.5a.75.75 0 0 1 0 1.5H8.75v5.5a.75.75 0 0 1-1.5 0V8.75H1.75a.75.75 0 0 1 0-1.5h5.5V1.75Z" /></svg>
                        </button>
                        <button type="button" onClick={() => setHistoryOpen((v) => !v)} className={`${iconBtn} ${historyOpen ? "bg-[#30363d] text-white" : ""}`} title="Chat history" aria-label="Chat history" aria-pressed={historyOpen}>
                            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0ZM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm.75 4.75a.75.75 0 0 0-1.5 0v3.5c0 .2.08.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.94V4.75Z" /></svg>
                        </button>
                        <button type="button" onClick={aiPanel.close} className={iconBtn} title="Close (Esc)" aria-label="Close AI assistant">
                            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" /></svg>
                        </button>
                    </div>
                </header>

                <div className="relative flex min-h-0 flex-1 flex-col">
                    {/* History overlay */}
                    {historyOpen && (
                        <div className="absolute inset-0 z-10 flex flex-col bg-[#0d1117]">
                            <div className="border-b border-[#30363d] p-3">
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search chats..."
                                    aria-label="Search chats"
                                    className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-1.5 text-xs text-[#c9d1d9] outline-none placeholder:text-[#6e7681] focus:border-[#388bfd]"
                                />
                            </div>
                            <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#7aa88a]">
                                {isLoading && <p className="p-3 text-xs text-[#8b949e]">Loading chats...</p>}
                                {!isLoading && filteredChats.length === 0 && <p className="p-3 text-xs text-[#8b949e]">No chats match your search.</p>}
                                {(isLoading ? [] : filteredChats).map((chat) => {
                                    const isActive = chat.id === activeChat.id;
                                    return (
                                        <div key={chat.id} className={`group mb-1 flex items-center gap-2 rounded-md px-3 py-2 transition ${isActive ? "bg-[#1f6feb]/15" : "hover:bg-[#161b22]"}`}>
                                            <button type="button" onClick={() => selectChat(chat.id)} className="min-w-0 flex-1 text-left">
                                                <p className="truncate text-sm text-[#e6edf3]">{chat.title}</p>
                                                <p className="mt-0.5 text-[10px] text-[#8b949e]">{formatTime(chat.updatedAt)}</p>
                                            </button>
                                            <button type="button" onClick={() => deleteChat(chat.id)} aria-label={`Delete chat ${chat.title}`} className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[#8b949e] transition hover:bg-red-600/20 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">✕</button>
                                        </div>
                                    );
                                })}
                            </nav>
                            <div className="border-t border-[#30363d] p-3">
                                <button type="button" onClick={clearAll} className="w-full rounded-md border border-[#f85149]/40 px-3 py-1.5 text-xs text-[#f85149] transition hover:bg-[#f85149]/10">Clear all history</button>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
                        <div className="flex flex-col gap-4">
                            {activeChat.messages.length === 0 && (
                                <div className="rounded-md border border-[#30363d] bg-[#161b22] p-4 text-sm leading-6 text-[#8b949e]">
                                    <p className="font-semibold text-[#e6edf3]">How can I help?</p>
                                    <p className="mt-1">Ask about your data, a model choice, or an error in your pipeline. Enter to send, Shift+Enter for a new line.</p>
                                </div>
                            )}

                            {activeChat.messages.map((msg, i) => {
                                const isUser = msg.role === "user";
                                if (!isUser && !msg.content) return null;
                                return (
                                    <div key={i} className="text-sm leading-6">
                                        <p className="mb-1 text-xs font-semibold text-[#e6edf3]">{isUser ? "You" : "Assistant"}</p>
                                        <div className={isUser ? "rounded-md border border-[#30363d] bg-[#161b22] px-3 py-2" : "px-0.5"}>
                                            {msg.attachments?.length > 0 && (
                                                <div className="mb-2 flex flex-wrap gap-1.5">
                                                    {msg.attachments.map((a, j) => (
                                                        <span key={j} className="max-w-[12rem] truncate rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1 text-xs text-[#8b949e]">
                                                            {a.isImage ? "🖼" : "📄"} {a.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.content && (isUser
                                                ? <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                : parseBlocks(msg.content).map((b, k) => b.type === "code"
                                                    ? <CodeBlock key={k} lang={b.lang} code={b.content} closed={b.closed} canInsert={!!insertHandler} onInsert={insertHandler} />
                                                    : b.content.trim() && <p key={k} className="whitespace-pre-wrap break-words">{b.content.trim()}</p>))}
                                        </div>
                                        {!isUser && msg.content && !(isSending && i === activeChat.messages.length - 1) && (() => {
                                            const key = `${activeChat.id}-${i}`;
                                            const prev = activeChat.messages[i - 1];
                                            const canRegenerate = i === activeChat.messages.length - 1 && prev?.role === "user" && prev.content && !prev.attachments?.length;
                                            const btn = "rounded-md p-1 text-[#8b949e] transition hover:bg-[#30363d] hover:text-white";
                                            return (
                                                <div className="mt-1 flex items-center gap-0.5">
                                                    <button type="button" onClick={() => copyMessage(msg.content, key)} className={btn} title={copiedKey === key ? "Copied" : "Copy"} aria-label="Copy response">
                                                        {copiedKey === key
                                                            ? <svg viewBox="0 0 16 16" width="14" height="14" fill="#3fb950"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" /></svg>
                                                            : <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.78.78 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z M5 1.75C5 .78 5.78 0 6.75 0h7.5C15.22 0 16 .78 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" /></svg>}
                                                    </button>
                                                    {canRegenerate && (
                                                        <button type="button" onClick={regenerate} className={btn} title="Regenerate" aria-label="Regenerate response">
                                                            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}

                            {isSending && (activeChat.messages.at(-1)?.role === "user" || !activeChat.messages.at(-1)?.content) && (
                                <p className="animate-pulse text-xs text-[#8b949e]" role="status">Thinking...</p>
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </div>

                    {/* Composer */}
                    <div className="border-t border-[#30363d] bg-[#0d1117] p-3">
                        {ctxByChat[activeChat.id] && (
                            <div className="mb-2 flex items-center gap-2 text-[11px] text-[#8b949e]">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#161b22] px-2.5 py-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
                                    Context: {ctxByChat[activeChat.id].label}
                                    <button type="button" aria-label="Remove context" className="ml-1 hover:text-white"
                                        onClick={() => setCtxByChat(({ [activeChat.id]: _, ...rest }) => rest)}>✕</button>
                                </span>
                            </div>
                        )}
                        {(error || modelsError) && <p role="alert" className="mb-2 text-xs text-[#f85149]">{error || modelsError}</p>}
                        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={handleFilesChosen} />
                        {attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {attachments.map(({ id, file, previewUrl }) => (
                                    <div key={id} className="relative flex max-w-[11rem] items-center gap-2 rounded-md border border-[#30363d] bg-[#161b22] p-1.5 pr-6">
                                        {previewUrl
                                            ? <img src={previewUrl} alt={file.name} className="h-8 w-8 shrink-0 rounded object-cover" />
                                            : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#21262d] text-base">📄</span>}
                                        <span className="truncate text-xs text-[#c9d1d9]">{file.name}</span>
                                        <button type="button" onClick={() => removeAttachment(id)} aria-label={`Remove ${file.name}`} className="absolute right-1 top-1 rounded px-1 text-xs text-[#8b949e] transition hover:bg-red-600/20 hover:text-red-300">✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-end gap-2 rounded-md border border-[#30363d] bg-[#010409] p-2 focus-within:border-[#388bfd]">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending || isLoading || attachments.length >= MAX_FILES}
                                aria-label="Attach files or images"
                                title="Attach files or images"
                                className="shrink-0 rounded-md border border-[#30363d] bg-[#21262d] px-2.5 py-1.5 text-sm text-[#c9d1d9] transition hover:bg-[#30363d] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                +
                            </button>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                placeholder="Ask the assistant..."
                                aria-label="Chat message"
                                className="max-h-36 flex-1 resize-none bg-transparent py-1 text-sm leading-6 text-[#c9d1d9] outline-none placeholder:text-[#6e7681]"
                            />
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                onFocus={loadModels}
                                disabled={isSending || isLoading || !localModels.length}
                                title={modelsError || "Local model"}
                                aria-label="Local model"
                                className="max-w-[9rem] shrink-0 truncate rounded-md border border-[#30363d] bg-[#21262d] px-2 py-1.5 text-xs text-[#c9d1d9] transition hover:bg-[#30363d] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {!localModels.length && <option value="">No models</option>}
                                {localModels.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={sendMessage}
                                disabled={isSending || isLoading || (!input.trim() && !attachments.length)}
                                className="shrink-0 rounded-md bg-[#238636] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSending ? "..." : "Send"}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}