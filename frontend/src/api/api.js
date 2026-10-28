
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV
        ? "http://localhost:8000"
        : "https://mlforge-backend-dmqd.onrender.com");

import { getToken } from "./auth";

const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { throw new Error(data.detail || `Request failed (${response.status})`);}
  return { data };
};

const api = {defaults: { baseURL: API_BASE_URL,},
  async get(path, config = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      credentials: "include",
      headers: {
        ...authHeader(),
        ...(config.headers || {}),
      },
    });
    return parseResponse(response);
  },

  async post(path, body, headers = {}) {return this.request("POST", path, body, headers);},
  async put(path, body, config = {}) {const headers = config.headers || config;return api.request("PUT", path, body, headers);},
  async delete(path, config = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        ...authHeader(),
        ...(config.headers || {}),
      },
    });
    return parseResponse(response);
  },
  async request(method, path, body, headers = {}) {
    const isFormData = body instanceof FormData;
    const isUrlEncoded = body instanceof URLSearchParams;
    const requestHeaders = {
      ...authHeader(),
      ...(!isFormData && !isUrlEncoded
        ? { "Content-Type": "application/json" }
        : {}),
      ...(isUrlEncoded
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...headers,
    };
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: requestHeaders,
      ...(body !== undefined
        ? {
            body:
              isFormData || isUrlEncoded
                ? body
                : JSON.stringify(body),
          }
        : {}),
    });
    return parseResponse(response);
  },
};
export default api;
