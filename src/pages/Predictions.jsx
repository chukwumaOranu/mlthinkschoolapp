import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import PredictionTable from "../components/PredictionTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";

const VIEWS = [
  { key: "all",       label: "All Students",   endpoint: "/predictions" },
  { key: "dropout",   label: "Dropout Risk",   endpoint: "/predictions/dropout" },
  { key: "top",       label: "Top Performers", endpoint: "/predictions/top-performers" },
  { key: "improving", label: "Improving",      endpoint: "/predictions/improving" },
];

const VIEW_CONFIG = {
  dropout: {
    title: "Bottom 10 by Avg Score (Dropout Risk)",
    color: "#ef4444",
    dataKey: "latest_avg_score",
    label: "Avg Score",
    probKey: "dropout_risk_probability",
    probLabel: "Risk Prob",
    sortAsc: true,
  },
  top: {
    title: "Top 10 by Avg Score (High Performers)",
    color: "#10b981",
    dataKey: "latest_avg_score",
    label: "Avg Score",
    probKey: "high_performer_probability",
    probLabel: "Perf. Prob",
    sortAsc: false,
  },
  improving: {
    title: "Top 10 by Score Trend (Improving Students)",
    color: "#6366f1",
    dataKey: "score_trend",
    label: "Score Change",
    probKey: "improving_probability",
    probLabel: "Impr. Prob",
    sortAsc: false,
  },
};

