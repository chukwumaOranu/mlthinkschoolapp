import { create } from "zustand";
import api, { clearStoredAuth, getStoredAuth, storeAuth } from "../api";

const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  ready: false,
  setAuth(payload) {
    set({
      user: payload.user,
      accessToken: payload.access_token,
      ready: true,
    });
    storeAuth(payload);
  },
  clearAuth() {
    set({ user: null, accessToken: null, ready: true });
    clearStoredAuth();
  },
  async hydrateAuth() {
    const auth = getStoredAuth();
    if (!auth?.access_token) {
      set({ user: null, accessToken: null, ready: true });
      return;
    }

    try {
      const response = await api.get("/auth/me");
      const payload = { access_token: auth.access_token, user: response.data };
      storeAuth(payload);
      set({
        user: response.data,
        accessToken: auth.access_token,
        ready: true,
      });
    } catch {
      clearStoredAuth();
      set({ user: null, accessToken: null, ready: true });
    }
  },
}));

export default useAuthStore;
