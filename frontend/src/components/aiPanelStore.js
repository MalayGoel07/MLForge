import { useSyncExternalStore } from "react";

let isOpen = false;
let context = null;
let insertHandler = null; // set by the page that can receive code (the notebook)
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const aiPanel = {
    open: () => { isOpen = true; emit(); },
    close: () => { isOpen = false; emit(); },
    toggle: () => { isOpen = !isOpen; emit(); },
    openWithContext: (ctx) => { context = { ...ctx, nonce: Date.now() }; isOpen = true; emit(); },
    setInsertHandler: (fn) => { insertHandler = fn; emit(); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    get: () => isOpen,
    getContext: () => context,
    getInsertHandler: () => insertHandler,
};

export const useAIPanelOpen = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.get);
export const useAIContext = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getContext);
export const useInsertHandler = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getInsertHandler);