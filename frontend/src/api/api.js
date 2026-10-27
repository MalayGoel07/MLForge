
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
import { getToken } from "./auth";

// Attach the bearer token to every outgoing request (like an axios request interceptor).
const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = {
  async get(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: authHeader(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {throw new Error(data.detail || `Request failed (${response.status})`);}
    return { data };
  },
  
  async post(path, body) {
    const isFormData = body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: isFormData ? authHeader() : { "Content-Type": "application/json", ...authHeader() },
      body: isFormData ? body : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {throw new Error(data.detail || `Request failed (${response.status})`);}
    return { data };
  },
};

export default api;
