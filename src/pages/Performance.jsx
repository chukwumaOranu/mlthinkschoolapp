import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Pagination, { usePagination } from "../components/Pagination";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

const GRAIN = [
  { key: "terms", label: "By Term (Subject Scores)" },
  { key: "sessions", label: "By Session (Annual)" },
];

export default function Performance({ schoolId = "" }) {
  const [grain, setGrain] = useState("terms");
  const [sessionFilter, setSessionFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [armFilter, setArmFilter] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/overview/sessions${qs}`).then((r) => r.data);
    },
  });

  const classParams = new URLSearchParams();
  if (schoolId) classParams.set("school_id", schoolId);
  if (sessionFilter) classParams.set("session_id", sessionFilter);
  if (grain === "terms" && termFilter) classParams.set("term_id", termFilter);

  const { data: levels = [] } = useQuery({
    queryKey: ["class-levels", schoolId, sessionFilter, termFilter, grain],
    queryFn: () => {
      const q = classParams.toString();
      return api.get(`/overview/class-levels${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const armParams = new URLSearchParams(classParams);
  if (levelFilter) armParams.set("level_name", levelFilter);

  const { data: arms = [] } = useQuery({
    queryKey: ["class-arms", schoolId, sessionFilter, termFilter, grain, levelFilter],
    queryFn: () => {
      const q = armParams.toString();
      return api.get(`/overview/class-arms${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const params = new URLSearchParams({ limit: "300" });
  if (schoolId) params.set("school_id", schoolId);
  if (sessionFilter) params.set("session_id", sessionFilter);
  if (grain === "terms" && termFilter) params.set("term_id", termFilter);
  if (levelFilter) params.set("level_name", levelFilter);
  if (armFilter) params.set("arm_name", armFilter);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["performance", grain, sessionFilter, termFilter, levelFilter, armFilter, schoolId],
    queryFn: () =>
      api.get(`/performance/${grain}?${params.toString()}`).then((r) => r.data),
  });

  return (
    <section className="surface-card table-card">
      <div className="section-heading">
        <div>
          <h3>Academic Performance</h3>
          <p>
            {grain === "terms"
              ? "Per-student per-subject scores for each term. Filter by session or term."
              : "Annual summary per student per academic session. Includes CGPA and annual position."}
          </p>
        </div>
        <span className="section-tag">Performance History</span>
      </div>

      <div className="filter-bar">
        <div className="view-toggle">
          {GRAIN.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`toggle-btn ${grain === g.key ? "active" : ""}`}
              onClick={() => { setGrain(g.key); setTermFilter(""); setLevelFilter(""); setArmFilter(""); }}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="filter-inputs">
          <select
            className="filter-input"
            value={sessionFilter}
            onChange={(e) => { setSessionFilter(e.target.value); setTermFilter(""); setLevelFilter(""); setArmFilter(""); }}
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name}
              </option>
            ))}
          </select>
          {grain === "terms" && (
            <select
              className="filter-input"
              value={termFilter}
              onChange={(e) => { setTermFilter(e.target.value); setLevelFilter(""); setArmFilter(""); }}
            >
              <option value="">All Terms</option>
              <option value="1">First Term</option>
              <option value="2">Second Term</option>
              <option value="3">Third Term</option>
            </select>
          )}
          <select
            className="filter-input"
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setArmFilter(""); }}
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
            value={armFilter}
            onChange={(e) => setArmFilter(e.target.value)}
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
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div>
            <h3>No data</h3>
            <p>Try adjusting the session or term filters.</p>
          </div>
        </div>
      ) : grain === "terms" ? (
        <>
          <SubjectAvgChart rows={rows} />
          <TermTable rows={rows} />
        </>
      ) : (
        <SessionTable rows={rows} />
      )}
    </section>
  );
}

function TermTable({ rows }) {
  const pagination = usePagination(rows, [rows]);
  return (
    <>
      <div className="table-toolbar">
        <span className="table-chip">{rows.length} score records</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Session</th>
              <th>Term</th>
              <th>Subject</th>
              <th>Level / Arm</th>
              <th>Exam</th>
              <th>CA</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Arm Position</th>
              <th>Arm Avg</th>
              <th>Cumul. Avg</th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((r, i) => (
              <tr key={i}>
                <td>
                  <div className="student-cell">
                    <strong>{r.student_name ?? "—"}</strong>
                    <span>{r.registration_number}</span>
                  </div>
                </td>
                <td>{r.session_name ?? "—"}</td>
                <td>{r.term_name ?? `Term ${r.term_id}`}</td>
                <td><strong>{r.subject_name ?? "—"}</strong></td>
                <td>
                  <span>{r.level_name ?? "—"}</span>
                  {r.arm_name && <span className="numeric-subtle"> · {r.arm_name}</span>}
                </td>
                <td>{r.exam ?? "—"}</td>
                <td>{r.ca_scores ?? "—"}</td>
                <td>
                  <strong
                    style={{
                      color: r.total >= 75
                        ? "var(--success)"
                        : r.total < 50
                        ? "var(--danger)"
                        : "inherit",
                    }}
                  >
                    {r.total ?? "—"}
                  </strong>
                </td>
                <td>{r.grade ?? "—"}</td>
                <td style={{ textAlign: "center" }}>{r.student_arm_position ?? "—"}</td>
                <td>{r.arm_average ?? "—"}</td>
                <td>{r.student_cummulative_average ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} onPageChange={pagination.setPage} />
    </>
  );
}

function SessionTable({ rows }) {
  const pagination = usePagination(rows, [rows]);
  return (
    <>
      <div className="table-toolbar">
        <span className="table-chip">{rows.length} session records</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Session</th>
              <th>Level / Arm</th>
              <th>Subjects</th>
              <th>Avg Score</th>
              <th>Failing</th>
              <th>Pass Rate</th>
              <th>Annual Avg</th>
              <th>Annual Grade</th>
              <th>Annual Position</th>
              <th>CGPA</th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((r, i) => (
              <tr key={i}>
                <td>
                  <div className="student-cell">
                    <strong>{r.student_name ?? "—"}</strong>
                    <span>{r.registration_number}</span>
                  </div>
                </td>
                <td>{r.session_name ?? "—"}</td>
                <td>
                  {r.level_name ?? "—"}
                  {r.arm_name && <span className="numeric-subtle"> · {r.arm_name}</span>}
                </td>
                <td style={{ textAlign: "center" }}>{r.num_subjects ?? "—"}</td>
                <td>
                  <strong
                    style={{
                      color: r.avg_term_score >= 75
                        ? "var(--success)"
                        : r.avg_term_score < 50
                        ? "var(--danger)"
                        : "inherit",
                    }}
                  >
                    {r.avg_term_score ?? "—"}
                  </strong>
                </td>
                <td style={{ textAlign: "center", color: r.num_failing_subjects > 0 ? "var(--danger)" : "inherit" }}>
                  {r.num_failing_subjects ?? "—"}
                </td>
                <td>
                  {r.pass_rate != null
                    ? `${(r.pass_rate * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td>{r.annual_average ?? "—"}</td>
                <td>{r.annual_grade ?? "—"}</td>
                <td style={{ textAlign: "center" }}>{r.annual_position ?? "—"}</td>
                <td><strong>{r.cgpa ?? "—"}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} onPageChange={pagination.setPage} />
    </>
  );
}

function SubjectAvgChart({ rows }) {
  const subjectMap = {};
  for (const r of rows) {
    if (!r.subject_name || r.total == null) continue;
    if (!subjectMap[r.subject_name]) subjectMap[r.subject_name] = { sum: 0, count: 0 };
    subjectMap[r.subject_name].sum += Number(r.total);
    subjectMap[r.subject_name].count += 1;
  }
  const chartData = Object.entries(subjectMap)
    .map(([subject_name, { sum, count }]) => ({
      subject_name,
      avg: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.avg - a.avg);

  if (chartData.length === 0) return null;

  return (
    <div className="chart-frame" style={{ height: 260, marginBottom: "1.5rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 24, left: -18, bottom: 48 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="subject_name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: "0.83rem" }}
            formatter={(v) => [`${v}`, "Avg Score"]}
          />
          <ReferenceLine y={50} stroke="rgba(220,38,38,0.3)" strokeDasharray="4 4" label={{ value: "Pass", fill: "#dc2626", fontSize: 10, position: "right" }} />
          <ReferenceLine y={75} stroke="rgba(22,163,74,0.3)" strokeDasharray="4 4" label={{ value: "Excellence", fill: "#16a34a", fontSize: 10, position: "right" }} />
          <Bar dataKey="avg" name="Avg Score" radius={[6, 6, 2, 2]} maxBarSize={60}>
            {chartData.map((entry) => (
              <Cell
                key={entry.subject_name}
                fill={entry.avg >= 75 ? "#10b981" : entry.avg < 50 ? "#ef4444" : "#6366f1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
