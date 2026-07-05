import React, { useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import useAuthStore from "./store/authStore";

export default function App() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  if (!ready) {
    return <div className="app-loading">Loading secure workspace...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return <Dashboard user={user} onLogout={clearAuth} />;
}