function shorten(name) {
  if (!name) return "—";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function PredictionChart({ rows, view }) {
  const cfg = VIEW_CONFIG[view];
  if (!cfg) return null;

  const top10 = [...rows]
    .filter((r) => r[cfg.dataKey] != null)
    .sort((a, b) =>
      cfg.sortAsc
        ? a[cfg.dataKey] - b[cfg.dataKey]
        : b[cfg.dataKey] - a[cfg.dataKey]
    )
    .slice(0, 10)
    .map((r) => ({
      name: shorten(r.full_name),
      value: Number(r[cfg.dataKey]),
      prob: r[cfg.probKey] != null ? (r[cfg.probKey] * 100).toFixed(1) : null,
    }));

  if (top10.length === 0) return null;

  return (
    <div className="surface-card chart-card" style={{ marginBottom: "1.5rem" }}>
      <div className="section-heading" style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>
          {cfg.title}
        </h3>
      </div>
      <div className="chart-frame" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} margin={{ top: 8, right: 24, left: -18, bottom: 48 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              domain={view === "improving" ? ["auto", "auto"] : [0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: "0.83rem",
              }}
              formatter={(val, _name, props) => {
                const prob = props.payload?.prob;
                return [
                  prob != null
                    ? `${val} (${cfg.probLabel}: ${prob}%)`
                    : `${val}`,
                  cfg.label,
                ];
              }}
            />
            {view !== "improving" && (
              <>
                <ReferenceLine y={50} stroke="rgba(220,38,38,0.3)" strokeDasharray="4 4" label={{ value: "Pass", fill: "#dc2626", fontSize: 10, position: "right" }} />
                <ReferenceLine y={75} stroke="rgba(22,163,74,0.3)" strokeDasharray="4 4" label={{ value: "Excellence", fill: "#16a34a", fontSize: 10, position: "right" }} />
              </>
            )}
            {view === "improving" && (
              <ReferenceLine y={0} stroke="rgba(100,116,139,0.4)" strokeDasharray="4 4" />
            )}
            <Bar dataKey="value" name={cfg.label} radius={[6, 6, 2, 2]} maxBarSize={64}>
              {top10.map((entry, idx) => (
                <Cell key={idx} fill={cfg.color} fillOpacity={1 - idx * 0.05} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PredictionOverviewChart({ rows }) {
  if (!rows.length) return null;

  const total = rows.length;
  const metrics = [
    {
      name: "Dropout Risk",
      value: rows.filter((r) => Number(r.predicted_dropout_risk ?? r.dropout_risk_label) === 1).length,
      fill: "#dc2626",
    },
    {
      name: "Top Performing",
      value: rows.filter((r) => Number(r.predicted_high_performer ?? r.high_performer_label) === 1).length,
      fill: "#16a34a",
    },
    {
      name: "Improving",
      value: rows.filter((r) => Number(r.predicted_improving ?? r.improving_label) === 1).length,
      fill: "#4338ca",
    },
  ].map((item) => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0",
  }));

  return (
    <div className="analytics-grid prediction-analytics">
      <div className="chart-panel chart-card">
        <div className="section-heading compact">
          <div>
            <h3>Prediction Signal Mix</h3>
            <p>Percentage of students currently flagged by the model.</p>
          </div>
        </div>
        <div className="chart-frame compact-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics} margin={{ top: 8, right: 18, left: -18, bottom: 8 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name, props) => [`${value} students (${props.payload.percent}%)`, name]} />
              <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={72}>
                {metrics.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel chart-card">
        <div className="section-heading compact">
          <div>
            <h3>Owner Action Split</h3>
            <p>Turns model output into action groups: intervene, celebrate, or monitor improvement.</p>
          </div>
        </div>
        <div className="prediction-signal-list">
          {metrics.map((metric) => (
            <div key={metric.name} className="prediction-signal-row">
              <span style={{ backgroundColor: metric.fill }} />
              <div>
                <strong>{metric.name}</strong>
                <p>{metric.value} of {total} students · {metric.percent}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Predictions({ schoolId = "" }) {
  const [view, setView] = useState("all");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const endpoint = VIEWS.find((v) => v.key === view)?.endpoint ?? "/predictions";

  const { data: periods = [] } = useQuery({
    queryKey: ["prediction-periods", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/predictions/periods${qs}`).then((r) => r.data);
    },
  });

  const classParams = new URLSearchParams();
  if (schoolId) classParams.set("school_id", schoolId);
  if (sessionId) classParams.set("session_id", sessionId);
  if (termId) classParams.set("term_id", termId);

  const { data: levels = [] } = useQuery({
    queryKey: ["class-levels", schoolId, sessionId, termId],
    queryFn: () => {
      const q = classParams.toString();
      return api.get(`/overview/class-levels${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const armParams = new URLSearchParams(classParams);
  if (levelName) armParams.set("level_name", levelName);

  const { data: arms = [] } = useQuery({
    queryKey: ["class-arms", schoolId, sessionId, termId, levelName],
    queryFn: () => {
      const q = armParams.toString();
      return api.get(`/overview/class-arms${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["predictions", view, schoolId, sessionId, termId, levelName, armName],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (schoolId) qs.set("school_id", schoolId);
      if (sessionId) qs.set("session_id", sessionId);
      if (termId) qs.set("term_id", termId);
      if (levelName) qs.set("level_name", levelName);
      if (armName) qs.set("arm_name", armName);
      const query = qs.toString();
      return api.get(`${endpoint}${query ? `?${query}` : ""}`).then((r) => r.data);
    },
  });
  const sessions = Array.from(new Map(periods.map((period) => [period.session_id, period])).values());
  const terms = periods.filter((period) => !sessionId || String(period.session_id) === String(sessionId));

  return (
    <section className="surface-card table-card">
      <div className="prediction-header">
        <div>
          <h3>Prediction Watchlist</h3>
          <p>Model outputs for dropout prevention, high-performer identification, and improvement tracking.</p>
        </div>
        <span className="section-tag">Model Output</span>
      </div>

      <div className="view-toggle">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`toggle-btn ${view === v.key ? "active" : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-inputs">
          <select
            className="filter-input"
            value={sessionId}
            onChange={(event) => { setSessionId(event.target.value); setTermId(""); setLevelName(""); setArmName(""); }}
          >
            <option value="">All Sessions</option>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.session_name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            value={termId}
            onChange={(event) => { setTermId(event.target.value); setLevelName(""); setArmName(""); }}
          >
            <option value="">All Terms</option>
            {terms.map((period) => (
              <option key={`${period.session_id}-${period.term_id}`} value={period.term_id}>
                {period.term_name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            value={levelName}
            onChange={(event) => { setLevelName(event.target.value); setArmName(""); }}
          >
            <option value="">All Class Levels</option>
            {levels.map((level) => (
              <option key={level.level_name} value={level.level_name}>
                {level.level_name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            value={armName}
            onChange={(event) => setArmName(event.target.value)}
          >
            <option value="">All Class Arms</option>
            {arms.map((arm) => (
              <option key={arm.arm_name} value={arm.arm_name}>
                {arm.arm_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <>
          {view === "all" ? <PredictionOverviewChart rows={rows} /> : null}
          <PredictionChart rows={rows} view={view} />
          <PredictionTable rows={rows} />
        </>
      )}
    </section>
  );
}
