import { useSyncExternalStore } from "react";

let isOpen = false;
let settingsPanelOpen = false;
let context = null;
let insertHandler = null; // set by the page that can receive code (the notebook)
let settingsRequest = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const aiPanel = {
    open: () => { isOpen = true; settingsPanelOpen = false; emit(); },
    close: () => { isOpen = false; emit(); },
    toggle: () => { isOpen = !isOpen; settingsPanelOpen = false; emit(); },
    openSettings: () => { settingsRequest += 1; isOpen = true; settingsPanelOpen = false; emit(); },
    openWithContext: (ctx) => { context = { ...ctx, nonce: Date.now() }; isOpen = true; settingsPanelOpen = false; emit(); },
    setInsertHandler: (fn) => { insertHandler = fn; emit(); },
    openSettingsPanel: () => { isOpen = false; settingsPanelOpen = true; emit(); },
    closeSettingsPanel: () => { settingsPanelOpen = false; emit(); },
    toggleSettingsPanel: () => { if (settingsPanelOpen) { settingsPanelOpen = false; } else { isOpen = false; settingsPanelOpen = true; } emit(); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    get: () => isOpen,
    getContext: () => context,
    getInsertHandler: () => insertHandler,
    getSettingsRequest: () => settingsRequest,
    getSettingsPanelOpen: () => settingsPanelOpen,
};

export const useAIPanelOpen = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.get);
export const useAIContext = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getContext);
export const useInsertHandler = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getInsertHandler);
export const useSettingsRequest = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getSettingsRequest);
export const useSettingsPanelOpen = () => useSyncExternalStore(aiPanel.subscribe, aiPanel.getSettingsPanelOpen);