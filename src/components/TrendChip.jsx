import React from "react";

export default function TrendChip({ value }) {
  if (value === null || value === undefined) return <span className="muted-text">—</span>;
  const n = Number(value);
  if (n > 0) return <span className="trend-chip trend-up">↑ {n.toFixed(1)}</span>;
  if (n < 0) return <span className="trend-chip trend-down">↓ {Math.abs(n).toFixed(1)}</span>;
  return <span className="trend-chip trend-flat">→ 0</span>;
}
