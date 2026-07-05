import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Cell,
  ReferenceLine,
} from "recharts";

const VIEWS = [
  { key: "all", label: "All Teachers", endpoint: "/teachers" },
  { key: "top", label: "Top Performers", endpoint: "/teachers/top-performers" },
];

function needsSubjectSupport(row) {
  const avg = row.avg_total_score != null ? Number(row.avg_total_score) : null;
  return (avg != null && avg < 55) || Number(row.failing_count || 0) > 0;
}

export default function Teachers({ schoolId = "" }) {
  const [view, setView] = useState("all");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", schoolId],
    queryFn: () => {
      const schoolQs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/overview/sessions${schoolQs}`).then((r) => r.data);
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

  const qs = new URLSearchParams();
  if (schoolId) qs.set("school_id", schoolId);
  if (view === "all" && sessionId) qs.set("session_id", sessionId);
  if (view === "all" && termId) qs.set("term_id", termId);
  if (view === "all" && levelName) qs.set("level_name", levelName);
  if (view === "all" && armName) qs.set("arm_name", armName);

  const endpoint = VIEWS.find((v) => v.key === view)?.endpoint ?? "/teachers";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["teachers", view, sessionId, termId, levelName, armName, schoolId],
    queryFn: () => {
      const q = qs.toString();
      return api.get(`${endpoint}${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });
  const pagination = usePagination(rows, [view, schoolId, sessionId, termId, levelName, armName]);
  const createActionMutation = useMutation({
    mutationFn: (row) => {
      const avg = row.avg_total_score != null ? Number(row.avg_total_score) : null;
      return api.post("/interventions", {
        school_id: row.school_id || schoolId || null,
        school_name: row.school_name || null,
        school_short_name: row.school_short_name || null,
        target_type: "teacher",
        target_id: String(row.employee_id || row.teacher_name || "teacher"),
        target_name: `${row.teacher_name || "Teacher"} · ${row.subject_name || "Subject"}`,
        source_module: "teachers",
        session_id: row.session_id || null,
        term_id: row.term_id || null,
        level_name: row.level_name || null,
        arm_name: row.arm_name || null,
        risk_level: avg != null && avg < 50 ? "High" : "Medium",
        risk_score: avg != null ? Math.max(0, Math.round(100 - avg)) : null,
        risk_categories: ["Teacher Subject Performance"],
        risk_reasons: [
          `${row.teacher_name || "Teacher"} has a ${row.subject_name || "subject"} average of ${avg != null ? avg.toFixed(1) : "not available"} for ${row.level_name || "the selected class"}${row.arm_name ? ` ${row.arm_name}` : ""}.`,
          `${row.failing_count ?? 0} student records are failing in this teacher-subject group.`,
          `Session/term: ${row.session_name || row.session_id || "Session"} · ${row.term_name || `Term ${row.term_id || ""}`}`.trim(),
        ],
        intervention_type: "teacher_subject_support",
        status: "pending",
        notes: "Academic leadership should review the subject performance pattern, discuss support needs with the teacher, and agree a monitoring plan for improvement.",
      });
    },
    onSuccess: async (_, row) => {
      setStatusMessage(`Teacher subject support action created for ${row.teacher_name || "teacher"} in ${row.subject_name || "subject"}.`);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["interventions"] });
      await queryClient.invalidateQueries({ queryKey: ["intervention-summary"] });
    },
    onError: (requestError) => {
      setError(requestError.response?.data?.detail || "Unable to create teacher action.");
      setStatusMessage("");
    },
  });

  return (
    <section className="surface-card table-card">
      <div className="section-heading">
        <div>
          <h3>Teacher Effectiveness</h3>
          <p>
            Average student scores per teacher per subject per term, derived from
            subject-teacher assignments and score records.
          </p>
        </div>
        <span className="section-tag">Teacher Analytics</span>
      </div>

      <div className="filter-bar">
        <div className="view-toggle">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              className={`toggle-btn ${view === v.key ? "active" : ""}`}
              onClick={() => { setView(v.key); setSessionId(""); setTermId(""); setLevelName(""); setArmName(""); }}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "all" && (
          <div className="filter-inputs">
            <select
              className="filter-input"
              value={sessionId}
              onChange={(e) => { setSessionId(e.target.value); setTermId(""); setLevelName(""); setArmName(""); }}
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.session_name}
                </option>
              ))}
            </select>
            <select
              className="filter-input"
              value={termId}
              onChange={(e) => { setTermId(e.target.value); setLevelName(""); setArmName(""); }}
            >
              <option value="">All Terms</option>
              <option value="1">First Term</option>
              <option value="2">Second Term</option>
              <option value="3">Third Term</option>
            </select>
            <select
              className="filter-input"
              value={levelName}
              onChange={(e) => { setLevelName(e.target.value); setArmName(""); }}
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
              onChange={(e) => setArmName(e.target.value)}
            >
              <option value="">All Class Arms</option>
              {arms.map((arm) => (
                <option key={arm.arm_name} value={arm.arm_name}>
                  {arm.arm_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusMessage ? <div className="status-banner success">{statusMessage}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div>
            <h3>No teacher data</h3>
            <p>Subject-teacher assignments may not be populated yet in the pipeline.</p>
          </div>
        </div>
      ) : (
        <>
          <TeacherAvgChart rows={rows} />
          <div className="table-toolbar">
            <span className="table-chip">
              {rows.length} teacher record{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Subject</th>
                  <th>Session</th>
                  <th>Term</th>
                  <th>Level / Arm</th>
                  <th>Students</th>
                  <th>Avg Score</th>
                  <th>Pass Rate</th>
                  <th>Excellence</th>
                  <th>Failing</th>
                  <th>Rating</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((r, i) => {
                  const avg = r.avg_total_score ?? null;
                  const rating =
                    avg == null
                      ? { label: "—", cls: "" }
                      : avg >= 75
                      ? { label: "Strong", cls: "good" }
                      : avg >= 55
                      ? { label: "Average", cls: "warn" }
                      : { label: "Needs Support", cls: "danger" };
                  const supportNeeded = needsSubjectSupport(r);

                  return (
                    <tr key={i}>
                      <td>
                        <div className="student-cell">
                          <strong>{r.teacher_name ?? "—"}</strong>
                          <span>{r.employee_id ?? ""}</span>
                        </div>
                      </td>
                      <td><strong>{r.subject_name ?? "—"}</strong></td>
                      <td>{r.session_name ?? "—"}</td>
                      <td>{r.term_name ?? `Term ${r.term_id}`}</td>
                      <td>
                        <span>{r.level_name ?? "—"}</span>
                        {r.arm_name && (
                          <span className="numeric-subtle"> · {r.arm_name}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>{r.num_students ?? "—"}</td>
                      <td>
                        <strong
                          style={{
                            color:
                              avg == null
                                ? "inherit"
                                : avg >= 75
                                ? "var(--success)"
                                : avg < 50
                                ? "var(--danger)"
                                : "inherit",
                          }}
                        >
                          {avg != null ? Number(avg).toFixed(1) : "—"}
                        </strong>
                      </td>
                      <td>
                        {r.pass_rate != null
                          ? `${(r.pass_rate * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.excellence_count ?? "—"}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: r.failing_count > 0 ? "var(--danger)" : "inherit",
                        }}
                      >
                        {r.failing_count ?? "—"}
                      </td>
                      <td>
                        {rating.cls ? (
                          <span className={`table-badge ${rating.cls}`}>
                            {rating.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={() => createActionMutation.mutate(r)}
                          disabled={createActionMutation.isPending || !schoolId || !supportNeeded}
                          title={supportNeeded ? "Create teacher subject support action" : "This row is not currently flagged for support"}
                        >
                          Subject Support
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={pagination.setPage} />
        </>
      )}
    </section>
  );
}

function TeacherAvgChart({ rows }) {
  const teacherMap = {};
  for (const r of rows) {
    if (!r.teacher_name || r.avg_total_score == null) continue;
    if (!teacherMap[r.teacher_name]) teacherMap[r.teacher_name] = { sum: 0, count: 0 };
    teacherMap[r.teacher_name].sum += Number(r.avg_total_score);
    teacherMap[r.teacher_name].count += 1;
  }
  const chartData = Object.entries(teacherMap)
    .map(([teacher_name, { sum, count }]) => ({
      teacher_name,
      avg: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 20);

  if (chartData.length === 0) return null;

  return (
    <div className="chart-frame" style={{ height: 260, marginBottom: "1.5rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 24, left: -18, bottom: 56 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="teacher_name"
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
            formatter={(v) => [`${v}`, "Avg Student Score"]}
          />
          <ReferenceLine y={50} stroke="rgba(220,38,38,0.3)" strokeDasharray="4 4" label={{ value: "Pass", fill: "#dc2626", fontSize: 10, position: "right" }} />
          <ReferenceLine y={75} stroke="rgba(22,163,74,0.3)" strokeDasharray="4 4" label={{ value: "Strong", fill: "#16a34a", fontSize: 10, position: "right" }} />
          <Bar dataKey="avg" name="Avg Score" radius={[6, 6, 2, 2]} maxBarSize={56}>
            {chartData.map((entry) => (
              <Cell
                key={entry.teacher_name}
                fill={entry.avg >= 75 ? "#10b981" : entry.avg < 50 ? "#ef4444" : "#6366f1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
