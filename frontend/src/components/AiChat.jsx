import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import { authHeaders, clearToken, getToken } from "../api/auth";
import ThemeButton from "./ThemeButton";

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const ACCEPTED = "image/*,.csv,.json,.txt,.md";

const newChat = () => ({
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
});

const formatTime = (ts) =>
    new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AIChat({ onNavigate, theme = "forest", onSelectTheme }) {
    const [chats, setChats] = useState(() => [newChat()]);
    const [activeId, setActiveId] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const dirty = useRef(new Set()); // ids of chats changed since their last save
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);

    const activeChat = useMemo(() => chats.find((c) => c.id === activeId) || chats[0], [chats, activeId]);

    const handleAuthError = (err) => {
        if (err.response?.status !== 401) return false;
        clearToken();
        onNavigate("/login");
        return true;
    };

    // Load this user's chats from the database
    useEffect(() => {
        if (!getToken()) { onNavigate("/login"); return; }
        let cancelled = false;
        api.get("/chats", { headers: authHeaders() })
            .then(({ data }) => {
                if (cancelled) return;
                const saved = data.chats || [];
                if (saved.length) { setChats(saved); setActiveId(saved[0].id); }
            })
            .catch((err) => {
                if (cancelled || handleAuthError(err)) return;
                setError("Couldn't load your chats. Is the backend running?");
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save changed chats once a reply has finished streaming (never once per token)
    useEffect(() => {
        if (isSending || isLoading) return;
        chats.forEach((chat) => {
            if (!dirty.current.has(chat.id) || chat.messages.length === 0) return;
            dirty.current.delete(chat.id);
            const payload = { ...chat, messages: chat.messages.filter((m) => m.role === "user" || m.content) };
            api.put(`/chats/${chat.id}`, payload, { headers: authHeaders() }).catch((err) => {
                if (handleAuthError(err)) return;
                dirty.current.add(chat.id); // retry on the next change
                setError("Couldn't save this chat to your account.");
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chats, isSending, isLoading]);

    // Keep latest message in view
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeChat?.messages.length, isSending]);

    // Auto-grow textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
        // Reuse an existing empty chat instead of stacking blank ones
        const empty = chats.find((c) => c.messages.length === 0);
        if (empty) {
            setActiveId(empty.id);
        } else {
            const chat = newChat();
            setChats((prev) => [chat, ...prev]);
            setActiveId(chat.id);
        }
        setError(""); setInput(""); setSidebarOpen(false);
    };

    const selectChat = (id) => {
        setActiveId(id); setError(""); setSidebarOpen(false);
    };

    const deleteChat = (id) => {
        dirty.current.delete(id);
        // Empty chats were never saved, so there is nothing to delete server-side
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
        event.target.value = ""; // allow re-picking the same file
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

    const sendMessage = async () => {
        const text = input.trim();
        if ((!text && !attachments.length) || isSending || isLoading) return;

        const chatId = activeChat.id;
        const sentFiles = attachments;
        const userMsg = {
            role: "user",
            content: text,
            ts: Date.now(),
            attachments: sentFiles.map(({ file }) => ({ name: file.name, isImage: file.type.startsWith("image/") })),
        };
        const history = activeChat.messages.map(({ role, content }) => ({ role, content }));

        updateChat(chatId, (c) => ({
            ...c,
            title: c.messages.length === 0 ? (text || sentFiles[0]?.file.name || "New chat").slice(0, 40) : c.title,
            messages: [...c.messages, userMsg],
            updatedAt: Date.now(),
        }));
        setInput(""); setError(""); setIsSending(true);
        sentFiles.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        setAttachments([]);

        try {
            // Always multipart so text-only and file messages share one route.
            // axios can't read a stream in the browser, so this uses fetch.
            const baseURL = (api.defaults?.baseURL || "http://localhost:8000").replace(/\/$/, "");
            const form = new FormData();
            form.append("message", text);
            form.append("history", JSON.stringify(history));
            sentFiles.forEach(({ file }) => form.append("files", file));

            const res = await fetch(`${baseURL}/chat`, { method: "POST", headers: authHeaders(), body: form });
            if (res.status === 401) {
                clearToken();
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

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="t-page page-no-overscroll flex h-screen overflow-hidden overscroll-none font-mono">
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
            )}

            {/* Sidebar: chat history */}
            <aside
                className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[#243724] bg-[#0e140e] transition-transform md:static md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                aria-label="Chat history"
            >
                <div className="border-b border-[#243724] p-4">
                    <p className="t-accent mb-3 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <button
                        type="button"
                        onClick={startNewChat}
                        className="w-full rounded-lg border border-[#618c61] bg-[#172617] px-4 py-2 text-sm text-[#d4e6d5] transition hover:bg-[#1f331f] hover:text-white"
                    >
                        + New chat
                    </button>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chats..."
                        aria-label="Search chats"
                        className="mt-3 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-xs text-[#d4e6d5] outline-none transition placeholder:text-gray-600 focus:border-[#7aa88a]"
                    />
                </div>

                <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#7aa88a]">
                    {isLoading && <p className="p-3 text-xs text-gray-500">Loading chats...</p>}
                    {!isLoading && filteredChats.length === 0 && (
                        <p className="p-3 text-xs text-gray-500">No chats match your search.</p>
                    )}
                    {(isLoading ? [] : filteredChats).map((chat) => {
                        const isActive = chat.id === activeChat.id;
                        return (
                            <div
                                key={chat.id}
                                className={`group mb-1 flex items-center gap-2 rounded-lg border px-3 py-2 transition ${isActive ? "border-[#618c61] bg-[#172617]" : "border-transparent hover:border-[#243724] hover:bg-[#101a10]"}`}
                            >
                                <button type="button" onClick={() => selectChat(chat.id)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm text-[#d4e6d5]">{chat.title}</p>
                                    <p className="mt-0.5 text-[10px] text-gray-500">{formatTime(chat.updatedAt)}</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deleteChat(chat.id)}
                                    aria-label={`Delete chat ${chat.title}`}
                                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-500 transition hover:bg-red-600/20 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                </nav>

                <div className="border-t border-[#243724] p-3">
                    <button
                        type="button"
                        onClick={clearAll}
                        className="w-full rounded-lg border border-red-600/60 bg-red-600/10 px-3 py-2 text-xs text-red-300 transition hover:bg-red-600/30"
                    >
                        Clear all history
                    </button>
                </div>
            </aside>

            {/* Main chat column */}
            <section className="flex min-w-0 flex-1 flex-col">
                <header className="t-card-line flex items-center justify-between gap-3 border-b px-4 py-3 md:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open chat history"
                            className="rounded-lg border border-[#243724] px-3 py-2 text-sm text-[#adc9ae] transition hover:border-[#618c61] md:hidden"
                        >
                            ☰
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold tracking-tight md:text-2xl">AI Chat</h1>
                            <p className="truncate text-xs text-gray-500">{activeChat.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeButton theme={theme} onSelect={onSelectTheme} />
                        <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth md:px-8">
                    <div className="mx-auto flex max-w-3xl flex-col gap-4">
                        {activeChat.messages.length === 0 && (
                            <div className="rounded-lg border border-dashed border-[#243724] p-6 text-sm text-gray-500">
                                Ask about your data, a model choice, or an error in your pipeline. Press Enter to send, Shift+Enter for a new line.
                            </div>
                        )}

                        {activeChat.messages.map((msg, i) => {
                            const isUser = msg.role === "user";
                            if (!isUser && !msg.content) return null;
                            return (
                                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-6 ${isUser ? "border-[#618c61] bg-[#172617] text-[#d4e6d5]" : "border-[#243724] bg-[#101a10] text-[#d4e6d5]"}`}
                                    >
                                        <p className="mb-1 text-[10px] uppercase tracking-wide text-[#adc9ae]">{isUser ? "You" : "Assistant"}</p>
                                        {msg.attachments?.length > 0 && (
                                            <div className="mb-2 flex flex-wrap gap-1.5">
                                                {msg.attachments.map((a, j) => (
                                                    <span key={j} className="max-w-[12rem] truncate rounded border border-[#243724] bg-[#0e140e] px-2 py-1 text-xs text-[#adc9ae]">
                                                        {a.isImage ? "🖼" : "📄"} {a.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                                    </div>
                                </div>
                            );
                        })}

                        {isSending && (activeChat.messages.at(-1)?.role === "user" || !activeChat.messages.at(-1)?.content) && (
                            <div className="flex justify-start">
                                <div className="rounded-xl border border-[#243724] bg-[#101a10] px-4 py-3 text-sm text-gray-400" role="status">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </div>

                {/* Composer */}
                <div className="border-t border-[#243724] px-4 py-4 md:px-8">
                    <div className="mx-auto max-w-3xl">
                        {error && <p role="alert" className="mb-2 text-sm text-red-400">{error}</p>}
                        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={handleFilesChosen} />
                        {attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {attachments.map(({ id, file, previewUrl }) => (
                                    <div key={id} className="relative flex max-w-[12rem] items-center gap-2 rounded-lg border border-[#243724] bg-[#101a10] p-1.5 pr-7">
                                        {previewUrl
                                            ? <img src={previewUrl} alt={file.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                                            : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#172617] text-lg">📄</span>}
                                        <span className="truncate text-xs text-[#d4e6d5]">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(id)}
                                            aria-label={`Remove ${file.name}`}
                                            className="absolute right-1 top-1 rounded px-1 text-xs text-gray-500 transition hover:bg-red-600/20 hover:text-red-300"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-end gap-3 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-3 focus-within:border-[#7aa88a]">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending || isLoading || attachments.length >= MAX_FILES}
                                aria-label="Attach files or images"
                                title="Attach files or images"
                                className="shrink-0 rounded-lg border border-[#618c61] bg-[#172617] px-3 py-2 text-sm text-[#d4e6d5] transition hover:bg-[#1f331f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                +
                            </button>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                placeholder="Message the assistant..."
                                aria-label="Chat message"
                                className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-6 text-[#d4e6d5] outline-none placeholder:text-gray-600"
                            />
                            <button
                                type="button"
                                onClick={sendMessage}
                                disabled={isSending || isLoading || (!input.trim() && !attachments.length)}
                                className="shrink-0 rounded-lg border border-red-500 bg-red-400/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSending ? "Sending..." : "Send"}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}