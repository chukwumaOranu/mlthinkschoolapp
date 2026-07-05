import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import KPIBox from "../components/KPIBox";
import LoadingSkeleton from "../components/LoadingSkeleton";
import TermTrendChart from "../components/TermTrendChart";

export default function Overview({ schoolId = "" }) {
  const [trendSession, setTrendSession] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["overview", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/overview${qs}`).then((r) => r.data);
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/overview/sessions${qs}`).then((r) => r.data);
    },
  });

  const { data: termTrend = [] } = useQuery({
    queryKey: ["term-trend", trendSession, schoolId],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (trendSession) qs.set("session_id", trendSession);
      if (schoolId) qs.set("school_id", schoolId);
      const query = qs.toString();
      return api.get(`/overview/term-trend${query ? `?${query}` : ""}`).then((r) => r.data);
    },
  });

  if (isLoading || !data) {
    return (
      <section className="surface-card">
        <LoadingSkeleton rows={4} />
      </section>
    );
  }

  const riskPct = data.total_students > 0
    ? ((data.dropout_risk_count / data.total_students) * 100).toFixed(1)
    : "0.0";

  const highPct = data.total_students > 0
    ? ((data.high_performer_count / data.total_students) * 100).toFixed(1)
    : "0.0";

  const improvingPct = data.total_students > 0
    ? ((data.improving_count / data.total_students) * 100).toFixed(1)
    : "0.0";

  const periodLabel = data.session_name && data.term_name
    ? `${data.term_name}, ${data.session_name} Session`
    : "Current Period";
  const schoolLabel = data.school_short_name || data.school_name || "Current School";

  return (
    <section className="surface-card">
      <div className="section-heading">
        <div>
          <h3>{schoolLabel}</h3>
          <p>Executive overview for <strong>{periodLabel}</strong></p>
        </div>
        <span className="section-tag">{periodLabel}</span>
      </div>

      <div className="kpi-grid">
        <KPIBox
          title="Total Students"
          value={data.total_students?.toLocaleString() ?? "—"}
          footnote={`Enrolled in ${data.session_name ?? "current session"}`}
        />
        <KPIBox
          title="Average CGPA"
          value={data.avg_cgpa ?? "—"}
          footnote="Cumulative grade point average"
        />
        <KPIBox
          title="Avg Attendance"
          value={data.avg_attendance_pct != null ? `${data.avg_attendance_pct}%` : "N/A"}
          footnote={data.avg_attendance_pct != null ? "School-wide attendance rate" : "Not tracked by this school"}
        />
        <KPIBox
          title="Avg Failing Subjects"
          value={data.avg_failing_subjects ?? "—"}
          footnote={`Per student — ${data.term_name ?? "current term"}`}
        />
        <KPIBox
          title="High Performers"
          value={`${data.high_performer_count ?? 0} (${highPct}%)`}
          footnote="Score ≥ 75 and attendance ≥ 90%"
        />
        <KPIBox
          title="Dropout Risk"
          value={`${data.dropout_risk_count ?? 0} (${riskPct}%)`}
          footnote="Score < 50 or 3+ failing subjects"
        />
        <KPIBox
          title="Improving"
          value={`${data.improving_count ?? 0} (${improvingPct}%)`}
          footnote="Better than previous term"
        />
      </div>

      <div className="overview-grid">
        <div className="overview-note">
          <h3>Quick Interpretation</h3>
          <p>
            All figures below are for <strong>{periodLabel}</strong>.
            Drill into the Students, Performance, or Teachers tabs for deeper analysis.
          </p>
          <ul className="overview-points">
            <li>
              <span>School</span>
              <strong>{data.school_name || schoolLabel}</strong>
            </li>
            <li>
              <span>Session</span>
              <strong>{data.session_name ?? "—"}</strong>
            </li>
            <li>
              <span>Term</span>
              <strong>{data.term_name ?? "—"}</strong>
            </li>
            <li>
              <span>Students at risk</span>
              <strong style={{ color: "var(--danger)" }}>
                {data.dropout_risk_count ?? 0} ({riskPct}%)
              </strong>
            </li>
            <li>
              <span>High performers</span>
              <strong style={{ color: "var(--success)" }}>
                {data.high_performer_count ?? 0} ({highPct}%)
              </strong>
            </li>
            <li>
              <span>Improving students</span>
              <strong style={{ color: "var(--success)" }}>
                {data.improving_count ?? 0} ({improvingPct}%)
              </strong>
            </li>
            <li>
              <span>Avg CGPA</span>
              <strong>{data.avg_cgpa ?? "—"}</strong>
            </li>
          </ul>
        </div>

        <div className="overview-note">
          <h3>Next Steps</h3>
          <p>
            Review the <strong>Students</strong> tab to act on dropout risk flags.
            Use <strong>Performance</strong> to track term-by-term progress.
            Check <strong>Teachers</strong> to identify subject-level support needs.
          </p>
        </div>
      </div>

      <div className="surface-card chart-card" style={{ marginTop: "1.5rem" }}>
        <div className="section-heading">
          <div>
            <h3>Term-by-Term Trend</h3>
            <p>Average score (bars) and pass rate % (line) per term for the selected session.</p>
          </div>
          <select
            className="filter-input"
            value={trendSession}
            onChange={(e) => setTrendSession(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">Current Session</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name}
              </option>
            ))}
          </select>
        </div>
        <div className="chart-frame">
          <TermTrendChart data={termTrend} />
        </div>
      </div>
    </section>
  );
}
