import { useSyncExternalStore } from "react";

let isOpen = false;
let context = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const aiPanel = {
    open: () => { isOpen = true; emit(); },
    close: () => { isOpen = false; emit(); },
    toggle: () => { isOpen = !isOpen; emit(); },
    // Open the panel with a page's context: { id, title, label, greeting, text }
    openWithContext: (ctx) => { context = { ...ctx, nonce: Date.now() }; isOpen = true; emit(); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    get: () => isOpen,
    getContext: () => context,
};

export const useAIPanelOpen = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.get);
export const useAIContext = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getContext);