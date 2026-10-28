import { aiPanel, useAIPanelOpen } from "./aiPanelStore";
import { getToken } from "../api/auth";

export default function AIButton() {
    const open = useAIPanelOpen();
    if (!getToken()) return null;
    return (
        <button
            type="button"
            onClick={aiPanel.toggle}
            aria-pressed={open}
            aria-label="Toggle AI assistant"
            title="AI assistant"
            className={`inline-flex items-center gap-2 rounded-full border border-line bg-card-soft px-3 py-1.5 text-xs font-medium text-acc transition hover:opacity-80 ${open ? "ring-1 ring-current" : ""}`}
        >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M7.53 1.28a.75.75 0 0 1 .94 0l.5.4c.2.17.45.27.7.29l.64.05a.75.75 0 0 1 .69.69l.05.64c.02.25.12.5.29.7l.4.5a.75.75 0 0 1 0 .94l-.4.5c-.17.2-.27.45-.29.7l-.05.64a.75.75 0 0 1-.69.69l-.64.05c-.25.02-.5.12-.7.29l-.5.4a.75.75 0 0 1-.94 0l-.5-.4a1.5 1.5 0 0 0-.7-.29l-.64-.05a.75.75 0 0 1-.69-.69l-.05-.64a1.5 1.5 0 0 0-.29-.7l-.4-.5a.75.75 0 0 1 0-.94l.4-.5c.17-.2.27-.45.29-.7l.05-.64a.75.75 0 0 1 .69-.69l.64-.05c.25-.02.5-.12.7-.29l.5-.4ZM3 11.5a.5.5 0 0 1 .5.5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 .5-.5Z" />
            </svg>
            <span className="hidden sm:inline">Ask AI</span>
        </button>
    );
}