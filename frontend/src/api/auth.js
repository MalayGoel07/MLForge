// Place at src/api/auth.js
const TOKEN_KEY = "mlforge-token";

export const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
};

export const clearToken = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};

// For fetch() calls (e.g. the streaming chat). Don't set Content-Type yourself with FormData.
export const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};