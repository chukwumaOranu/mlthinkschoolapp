import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import KPIBox from "../components/KPIBox";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Pagination, { usePagination } from "../components/Pagination";

const defaultForm = {
  student_id: "",
  student_name: "",
  school_id: "",
  school_name: "",
  school_short_name: "",
  target_type: "student",
  target_id: "",
  target_name: "",
  source_module: "student_success",
  session_id: "",
  term_id: "",
  level_name: "",
  arm_name: "",
  risk_level: "",
  risk_score: "",
  risk_categories: "",
  risk_reasons: "",
  intervention_type: "academic_support",
  assigned_to: "",
  guardian_name: "",
  guardian_email: "",
  due_date: "",
  status: "pending",
  notes: "",
  outcome: "",
};

const TYPES = [
  { value: "academic_support", label: "Academic Support" },
  { value: "guardian_call", label: "Guardian Call" },
  { value: "attendance_warning", label: "Attendance Warning" },
  { value: "fee_followup", label: "Fee Follow-up" },
  { value: "counselling", label: "Counselling" },
  { value: "teacher_review", label: "Teacher Review" },
  { value: "teacher_subject_support", label: "Teacher Subject Support" },
];

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STUDENT_RISK_FILTERS = [
  { value: "action_required", label: "High & Critical" },
  { value: "Critical", label: "Critical Only" },
  { value: "High", label: "High Only" },
  { value: "Medium", label: "Medium Only" },
  { value: "all", label: "All Students" },
];

function csvList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReportDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function schoolLabelFromRows(rows, fallback) {
  const row = rows.find((item) => item.school_short_name || item.school_name || item.school_id);
  return row?.school_short_name || row?.school_name || row?.school_id || fallback || "All Schools";
}

function buildReportHtml({ rows, summary, schoolName, statusFilter }) {
  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const statusLabel = statusFilter ? statusFilter.replaceAll("_", " ") : "All statuses";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(schoolName)} Intervention Report</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        font-family: Inter, Arial, sans-serif;
        font-size: 11px;
      }
      .report-header {
        border-bottom: 2px solid #111827;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .eyebrow {
        color: #4f46e5;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 4px 0;
        font-size: 24px;
        line-height: 1.1;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        color: #4b5563;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        margin: 12px 0 14px;
      }
      .summary-card {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px;
      }
      .summary-card span {
        display: block;
        color: #6b7280;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .summary-card strong {
        display: block;
        margin-top: 2px;
        font-size: 17px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #f3f4f6;
        color: #374151;
        font-size: 9px;
        text-align: left;
        text-transform: uppercase;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 5px;
        vertical-align: top;
      }
      td {
        line-height: 1.35;
      }
      .muted {
        color: #6b7280;
      }
      .footer {
        margin-top: 12px;
        color: #6b7280;
        font-size: 9px;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <header class="report-header">
      <div class="eyebrow">Student Success Intelligence</div>
      <h1>${escapeHtml(schoolName)}</h1>
      <div class="meta">
        <span>Intervention Report</span>
        <span>Filter: ${escapeHtml(statusLabel)}</span>
        <span>Generated: ${escapeHtml(generatedAt)}</span>
      </div>
    </header>

    <section class="summary-grid">
      <div class="summary-card"><span>Total</span><strong>${summary.total || rows.length}</strong></div>
      <div class="summary-card"><span>Pending</span><strong>${summary.pending || 0}</strong></div>
      <div class="summary-card"><span>In Progress</span><strong>${summary.in_progress || 0}</strong></div>
      <div class="summary-card"><span>Completed</span><strong>${summary.completed || 0}</strong></div>
      <div class="summary-card"><span>Overdue</span><strong>${summary.overdue || 0}</strong></div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>Class</th>
          <th>Risk</th>
          <th>Categories</th>
          <th>Action</th>
          <th>Owner</th>
          <th>Due</th>
          <th>Status</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `<tr>
                    <td><strong>${escapeHtml(row.target_name || row.student_name)}</strong><br><span class="muted">${escapeHtml(row.target_id || row.student_id)}</span></td>
                    <td>${escapeHtml(row.level_name || "")}${row.arm_name ? ` / ${escapeHtml(row.arm_name)}` : ""}</td>
                    <td>${escapeHtml(row.risk_level || "")}${row.risk_score != null ? ` (${escapeHtml(row.risk_score)})` : ""}</td>
                    <td>${escapeHtml((row.risk_categories || []).join(", "))}</td>
                    <td>${escapeHtml((row.intervention_type || "").replaceAll("_", " "))}</td>
                    <td>${escapeHtml(row.assigned_to || "Unassigned")}</td>
                    <td>${escapeHtml(formatReportDate(row.due_date))}</td>
                    <td>${escapeHtml((row.status || "").replaceAll("_", " "))}</td>
                    <td>${escapeHtml(row.outcome || row.notes || "")}</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="9">No interventions found for this filter.</td></tr>`
        }
      </tbody>
    </table>
    <div class="footer">Generated by ThinkSchoolApps Academic Intelligence</div>
  </body>
