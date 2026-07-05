import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Pagination, { usePagination } from "../components/Pagination";

export default function Attendance({ schoolId = "" }) {
  const [sessionFilter, setSessionFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [armFilter, setArmFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

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
  if (termFilter) classParams.set("term_id", termFilter);

  const { data: levels = [] } = useQuery({
    queryKey: ["class-levels", schoolId, sessionFilter, termFilter],
    queryFn: () => {
      const q = classParams.toString();
      return api.get(`/overview/class-levels${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const armParams = new URLSearchParams(classParams);
  if (levelFilter) armParams.set("level_name", levelFilter);

  const { data: arms = [] } = useQuery({
    queryKey: ["class-arms", schoolId, sessionFilter, termFilter, levelFilter],
    queryFn: () => {
      const q = armParams.toString();
      return api.get(`/overview/class-arms${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const params = new URLSearchParams({ limit: "300" });
  if (schoolId) params.set("school_id", schoolId);
  if (sessionFilter) params.set("session_id", sessionFilter);
  if (termFilter) params.set("term_id", termFilter);
  if (levelFilter) params.set("level_name", levelFilter);
  if (armFilter) params.set("arm_name", armFilter);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["attendance", sessionFilter, termFilter, levelFilter, armFilter, schoolId],
    queryFn: () =>
      api.get(`/attendance?${params.toString()}`).then((r) => r.data),
  });

  const avgRate =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + (r.attendance_rate ?? 0), 0) / rows.length
      : null;

  const lowCount = rows.filter((r) => (r.attendance_rate ?? 1) < 0.7).length;
  const pagination = usePagination(rows, [schoolId, sessionFilter, termFilter, levelFilter, armFilter]);
  const createActionMutation = useMutation({
    mutationFn: (row) => {
      const rate = row.attendance_rate ?? null;
      return api.post("/interventions", {
        school_id: row.school_id || schoolId || null,
        school_name: row.school_name || null,
        school_short_name: row.school_short_name || null,
        target_type: "attendance",
        target_id: String(row.student_id || row.registration_number || row.student_name || "attendance"),
        target_name: row.student_name || "Attendance follow-up",
        source_module: "attendance",
        student_id: row.student_id || null,
        student_name: row.student_name || null,
        session_id: row.session_id || null,
        term_id: row.term_id || null,
        level_name: row.level_name || null,
        arm_name: row.arm_name || null,
        risk_level: rate != null && rate < 0.7 ? "High" : "Medium",
        risk_score: rate != null ? Math.max(0, Math.round((1 - rate) * 100)) : null,
        risk_categories: ["Attendance Risk"],
        risk_reasons: [`Attendance rate is ${rate != null ? `${(rate * 100).toFixed(1)}%` : "not available"}.`],
        intervention_type: "attendance_warning",
        status: "pending",
        notes: "Follow up on attendance pattern and contact guardian if needed.",
      });
    },
    onSuccess: async (_, row) => {
      setStatusMessage(`Attendance action created for ${row.student_name || "student"}.`);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["interventions"] });
      await queryClient.invalidateQueries({ queryKey: ["intervention-summary"] });
    },
    onError: (requestError) => {
      setError(requestError.response?.data?.detail || "Unable to create attendance action.");
      setStatusMessage("");
    },
  });

  return (
    <section className="surface-card table-card">
      <div className="section-heading">
        <div>
          <h3>Attendance Records</h3>
          <p>
            Term-level attendance summary per student. Only populated if your school
            tracks attendance data in the system.
          </p>
        </div>
        <span className="section-tag">Attendance Tracking</span>
      </div>

      <div className="filter-bar">
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
          <select
            className="filter-input"
            value={termFilter}
            onChange={(e) => { setTermFilter(e.target.value); setLevelFilter(""); setArmFilter(""); }}
          >
            <option value="">All Terms</option>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>
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

        {rows.length > 0 && (
          <div className="att-summary-chips">
            <span className="table-chip">
              Avg rate: <strong>{(avgRate * 100).toFixed(1)}%</strong>
            </span>
            {lowCount > 0 && (
              <span className="table-chip att-chip-danger">
                {lowCount} below 70%
              </span>
            )}
          </div>
        )}
      </div>

      {statusMessage ? <div className="status-banner success">{statusMessage}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div>
            <h3>No attendance data</h3>
            <p>
              This school may not capture attendance, or no records match your
              filters. Attendance is optional in the pipeline.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-toolbar">
            <span className="table-chip">{rows.length} attendance records</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Session</th>
                  <th>Term</th>
                  <th>Level / Arm</th>
                  <th>Days Present</th>
                  <th>Total Days</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((r, i) => {
                  const rate = r.attendance_rate ?? null;
                  const pct = rate != null ? (rate * 100).toFixed(1) : null;
                  const status =
                    rate == null
                      ? { label: "—", cls: "" }
                      : rate >= 0.9
                      ? { label: "Excellent", cls: "good" }
                      : rate >= 0.7
                      ? { label: "Adequate", cls: "warn" }
                      : { label: "Low", cls: "danger" };

                  return (
                    <tr key={i}>
                      <td>
                        <div className="student-cell">
                          <strong>{r.student_name ?? "—"}</strong>
                          <span>{r.registration_number ?? ""}</span>
                        </div>
                      </td>
                      <td>{r.session_name ?? "—"}</td>
                      <td>Term {r.term_id}</td>
                      <td>
                        <span>{r.level_name ?? "—"}</span>
                        {r.arm_name && (
                          <span className="numeric-subtle"> · {r.arm_name}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.days_present ?? "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.total_days ?? "—"}
                      </td>
                      <td>
                        <strong
                          style={{
                            color:
                              rate == null
                                ? "inherit"
                                : rate >= 0.9
                                ? "var(--success)"
                                : rate < 0.7
                                ? "var(--danger)"
                                : "inherit",
                          }}
                        >
                          {pct != null ? `${pct}%` : "—"}
                        </strong>
                      </td>
                      <td>
                        {status.cls ? (
                          <span className={`table-badge ${status.cls}`}>
                            {status.label}
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
                          disabled={createActionMutation.isPending || !schoolId}
                        >
                          Create Action
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
