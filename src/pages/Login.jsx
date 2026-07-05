import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../api";
import useAuthStore from "../store/authStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setAuth = useAuthStore((state) => state.setAuth);

  const loginMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/auth/login", payload);
      return response.data;
    },
    onSuccess: (payload) => {
      setAuth(payload);
    },
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <section className="login-showcase">
          <span className="hero-topline">Education Intelligence Platform</span>
          <h2>Student Performance Monitoring</h2>
          <p>
            A sharper dashboard for attendance, performance trends, and machine learning predictions needs a matching
            sign-in experience too.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <strong>Executive overview</strong>
              <span>Headline KPIs for attendance and academic performance.</span>
            </div>
            <div className="login-feature">
              <strong>Subject diagnostics</strong>
              <span>Comparative views to identify curriculum pressure points.</span>
            </div>
            <div className="login-feature">
              <strong>Prediction watchlist</strong>
              <span>Dropout risk, high performer, and improving student signals for intervention planning.</span>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div>
            <h2>Sign In</h2>
            <p className="login-hint">Live Streaming data for analytics.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginMutation.isError ? (
              <div className="login-error">
                {loginMutation.error.response?.data?.detail || "Unable to sign in with those credentials."}
              </div>
            ) : null}

            <button type="submit" className="primary-button">
              {loginMutation.isPending ? "Signing In..." : "Enter Dashboard"}
            </button>
          </form>

          <p className="login-hint">
            Login with your details: <strong>xxxx@thinkschoolapps.co.uk</strong> / <strong>Your Password</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
