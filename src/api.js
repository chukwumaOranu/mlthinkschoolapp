import axios from "axios";

const AUTH_STORAGE_KEY = "thinkschool_auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api",
});

export function resolveApiAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const apiRoot = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "/");
  return new URL(path, apiRoot).toString();
}

export function getStoredAuth() {
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function storeAuth(payload) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

export function clearStoredAuth() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

api.interceptors.request.use((config) => {
  const auth = getStoredAuth();
  if (auth?.access_token) {
    config.headers.Authorization = `Bearer ${auth.access_token}`;
  }
  return config;
});

export default api;
