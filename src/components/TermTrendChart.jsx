import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  fontSize: "0.84rem",
};

export default function TermTrendChart({ data }) {
  if (!data.length) {
    return (
      <div className="empty-state">
        <div>
          <h3>No term data yet</h3>
          <p>Once the pipeline runs for multiple terms, the trend will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 32, left: -18, bottom: 8 }}>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="term_name"
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="score"
          domain={[0, 100]}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Avg Score", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11, dx: 14 }}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [
          name === "Pass Rate %" ? `${v}%` : v, name
        ]} />
        <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
        <ReferenceLine yAxisId="score" y={50} stroke="rgba(220,38,38,0.25)" strokeDasharray="4 4" label={{ value: "Pass", fill: "#dc2626", fontSize: 10, position: "right" }} />
        <ReferenceLine yAxisId="score" y={75} stroke="rgba(22,163,74,0.25)" strokeDasharray="4 4" label={{ value: "Excellence", fill: "#16a34a", fontSize: 10, position: "right" }} />
        <Bar yAxisId="score" dataKey="avg_score" name="Avg Score" fill="#6366f1" radius={[6, 6, 2, 2]} maxBarSize={80} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="pass_rate_pct"
          name="Pass Rate %"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ fill: "#10b981", r: 5, strokeWidth: 0 }}
          activeDot={{ r: 7 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
