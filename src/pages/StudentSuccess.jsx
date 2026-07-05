import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import KPIBox from "../components/KPIBox";
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

const LEVEL_TONE = {
  Critical: "danger",
  High: "danger",
  Medium: "warn",
  Low: "good",
};

const LEVEL_COLORS = {
  Critical: "#991b1b",
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#16a34a",
};

function pct(value) {
  if (value == null) return "N/A";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function money(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildQuery(filters) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  return qs.toString();
}

function RiskMixChart({ summary }) {
  const rows = ["Critical", "High", "Medium", "Low"].map((level) => ({
    level,
    count: summary?.level_counts?.[level] || 0,
  }));
  if (!rows.some((row) => row.count > 0)) return null;

  return (
    <div className="chart-panel chart-card">
      <div className="section-heading compact">
        <div>
          <h3>Risk Level Mix</h3>
          <p>Students grouped by explainable success risk.</p>
        </div>
      </div>
      <div className="chart-frame compact-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 18, left: -18, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [`${value} students`, "Count"]} />
            <Bar dataKey="count" radius={[6, 6, 2, 2]} maxBarSize={72}>
              {rows.map((row) => (
                <Cell key={row.level} fill={LEVEL_COLORS[row.level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryList({ summary }) {
  const rows = Object.entries(summary?.category_counts || {})
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="chart-panel chart-card">
      <div className="section-heading compact">
        <div>
          <h3>Risk Categories</h3>
          <p>Why students are being flagged.</p>
        </div>
      </div>
      <div className="prediction-signal-list">
        {rows.length ? rows.map((row) => (
          <div key={row.category} className="prediction-signal-row">
            <span style={{ backgroundColor: row.category.includes("Risk") ? "#dc2626" : "#16a34a" }} />
            <div>
              <strong>{row.category}</strong>
              <p>{row.count} student{row.count !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )) : (
          <div className="empty-state compact-empty">
            <div>
              <h3>No category signals</h3>
              <p>Adjust filters or refresh the pipeline data.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentSuccess({ schoolId = "" }) {
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [riskCategory, setRiskCategory] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: periods = [] } = useQuery({
    queryKey: ["student-success-periods", schoolId],
    queryFn: () => {
      const q = buildQuery({ school_id: schoolId });
      return api.get(`/students/periods${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const classQuery = buildQuery({
    school_id: schoolId,
    session_id: sessionId,
    term_id: termId,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ["student-success-levels", schoolId, sessionId, termId],
    queryFn: () => api.get(`/overview/class-levels${classQuery ? `?${classQuery}` : ""}`).then((r) => r.data),
  });

  const armQuery = buildQuery({
    school_id: schoolId,
    session_id: sessionId,
    term_id: termId,
    level_name: levelName,
  });

  const { data: arms = [] } = useQuery({
    queryKey: ["student-success-arms", schoolId, sessionId, termId, levelName],
    queryFn: () => api.get(`/overview/class-arms${armQuery ? `?${armQuery}` : ""}`).then((r) => r.data),
  });

  const { data: categories = { risk_levels: [], risk_categories: [] } } = useQuery({
    queryKey: ["student-success-categories"],
    queryFn: () => api.get("/student-success/categories").then((r) => r.data),
  });

  const baseFilters = {
    school_id: schoolId,
    session_id: sessionId,
    term_id: termId,
    level_name: levelName,
    arm_name: armName,
  };

  const summaryQuery = buildQuery(baseFilters);
  const studentQuery = buildQuery({
    ...baseFilters,
    risk_level: riskLevel,
    risk_category: riskCategory,
    limit: "500",
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["student-success-summary", schoolId, sessionId, termId, levelName, armName],
    queryFn: () => api.get(`/student-success/summary${summaryQuery ? `?${summaryQuery}` : ""}`).then((r) => r.data),
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["student-success-students", schoolId, sessionId, termId, levelName, armName, riskLevel, riskCategory],
    queryFn: () => api.get(`/student-success/students${studentQuery ? `?${studentQuery}` : ""}`).then((r) => r.data),
  });

  const sessions = Array.from(new Map(periods.map((period) => [period.session_id, period])).values());
  const terms = periods.filter((period) => !sessionId || String(period.session_id) === String(sessionId));
  const filteredStudents = useMemo(() => {
    const needle = search.toLowerCase();
    return students.filter((row) => (row.full_name || "").toLowerCase().includes(needle));
  }, [students, search]);
  const pagination = usePagination(filteredStudents, [
    search,
    schoolId,
    sessionId,
    termId,
    levelName,
    armName,
    riskLevel,
    riskCategory,
  ]);

  const flaggedPct = summary?.total_students
    ? ((summary.flagged_students / summary.total_students) * 100).toFixed(1)
    : "0.0";

  const createInterventionMutation = useMutation({
    mutationFn: (row) => api.post("/interventions", {
      school_id: row.school_id || schoolId || null,
      student_id: row.student_id,
      student_name: row.full_name || "Student",
      session_id: row.session_id || null,
      term_id: row.term_id || null,
      level_name: row.level_name || null,
      arm_name: row.arm_name || null,
      risk_level: row.risk_level || null,
      risk_score: row.risk_score ?? null,
      risk_categories: row.risk_categories || [],
      risk_reasons: row.risk_reasons || [],
      intervention_type: row.recommended_action?.toLowerCase().includes("guardian")
        ? "guardian_call"
        : row.recommended_action?.toLowerCase().includes("fee")
        ? "fee_followup"
        : "academic_support",
      status: "pending",
      notes: row.recommended_action || "Created from Student Success watchlist.",
    }),
    onSuccess: async (_, row) => {
      setStatus(`Intervention created for ${row.full_name || "student"}.`);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["interventions"] });
      await queryClient.invalidateQueries({ queryKey: ["intervention-summary"] });
    },
    onError: (requestError) => {
      setError(requestError.response?.data?.detail || "Unable to create intervention.");
      setStatus("");
    },
  });

  return (
    <section className="surface-card table-card">
      <div className="section-heading">
        <div>
          <h3>Student Success Intelligence</h3>
          <p>Explainable risk categories, reasons, and next actions for learner support.</p>
        </div>
        <span className="section-tag">Intervention Readiness</span>
      </div>

      {status ? <div className="status-banner success">{status}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

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
          <select
            className="filter-input"
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value)}
          >
            <option value="">All Risk Levels</option>
            {categories.risk_levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select
            className="filter-input"
            value={riskCategory}
            onChange={(event) => setRiskCategory(event.target.value)}
          >
            <option value="">All Categories</option>
            {categories.risk_categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {summaryLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="kpi-grid">
            <KPIBox title="Students Analysed" value={summary?.total_students?.toLocaleString() ?? "0"} footnote="Current filtered population" />
            <KPIBox title="Flagged Students" value={`${summary?.flagged_students ?? 0} (${flaggedPct}%)`} footnote="Medium risk and above" />
            <KPIBox title="Critical Risk" value={summary?.critical_risk ?? 0} footnote="Immediate intervention needed" />
            <KPIBox title="High Risk" value={summary?.high_risk ?? 0} footnote="Needs staff follow-up" />
            <KPIBox title="Medium Risk" value={summary?.medium_risk ?? 0} footnote="Monitor and support" />
            <KPIBox title="Low Risk" value={summary?.low_risk ?? 0} footnote="No major risk signal" />
          </div>

          <div className="analytics-grid">
            <RiskMixChart summary={summary} />
            <CategoryList summary={summary} />
            <div className="chart-panel chart-card">
              <div className="section-heading compact">
                <div>
                  <h3>Class Hotspots</h3>
                  <p>Classes with the highest high/critical count.</p>
                </div>
              </div>
              <ul className="overview-points">
                {(summary?.top_classes || []).map((row) => (
                  <li key={row.class_name}>
                    <span>{row.class_name}</span>
                    <strong>{row.high_or_critical_count}</strong>
                  </li>
                ))}
                {summary?.top_classes?.length ? null : (
                  <li>
                    <span>No high-risk class hotspot</span>
                    <strong>—</strong>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="table-toolbar">
        <span className="table-chip">{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</span>
        <input
          className="table-search"
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {studentsLoading ? (
        <LoadingSkeleton rows={6} />
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <div>
            <h3>No student success records</h3>
            <p>Adjust the filters or refresh the Databricks pipeline.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Risk</th>
                <th>Score</th>
                <th>Categories</th>
                <th>Reasons</th>
                <th>Next Action</th>
                <th>Academic</th>
                <th>Attendance</th>
                <th>Fees</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((row) => (
                <tr key={`${row.school_id}-${row.student_id}-${row.session_id}-${row.term_id}`}>
                  <td>
                    <div className="student-cell">
                      <strong>{row.full_name || "—"}</strong>
                      <span>{row.session_name || "—"} · {row.term_name || "—"}</span>
                    </div>
                  </td>
                  <td>{row.level_name || "—"}{row.arm_name ? <span className="numeric-subtle"> · {row.arm_name}</span> : null}</td>
                  <td>
                    <span className={`table-badge ${LEVEL_TONE[row.risk_level] || "warn"}`}>
                      {row.risk_level}
                    </span>
                  </td>
                  <td><strong>{row.risk_score}</strong></td>
                  <td>{row.risk_categories?.join(", ") || "—"}</td>
                  <td>
                    <div className="student-cell">
                      {(row.risk_reasons || []).slice(0, 3).map((reason) => (
                        <span key={reason}>{reason}</span>
                      ))}
                    </div>
                  </td>
                  <td>{row.recommended_action || "Continue monitoring"}</td>
                  <td>
                    <strong>{row.latest_avg_score ?? "—"}</strong>
                    <span className="numeric-subtle"> · {row.num_failing_latest ?? 0} failing</span>
                  </td>
                  <td>{row.latest_attendance_rate != null ? pct(row.latest_attendance_rate) : "N/A"}</td>
                  <td>
                    <div className="student-cell">
                      <strong>{row.fee_risk_band || "—"}</strong>
                      <span>{money(row.total_fees_outstanding)}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost-button mini"
                      onClick={() => createInterventionMutation.mutate(row)}
                      disabled={createInterventionMutation.isPending}
                    >
                      Create Intervention
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={pagination.setPage} />
        </>
      )}
    </section>
  );
}