</html>`;
}

function openPdfReport(html) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error("Popup blocked. Allow popups to download the PDF report.");
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.setTimeout(() => {
    reportWindow.print();
  }, 250);
}

function buildPayload(form, schoolId) {
  return {
    school_id: form.school_id || schoolId || null,
    school_name: form.school_name || null,
    school_short_name: form.school_short_name || null,
    target_type: form.target_type || "student",
    target_id: form.target_id || form.student_id || null,
    target_name: form.target_name || form.student_name || null,
    source_module: form.source_module || null,
    student_id: form.student_id ? Number(form.student_id) : null,
    student_name: form.student_name || null,
    session_id: form.session_id ? Number(form.session_id) : null,
    term_id: form.term_id ? Number(form.term_id) : null,
    level_name: form.level_name || null,
    arm_name: form.arm_name || null,
    risk_level: form.risk_level || null,
    risk_score: form.risk_score ? Number(form.risk_score) : null,
    risk_categories: csvList(form.risk_categories),
    risk_reasons: csvList(form.risk_reasons),
    intervention_type: form.intervention_type,
    assigned_to: form.assigned_to || null,
    guardian_name: form.guardian_name || null,
    guardian_email: form.guardian_email || null,
    due_date: form.due_date || null,
    status: form.status,
    notes: form.notes || null,
    outcome: form.outcome || null,
  };
}

export default function Interventions({ schoolId = "" }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [armFilter, setArmFilter] = useState("");
  const [studentRiskFilter, setStudentRiskFilter] = useState("action_required");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentKey, setSelectedStudentKey] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const queryClient = useQueryClient();

  const query = new URLSearchParams();
  if (schoolId) query.set("school_id", schoolId);
  if (statusFilter) query.set("status", statusFilter);
  if (levelFilter) query.set("level_name", levelFilter);
  if (armFilter) query.set("arm_name", armFilter);
  const qs = query.toString();

  const { data: summary = {}, isLoading: summaryLoading } = useQuery({
    queryKey: ["intervention-summary", schoolId, levelFilter, armFilter],
    queryFn: () => {
      const summaryQuery = new URLSearchParams();
      if (schoolId) summaryQuery.set("school_id", schoolId);
      if (levelFilter) summaryQuery.set("level_name", levelFilter);
      if (armFilter) summaryQuery.set("arm_name", armFilter);
      return api.get(`/interventions/summary${summaryQuery.toString() ? `?${summaryQuery.toString()}` : ""}`).then((r) => r.data);
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["interventions", schoolId, statusFilter, levelFilter, armFilter],
    queryFn: () => api.get(`/interventions${qs ? `?${qs}` : ""}`).then((r) => r.data),
  });
  const pagination = usePagination(rows, [schoolId, statusFilter, levelFilter, armFilter]);

  const { data: staff = [] } = useQuery({
    queryKey: ["assignable-staff"],
    queryFn: () => api.get("/staff/assignable").then((r) => r.data),
  });

  const classQuery = new URLSearchParams();
  if (schoolId) classQuery.set("school_id", schoolId);

  const { data: classLevels = [] } = useQuery({
    queryKey: ["intervention-class-levels", schoolId],
    queryFn: () => api.get(`/overview/class-levels${classQuery.toString() ? `?${classQuery.toString()}` : ""}`).then((r) => r.data),
    enabled: Boolean(schoolId),
  });

  const armQuery = new URLSearchParams();
  if (schoolId) armQuery.set("school_id", schoolId);
  if (levelFilter) armQuery.set("level_name", levelFilter);

  const { data: classArms = [] } = useQuery({
    queryKey: ["intervention-class-arms", schoolId, levelFilter],
    queryFn: () => api.get(`/overview/class-arms${armQuery.toString() ? `?${armQuery.toString()}` : ""}`).then((r) => r.data),
    enabled: Boolean(schoolId),
  });

  const studentQuery = new URLSearchParams({ limit: "2000" });
  if (schoolId) studentQuery.set("school_id", schoolId);
  if (levelFilter) studentQuery.set("level_name", levelFilter);
  if (armFilter) studentQuery.set("arm_name", armFilter);

  const { data: successStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["intervention-student-success-options", schoolId, levelFilter, armFilter],
    queryFn: () => api.get(`/student-success/students?${studentQuery.toString()}`).then((r) => r.data),
    enabled: Boolean(schoolId),
  });

  const filteredStudentOptions = successStudents.filter((student) => {
    const needle = studentSearch.toLowerCase();
    const matchesRisk =
      studentRiskFilter === "all" ||
      (studentRiskFilter === "action_required" && ["Critical", "High"].includes(student.risk_level)) ||
      student.risk_level === studentRiskFilter;
    const matchesSearch =
      !needle ||
      (student.full_name || "").toLowerCase().includes(needle) ||
      String(student.student_id || "").includes(needle) ||
      (student.level_name || "").toLowerCase().includes(needle) ||
      (student.arm_name || "").toLowerCase().includes(needle);
    return matchesRisk && matchesSearch;
  });

  const actionRequiredCount = successStudents.filter((student) =>
    ["Critical", "High"].includes(student.risk_level)
  ).length;
  const schoolDisplayName = form.school_short_name || form.school_name || form.school_id || schoolId || "";

  useEffect(() => {
    setForm((current) => ({ ...current, school_id: schoolId || current.school_id }));
  }, [schoolId]);

  useEffect(() => {
    setArmFilter("");
    setSelectedStudentKey("");
  }, [schoolId, levelFilter]);

  useEffect(() => {
    setSelectedStudentKey("");
  }, [armFilter, studentRiskFilter]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["interventions"] });
    await queryClient.invalidateQueries({ queryKey: ["intervention-summary"] });
  };

  const showError = (requestError, fallback) => {
    setError(requestError.response?.data?.detail || fallback);
    setStatus("");
  };

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/interventions", payload),
    onSuccess: async () => {
      setForm({ ...defaultForm, school_id: schoolId });
      setStatus("Intervention created.");
      setError("");
      await refresh();
    },
    onError: (requestError) => showError(requestError, "Unable to create intervention."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/interventions/${id}`, payload),
    onSuccess: async () => {
      setEditingId(null);
      setForm({ ...defaultForm, school_id: schoolId });
      setStatus("Intervention updated.");
      setError("");
      await refresh();
    },
    onError: (requestError) => showError(requestError, "Unable to update intervention."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/interventions/${id}`),
    onSuccess: async () => {
      setStatus("Intervention deleted.");
      setError("");
      await refresh();
    },
    onError: (requestError) => showError(requestError, "Unable to delete intervention."),
  });

  const notifyParentMutation = useMutation({
    mutationFn: (id) => api.post(`/interventions/${id}/notify-parent`),
    onSuccess: async (_, id) => {
      const row = rows.find((item) => item.id === id);
      setStatus(`Parent invitation sent${row?.student_name ? ` for ${row.student_name}` : ""}.`);
      setError("");
      await refresh();
    },
    onError: (requestError) => showError(requestError, "Unable to send parent invitation."),
  });

  const handleExport = async () => {
    const exportQuery = new URLSearchParams();
    if (schoolId) exportQuery.set("school_id", schoolId);
    if (statusFilter) exportQuery.set("status", statusFilter);
    if (levelFilter) exportQuery.set("level_name", levelFilter);
    if (armFilter) exportQuery.set("arm_name", armFilter);

    setIsExporting(true);
    setError("");
    try {
      const response = await api.get(`/interventions/export.csv${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`, {
        responseType: "blob",
      });
      const safeSchool = schoolId || "all-schools";
      const safeStatus = statusFilter || "all-statuses";
      downloadBlob(response.data, `interventions-${safeSchool}-${safeStatus}.csv`);
      setStatus("Intervention export downloaded.");
    } catch (requestError) {
      showError(requestError, "Unable to export interventions.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfReport = async () => {
    const reportQuery = new URLSearchParams({ limit: "5000" });
    if (schoolId) reportQuery.set("school_id", schoolId);
    if (statusFilter) reportQuery.set("status", statusFilter);
    if (levelFilter) reportQuery.set("level_name", levelFilter);
    if (armFilter) reportQuery.set("arm_name", armFilter);

    setIsPdfExporting(true);
    setError("");
    try {
      const response = await api.get(`/interventions${reportQuery.toString() ? `?${reportQuery.toString()}` : ""}`);
      const reportRows = response.data || [];
      const schoolName = schoolLabelFromRows(reportRows, schoolId);
      openPdfReport(buildReportHtml({ rows: reportRows, summary, schoolName, statusFilter }));
      setStatus("PDF report opened. Choose Save as PDF in the print dialog.");
    } catch (requestError) {
      showError(requestError, requestError.message || "Unable to generate PDF report.");
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!schoolId && !form.school_id) {
      setError("Select a school before creating an intervention.");
      setStatus("");
      return;
    }
    const payload = buildPayload(form, schoolId);
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const selectStudent = (studentKey) => {
    setSelectedStudentKey(studentKey);
    const student = successStudents.find((row) => `${row.school_id}-${row.student_id}-${row.session_id}-${row.term_id}` === studentKey);
    if (!student) return;
    const suggestedType = student.recommended_action?.toLowerCase().includes("guardian")
      ? "guardian_call"
      : student.recommended_action?.toLowerCase().includes("fee")
      ? "fee_followup"
      : student.recommended_action?.toLowerCase().includes("attendance")
      ? "attendance_warning"
      : "academic_support";
    setForm((current) => ({
      ...current,
      student_id: String(student.student_id),
      student_name: student.full_name || "",
      target_type: "student",
      target_id: String(student.student_id),
      target_name: student.full_name || "",
      source_module: "student_success",
      school_id: student.school_id || schoolId || "",
      school_name: student.school_name || "",
      school_short_name: student.school_short_name || "",
      session_id: student.session_id ? String(student.session_id) : "",
      term_id: student.term_id ? String(student.term_id) : "",
      level_name: student.level_name || "",
      arm_name: student.arm_name || "",
      risk_level: student.risk_level || "",
      risk_score: student.risk_score != null ? String(student.risk_score) : "",
      risk_categories: (student.risk_categories || []).join(", "),
      risk_reasons: (student.risk_reasons || []).join(", "),
      intervention_type: current.intervention_type || suggestedType,
      guardian_name: current.guardian_name,
      guardian_email: current.guardian_email,
      notes: current.notes || student.recommended_action || "",
    }));
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setSelectedStudentKey("");
    setForm({
      student_id: row.student_id ? String(row.student_id) : "",
      student_name: row.student_name || "",
      target_type: row.target_type || "student",
      target_id: row.target_id || (row.student_id ? String(row.student_id) : ""),
      target_name: row.target_name || row.student_name || "",
      source_module: row.source_module || "student_success",
      school_id: row.school_id || schoolId || "",
      school_name: row.school_name || "",
      school_short_name: row.school_short_name || "",
      session_id: row.session_id ? String(row.session_id) : "",
      term_id: row.term_id ? String(row.term_id) : "",
      level_name: row.level_name || "",
      arm_name: row.arm_name || "",
      risk_level: row.risk_level || "",
      risk_score: row.risk_score != null ? String(row.risk_score) : "",
      risk_categories: (row.risk_categories || []).join(", "),
      risk_reasons: (row.risk_reasons || []).join(", "),
      intervention_type: row.intervention_type || "academic_support",
      assigned_to: row.assigned_to || "",
      guardian_name: row.guardian_name || "",
      guardian_email: row.guardian_email || "",
      due_date: row.due_date || "",
      status: row.status || "pending",
      notes: row.notes || "",
      outcome: row.outcome || "",
    });
  };

  return (
    <section className="admin-stack">
      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>Intervention Queue</h3>
            <p>Create, assign, track, and close student support actions.</p>
          </div>
          <span className="section-tag">Action Tracking</span>
        </div>

        {summaryLoading ? (
          <LoadingSkeleton rows={2} />
        ) : (
          <div className="kpi-grid">
            <KPIBox title="Total" value={summary.total || 0} footnote="All support actions" />
            <KPIBox title="Pending" value={summary.pending || 0} footnote="Awaiting action" />
            <KPIBox title="In Progress" value={summary.in_progress || 0} footnote="Being handled" />
            <KPIBox title="Completed" value={summary.completed || 0} footnote="Closed interventions" />
            <KPIBox title="Overdue" value={summary.overdue || 0} footnote="Past due date" />
          </div>
        )}

        {status ? <div className="status-banner success">{status}</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}
        {!schoolId ? (
          <div className="status-banner error">
            Select a school from the dashboard school view before creating interventions.
          </div>
        ) : null}
      </div>

      <form className="surface-card" onSubmit={handleSubmit}>
        <div className="section-heading compact">
          <div>
            <h3>{editingId ? "Edit Intervention" : "Create Intervention"}</h3>
            <p>Select a real student from the Databricks-backed success watchlist, then assign the support action.</p>
          </div>
          {editingId ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => { setEditingId(null); setForm({ ...defaultForm, school_id: schoolId }); }}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field-group">
            <label htmlFor="intervention-class-level-filter">Class Level</label>
            <select
              id="intervention-class-level-filter"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              disabled={Boolean(editingId) || !schoolId}
            >
              <option value="">All Class Levels</option>
              {classLevels.map((item) => (
                <option key={item.level_name} value={item.level_name}>
                  {item.level_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="intervention-class-arm-filter">Class Arm</label>
            <select
              id="intervention-class-arm-filter"
              value={armFilter}
              onChange={(e) => setArmFilter(e.target.value)}
              disabled={Boolean(editingId) || !schoolId}
            >
              <option value="">All Class Arms</option>
              {classArms.map((item) => (
                <option key={item.arm_name} value={item.arm_name}>
                  {item.arm_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="intervention-risk-filter">Student Risk</label>
            <select
              id="intervention-risk-filter"
              value={studentRiskFilter}
              onChange={(e) => setStudentRiskFilter(e.target.value)}
              disabled={Boolean(editingId) || !schoolId}
            >
              {STUDENT_RISK_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="student-search">Search Student</label>
            <input
              id="student-search"
              type="search"
              placeholder="Search by name, ID, class level, or arm"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              disabled={Boolean(editingId)}
            />
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="student-select">Student From Live Data</label>
            <select
              id="student-select"
              value={selectedStudentKey}
              onChange={(e) => selectStudent(e.target.value)}
              disabled={Boolean(editingId) || studentsLoading}
              required={!editingId}
            >
              <option value="">
                {studentsLoading
                  ? "Loading students..."
                  : `Select a student (${filteredStudentOptions.length} shown, ${actionRequiredCount} high/critical)`}
              </option>
              {!schoolId ? <option value="" disabled>Select a school first</option> : null}
              {filteredStudentOptions.map((student) => {
                const key = `${student.school_id}-${student.student_id}-${student.session_id}-${student.term_id}`;
                return (
                  <option key={key} value={key}>
                    {student.school_short_name || student.school_name || student.school_id} · {student.full_name} · {student.level_name || "Class"} {student.arm_name || ""} · {student.term_name || "Term"} · {student.risk_level} ({student.risk_score})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="school-id">School</label>
            <input id="school-id" value={schoolDisplayName} readOnly required />
          </div>
          <div className="field-group">
            <label htmlFor="student-id">Student ID</label>
            <input id="student-id" value={form.student_id} readOnly required />
          </div>
          <div className="field-group">
            <label htmlFor="student-name">Student Name</label>
            <input id="student-name" value={form.student_name} readOnly required />
          </div>
          <div className="field-group">
            <label htmlFor="level-name">Class Level</label>
            <input id="level-name" value={form.level_name} readOnly />
          </div>
          <div className="field-group">
            <label htmlFor="arm-name">Class Arm</label>
            <input id="arm-name" value={form.arm_name} readOnly />
          </div>
          <div className="field-group">
            <label htmlFor="period">Period</label>
            <input id="period" value={`${form.session_id || "Session"} / ${form.term_id || "Term"}`} readOnly />
          </div>
          <div className="field-group">
            <label htmlFor="risk-level">Risk</label>
            <input id="risk-level" value={`${form.risk_level || "—"}${form.risk_score ? ` · ${form.risk_score}` : ""}`} readOnly />
          </div>
          <div className="field-group">
            <label htmlFor="intervention-type">Intervention Type</label>
            <select id="intervention-type" value={form.intervention_type} onChange={(e) => setForm({ ...form, intervention_type: e.target.value })}>
              {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="assigned-to">Assigned To</label>
            <select id="assigned-to" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.label}>
                  {member.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="guardian-name">Parent / Guardian Name</label>
            <input
              id="guardian-name"
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              placeholder="e.g. Mrs Okafor"
            />
          </div>
          <div className="field-group">
            <label htmlFor="guardian-email">Parent / Guardian Email</label>
            <input
              id="guardian-email"
              type="email"
              value={form.guardian_email}
              onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
              placeholder="parent@example.com"
            />
          </div>
          <div className="field-group">
            <label htmlFor="due-date">Due Date</label>
            <input id="due-date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="field-group">
            <label htmlFor="intervention-status">Status</label>
            <select id="intervention-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="risk-categories">Risk Categories</label>
            <input id="risk-categories" value={form.risk_categories} readOnly />
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="risk-reasons">Risk Reasons</label>
            <textarea id="risk-reasons" rows="3" value={form.risk_reasons} readOnly />
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="field-group field-span-full">
            <label htmlFor="outcome">Outcome</label>
            <textarea id="outcome" rows="3" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
          </div>
        </div>

        <button type="submit" className="primary-button">
          {editingId ? "Update Intervention" : "Create Intervention"}
        </button>
      </form>

      <div className="surface-card table-card">
        <div className="table-toolbar">
          <div>
            <h3>Support Actions</h3>
            <p className="muted-text">Track ownership, due dates, notes, and outcomes.</p>
          </div>
          <div className="table-actions">
            <button type="button" className="ghost-button" onClick={handleExport} disabled={isExporting || isLoading}>
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
            <button type="button" className="ghost-button" onClick={handlePdfReport} disabled={isPdfExporting || isLoading}>
              {isPdfExporting ? "Preparing..." : "PDF Report"}
            </button>
            <select className="filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div>
              <h3>No interventions yet</h3>
              <p>Create one from this page or from the Student Success watchlist.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>School</th>
                  <th>Class</th>
                  <th>Risk</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Parent</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Parent Invite</th>
                  <th>Outcome</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="student-cell">
                          <strong>{row.target_name || row.student_name || "—"}</strong>
                          <span>{row.target_type || "student"} · {row.target_id || row.student_id || "—"}</span>
                      </div>
                    </td>
                    <td>{row.school_short_name || row.school_name || row.school_id || "—"}</td>
                    <td>{row.level_name || "—"}{row.arm_name ? <span className="numeric-subtle"> · {row.arm_name}</span> : null}</td>
                    <td>{row.risk_level || "—"}{row.risk_score != null ? <span className="numeric-subtle"> · {row.risk_score}</span> : null}</td>
                    <td>{row.intervention_type.replaceAll("_", " ")}</td>
                    <td>{row.assigned_to || "Unassigned"}</td>
                    <td>
                      <div className="student-cell">
                        <strong>{row.guardian_name || "—"}</strong>
                        <span>{row.guardian_email || "No email"}</span>
                      </div>
                    </td>
                    <td>{formatDate(row.due_date)}</td>
                    <td><span className="table-badge warn">{row.status.replaceAll("_", " ")}</span></td>
                    <td>
                      <div className="student-cell">
                        <span className={`table-badge ${row.parent_notification_status === "sent" ? "good" : row.parent_notification_status === "failed" ? "danger" : "warn"}`}>
                          {row.parent_notification_status || "not sent"}
                        </span>
                        {row.parent_notified_at ? <span>{formatDate(row.parent_notified_at)}</span> : null}
                      </div>
                    </td>
                    <td>{row.outcome || "—"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={() => notifyParentMutation.mutate(row.id)}
                          disabled={!row.guardian_email || notifyParentMutation.isPending}
                        >
                          Notify Parent
                        </button>
                        <button type="button" className="ghost-button mini" onClick={() => startEdit(row)}>Edit</button>
                        <button type="button" className="ghost-button mini danger" onClick={() => deleteMutation.mutate(row.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <Pagination {...pagination} onPageChange={pagination.setPage} />
          </>
        )}
      </div>
    </section>
  );
}
