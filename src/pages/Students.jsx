import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import RiskBadge from "../components/RiskBadge";
import TrendChip from "../components/TrendChip";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Pagination, { usePagination } from "../components/Pagination";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const VIEWS = [
  { key: "all",       label: "All Students",  endpoint: "/students" },
  { key: "dropout",   label: "Dropout Risk",  endpoint: "/students/dropout-risk" },
  { key: "top",       label: "Top Performers", endpoint: "/students/top-performers" },
  { key: "improving", label: "Improving",     endpoint: "/students/improving" },
];

function StudentSignalCharts({ rows }) {
  if (!rows.length) return null;

  const total = rows.length;
  const data = [
    {
      name: "Dropout Risk",
      value: rows.filter((r) => Number(r.dropout_risk_label) === 1).length,
      fill: "#dc2626",
      note: "Students needing intervention",
    },
    {
      name: "Top Performing",
      value: rows.filter((r) => Number(r.high_performer_label) === 1).length,
      fill: "#16a34a",
      note: "Students to celebrate and retain",
    },
    {
      name: "Improving",
      value: rows.filter((r) => Number(r.improving_label) === 1).length,
      fill: "#4338ca",
      note: "Students responding to support",
    },
  ].map((item) => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0",
  }));

  return (
    <div className="analytics-grid">
      <div className="chart-panel chart-card">
        <div className="section-heading compact">
          <div>
            <h3>Student Outcome Signals</h3>
            <p>Graphical summary of the current student population.</p>
          </div>
        </div>
        <div className="chart-frame compact-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 18, left: -18, bottom: 8 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name, props) => [`${value} students (${props.payload.percent}%)`, name]} />
              <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={72}>
                {data.map((entry) => (
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
            <h3>What This Tells The School</h3>
            <p>Quick reading for owner and leadership decisions.</p>
          </div>
        </div>
        <div className="prediction-signal-list">
          {data.map((item) => (
            <div key={item.name} className="prediction-signal-row">
              <span style={{ backgroundColor: item.fill }} />
              <div>
                <strong>{item.name}</strong>
                <p>{item.value} of {total} students · {item.percent}% · {item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Students({ schoolId = "" }) {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const endpoint = VIEWS.find((v) => v.key === view)?.endpoint;

  const { data: periods = [] } = useQuery({
    queryKey: ["student-periods", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/students/periods${qs}`).then((r) => r.data);
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
    queryKey: ["students", view, schoolId, sessionId, termId, levelName, armName],
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

  const filtered = rows.filter((r) =>
    (r.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const pagination = usePagination(filtered, [search, view, schoolId, sessionId, termId, levelName, armName]);
  const sessions = Array.from(new Map(periods.map((period) => [period.session_id, period])).values());
  const terms = periods.filter((period) => !sessionId || String(period.session_id) === String(sessionId));

  return (
    <section className="surface-card table-card">
      <div className="section-heading">
        <div>
          <h3>Students</h3>
          <p>Latest academic features and risk flags for every student in the pipeline.</p>
        </div>
        <span className="section-tag">Student Registry</span>
      </div>

      <div className="view-toggle">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`toggle-btn ${view === v.key ? "active" : ""}`}
            onClick={() => { setView(v.key); setSearch(""); }}
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
            onChange={(event) => { setSessionId(event.target.value); setTermId(""); setLevelName(""); setArmName(""); setSearch(""); }}
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
            onChange={(event) => { setTermId(event.target.value); setLevelName(""); setArmName(""); setSearch(""); }}
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
            onChange={(event) => { setLevelName(event.target.value); setArmName(""); setSearch(""); }}
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
            onChange={(event) => { setArmName(event.target.value); setSearch(""); }}
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
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          <StudentSignalCharts rows={rows} />

          <div className="table-toolbar">
            <span className="table-chip">{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>
            <input
              className="table-search"
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div>
                <h3>No students found</h3>
                <p>Try adjusting your search or switch views.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Period</th>
                      <th>Latest Avg</th>
                      <th>Prev Avg</th>
                      <th>Trend</th>
                      <th>Attendance</th>
                      <th>Failing</th>
                      <th>Cumulative Avg</th>
                      <th>CGPA</th>
                      <th>Dropout Risk</th>
                      <th>High Performer</th>
                      <th>Improving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.paginatedItems.map((r, i) => (
                      <tr key={r.student_id ?? i}>
                      <td>
                        <div className="student-cell">
                          <strong>{r.full_name ?? "—"}</strong>
                          <span>
                            {r.gender === "M" ? "Male" : r.gender === "F" ? "Female" : "—"}
                            {r.level_name ? ` · ${r.level_name}${r.arm_name ? ` ${r.arm_name}` : ""}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="student-cell">
                          <strong>{r.term_name ?? "—"}</strong>
                          <span>{r.latest_session_name ?? r.session_name ?? "—"}</span>
                        </div>
                      </td>
                      <td>
                        <strong
                          style={{
                            color: r.latest_avg_score >= 75
                              ? "var(--success)"
                              : r.latest_avg_score < 50
                              ? "var(--danger)"
                              : "inherit",
                          }}
                        >
                          {r.latest_avg_score ?? "—"}
                        </strong>
                      </td>
                      <td>{r.prev_avg_score ?? <span className="muted-text">—</span>}</td>
                      <td><TrendChip value={r.score_trend} /></td>
                      <td>
                        {r.latest_attendance_rate != null
                          ? `${(r.latest_attendance_rate * 100).toFixed(1)}%`
                          : <span className="muted-text">N/A</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ color: r.num_failing_latest >= 3 ? "var(--danger)" : "inherit" }}>
                          {r.num_failing_latest ?? "—"}
                        </span>
                      </td>
                      <td>{r.cummulative_average ?? "—"}</td>
                      <td>{r.cgpa ?? "—"}</td>
                      <td>
                        <RiskBadge
                          value={r.dropout_risk_label}
                          trueLabel="At Risk"
                          falseLabel="Safe"
                        />
                      </td>
                      <td>
                        <RiskBadge
                          value={r.high_performer_label}
                          trueLabel="High"
                          falseLabel="—"
                          trueVariant="good"
                          falseVariant="warn"
                        />
                      </td>
                      <td>
                        <RiskBadge
                          value={r.improving_label}
                          trueLabel="↑ Yes"
                          falseLabel="—"
                          trueVariant="good"
                          falseVariant="warn"
                        />
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pagination} onPageChange={pagination.setPage} />
            </>
          )}
        </>
      )}
    </section>
  );
}
