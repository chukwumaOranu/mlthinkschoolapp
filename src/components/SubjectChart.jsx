import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, ReferenceLine,
} from "recharts";

const COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export default function SubjectChart({ data }) {
  if (!data.length) {
    return (
      <div className="empty-state">
        <div>
          <h3>No subject data yet</h3>
          <p>Once the pipeline runs, subject performance bars will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subject-chart-layout">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="subject_name"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(99,102,241,0.05)" }}
              contentStyle={tooltipStyle}
              formatter={(v, name) => [Number(v).toFixed(2), name]}
            />
            <ReferenceLine y={50} stroke="rgba(220,38,38,0.3)" strokeDasharray="4 4" />
            <ReferenceLine y={75} stroke="rgba(22,163,74,0.3)" strokeDasharray="4 4" />
            <Bar dataKey="avg_score" name="Avg Score" radius={[10, 10, 3, 3]}>
              {data.map((entry, i) => (
                <Cell key={entry.subject_name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="subject-stats-grid">
        {data.map((s, i) => (
          <div key={s.subject_name} className="subject-stat-card">
            <span className="subject-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <div>
              <strong>{s.subject_name}</strong>
              <div className="subject-stat-row">
                <span>Avg</span><strong>{s.avg_score}</strong>
              </div>
              <div className="subject-stat-row">
                <span>Pass rate</span>
                <strong>{s.pass_rate != null ? `${(s.pass_rate * 100).toFixed(1)}%` : "—"}</strong>
              </div>
              <div className="subject-stat-row">
                <span>Excellence</span><strong>{s.excellence_count ?? "—"}</strong>
              </div>
              <div className="subject-stat-row">
                <span>Failing</span>
                <strong style={{ color: s.failing_count > 0 ? "var(--danger)" : "inherit" }}>
                  {s.failing_count ?? "—"}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
