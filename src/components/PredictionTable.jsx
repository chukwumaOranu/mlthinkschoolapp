import React, { useState } from "react";
import RiskBadge from "./RiskBadge";
import TrendChip from "./TrendChip";
import Pagination, { usePagination } from "./Pagination";

export default function PredictionTable({ rows }) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) =>
    (r.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const pagination = usePagination(filtered, [search, rows]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <div>
          <h3>No predictions yet</h3>
          <p>Run the batch prediction pipeline step to populate this table.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="table-toolbar">
        <span className="table-chip">{filtered.length} of {rows.length} students</span>
        <input
          className="table-search"
          type="search"
          placeholder="Filter by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Period</th>
              <th>Avg Score</th>
              <th>Trend</th>
              <th>Attendance</th>
              <th>Failing</th>
              <th>CGPA</th>
              <th>Dropout Risk</th>
              <th>Risk Prob.</th>
              <th>High Performer</th>
              <th>Perf. Prob.</th>
              <th>Improving</th>
              <th>Impr. Prob.</th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((r, i) => (
              <tr key={r.student_id ?? i}>
                <td>
                  <div className="student-cell">
                    <strong>{r.full_name ?? "—"}</strong>
                    <span>{r.gender === "M" ? "Male" : r.gender === "F" ? "Female" : r.gender}</span>
                  </div>
                </td>
                <td>
                  <div className="student-cell">
                    <strong>{r.term_name ?? "—"}</strong>
                    <span>{r.latest_session_name ?? r.session_name ?? "—"}</span>
                  </div>
                </td>
                <td>
                  <strong>{r.latest_avg_score ?? "—"}</strong>
                  {r.prev_avg_score != null && (
                    <div className="numeric-subtle">was {r.prev_avg_score}</div>
                  )}
                </td>
                <td><TrendChip value={r.score_trend} /></td>
                <td>
                  {r.latest_attendance_rate != null
                    ? `${(r.latest_attendance_rate * 100).toFixed(1)}%`
                    : <span className="muted-text">N/A</span>}
                </td>
                <td style={{ textAlign: "center" }}>{r.num_failing_latest ?? "—"}</td>
                <td>{r.cgpa ?? "—"}</td>
                <td>
                  <RiskBadge
                    value={r.predicted_dropout_risk ?? r.dropout_risk_label}
                    trueLabel="At Risk"
                    falseLabel="Safe"
                  />
                </td>
                <td className="table-probability">
                  {r.dropout_risk_probability != null
                    ? r.dropout_risk_probability.toFixed(3)
                    : "—"}
                </td>
                <td>
                  <RiskBadge
                    value={r.predicted_high_performer ?? r.high_performer_label}
                    trueLabel="High"
                    falseLabel="—"
                    trueVariant="good"
                    falseVariant="warn"
                  />
                </td>
                <td className="table-probability">
                  {r.high_performer_probability != null
                    ? r.high_performer_probability.toFixed(3)
                    : "—"}
                </td>
                <td>
                  <RiskBadge
                    value={r.predicted_improving ?? r.improving_label}
                    trueLabel="↑ Yes"
                    falseLabel="—"
                    trueVariant="good"
                    falseVariant="warn"
                  />
                </td>
                <td className="table-probability">
                  {r.improving_probability != null
                    ? r.improving_probability.toFixed(3)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} onPageChange={pagination.setPage} />
    </>
  );
}
