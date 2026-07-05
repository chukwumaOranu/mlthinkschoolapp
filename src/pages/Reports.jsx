import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import KPIBox from "../components/KPIBox";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Pagination, { usePagination } from "../components/Pagination";

const REPORT_TYPES = [
  { value: "retention_risk", label: "Retention Risk" },
  { value: "vulnerable_support", label: "Vulnerable Student Support" },
  { value: "intervention_tracking", label: "Intervention Tracking" },
  { value: "leadership_summary", label: "Leadership Summary" },
];

function buildQuery(filters) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  return qs.toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadText(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function reportSchoolName(schoolId, schools) {
  const school = schools.find((item) => item.school_id === schoolId);
  return school?.school_short_name || school?.school_name || schoolId || "All Schools";
}

function successCsv(rows) {
  const headers = [
    "School",
    "Student ID",
    "Student Name",
    "Session",
    "Term",
    "Class Level",
    "Class Arm",
    "Risk Level",
    "Risk Score",
    "Categories",
    "Reasons",
    "Recommended Action",
  ];
  const body = rows.map((row) => [
    row.school_short_name || row.school_name || row.school_id,
    row.student_id,
    row.full_name,
    row.session_name || row.session_id,
    row.term_name || row.term_id,
    row.level_name,
    row.arm_name,
    row.risk_level,
    row.risk_score,
    row.risk_categories,
    row.risk_reasons,
    row.recommended_action,
  ]);
  return [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

function interventionCsv(rows) {
  const headers = [
    "School",
    "Student ID",
    "Student Name",
    "Session ID",
    "Term ID",
    "Class Level",
    "Class Arm",
    "Risk Level",
    "Risk Score",
    "Intervention Type",
    "Assigned To",
    "Due Date",
    "Status",
    "Outcome",
  ];
  const body = rows.map((row) => [
    row.school_short_name || row.school_name || row.school_id,
    row.student_id,
    row.student_name,
    row.session_id,
    row.term_id,
    row.level_name,
    row.arm_name,
    row.risk_level,
    row.risk_score,
    (row.intervention_type || "").replaceAll("_", " "),
    row.assigned_to || "Unassigned",
    row.due_date,
    (row.status || "").replaceAll("_", " "),
    row.outcome || row.notes,
  ]);
  return [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

function buildPdfHtml({ schoolName, reportTitle, reportRows, interventionRows, summary, interventionSummary }) {
  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  const studentRowsHtml = reportRows
    .slice(0, 120)
    .map((row) => `<tr>
      <td><strong>${escapeHtml(row.full_name)}</strong><br><span>${escapeHtml(row.student_id)}</span></td>
      <td>${escapeHtml(row.level_name || "")}${row.arm_name ? ` / ${escapeHtml(row.arm_name)}` : ""}</td>
      <td>${escapeHtml(row.risk_level)} ${row.risk_score != null ? `(${escapeHtml(row.risk_score)})` : ""}</td>
      <td>${escapeHtml((row.risk_categories || []).join(", "))}</td>
      <td>${escapeHtml((row.risk_reasons || []).join(" | "))}</td>
      <td>${escapeHtml(row.recommended_action || "")}</td>
    </tr>`)
    .join("");

  const interventionRowsHtml = interventionRows
    .slice(0, 120)
    .map((row) => `<tr>
      <td><strong>${escapeHtml(row.student_name)}</strong><br><span>${escapeHtml(row.student_id)}</span></td>
      <td>${escapeHtml(row.level_name || "")}${row.arm_name ? ` / ${escapeHtml(row.arm_name)}` : ""}</td>
      <td>${escapeHtml(row.risk_level || "")}</td>
      <td>${escapeHtml((row.intervention_type || "").replaceAll("_", " "))}</td>
      <td>${escapeHtml(row.assigned_to || "Unassigned")}</td>
      <td>${escapeHtml(formatDate(row.due_date))}</td>
      <td>${escapeHtml((row.status || "").replaceAll("_", " "))}</td>
      <td>${escapeHtml(row.outcome || row.notes || "")}</td>
    </tr>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(schoolName)} ${escapeHtml(reportTitle)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font-family: Inter, Arial, sans-serif; font-size: 10.5px; }
      header { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
      .eyebrow { color: #4f46e5; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 4px 0; font-size: 23px; line-height: 1.1; }
      h2 { margin: 16px 0 8px; font-size: 14px; }
      .meta { display: flex; justify-content: space-between; gap: 12px; color: #4b5563; }
      .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0 14px; }
      .card { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
      .card span { display: block; color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; }
      .card strong { display: block; margin-top: 2px; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #f3f4f6; color: #374151; font-size: 8.5px; text-transform: uppercase; }
      th, td { border: 1px solid #d1d5db; padding: 5px; text-align: left; vertical-align: top; }
      td span { color: #6b7280; }
      .footer { margin-top: 12px; color: #6b7280; font-size: 9px; text-align: right; }
    </style>
  </head>
  <body>
    <header>
      <div class="eyebrow">Student Success Intelligence</div>
      <h1>${escapeHtml(schoolName)}</h1>
      <div class="meta">
        <span>${escapeHtml(reportTitle)}</span>
        <span>Generated: ${escapeHtml(generatedAt)}</span>
      </div>
    </header>
    <section class="summary">
      <div class="card"><span>Total Students</span><strong>${summary?.total_students || 0}</strong></div>
      <div class="card"><span>Flagged</span><strong>${summary?.flagged_students || 0}</strong></div>
      <div class="card"><span>Critical</span><strong>${summary?.critical_risk || 0}</strong></div>
      <div class="card"><span>High</span><strong>${summary?.high_risk || 0}</strong></div>
      <div class="card"><span>Open Actions</span><strong>${(interventionSummary?.pending || 0) + (interventionSummary?.in_progress || 0)}</strong></div>
    </section>
    <h2>Risk and Support Students</h2>
    <table>
      <thead><tr><th>Student</th><th>Class</th><th>Risk</th><th>Categories</th><th>Reasons</th><th>Recommended Action</th></tr></thead>
      <tbody>${studentRowsHtml || `<tr><td colspan="6">No student risk rows found for this filter.</td></tr>`}</tbody>
    </table>
    <h2>Intervention Tracking</h2>
    <table>
      <thead><tr><th>Student</th><th>Class</th><th>Risk</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th>Outcome</th></tr></thead>
      <tbody>${interventionRowsHtml || `<tr><td colspan="8">No intervention rows found for this filter.</td></tr>`}</tbody>
    </table>
    <div class="footer">Generated by ThinkSchoolApps Academic Intelligence</div>
  </body>
</html>`;
}

function openPrintReport(html) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error("Popup blocked. Allow popups to generate the PDF report.");
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.setTimeout(() => reportWindow.print(), 250);
}

export default function Reports({ schoolId = "" }) {
  const [reportType, setReportType] = useState("retention_risk");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const baseFilters = {
    school_id: schoolId,
    session_id: sessionId,
    term_id: termId,
    level_name: levelName,
    arm_name: armName,
  };

  const { data: schools = [] } = useQuery({
    queryKey: ["report-schools"],
    queryFn: () => api.get("/overview/schools").then((r) => r.data),
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["report-periods", schoolId],
    queryFn: () => {
      const q = buildQuery({ school_id: schoolId });
      return api.get(`/students/periods${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  const classQuery = buildQuery({ school_id: schoolId, session_id: sessionId, term_id: termId });
  const { data: levels = [] } = useQuery({
    queryKey: ["report-levels", schoolId, sessionId, termId],
    queryFn: () => api.get(`/overview/class-levels${classQuery ? `?${classQuery}` : ""}`).then((r) => r.data),
  });

  const armQuery = buildQuery({ school_id: schoolId, session_id: sessionId, term_id: termId, level_name: levelName });
  const { data: arms = [] } = useQuery({
    queryKey: ["report-arms", schoolId, sessionId, termId, levelName],
    queryFn: () => api.get(`/overview/class-arms${armQuery ? `?${armQuery}` : ""}`).then((r) => r.data),
  });

  const successQuery = buildQuery({ ...baseFilters, limit: "2000" });
  const { data: successRows = [], isLoading: successLoading } = useQuery({
    queryKey: ["report-success-rows", schoolId, sessionId, termId, levelName, armName],
    queryFn: () => api.get(`/student-success/students${successQuery ? `?${successQuery}` : ""}`).then((r) => r.data),
  });

  const summaryQuery = buildQuery(baseFilters);
  const { data: successSummary = {}, isLoading: summaryLoading } = useQuery({
    queryKey: ["report-success-summary", schoolId, sessionId, termId, levelName, armName],
    queryFn: () => api.get(`/student-success/summary${summaryQuery ? `?${summaryQuery}` : ""}`).then((r) => r.data),
  });

  const interventionQuery = buildQuery({ ...baseFilters, limit: "5000" });
  const { data: interventionRows = [], isLoading: interventionsLoading } = useQuery({
    queryKey: ["report-interventions", schoolId, sessionId, termId, levelName, armName],
    queryFn: () => api.get(`/interventions${interventionQuery ? `?${interventionQuery}` : ""}`).then((r) => r.data),
  });

  const { data: interventionSummary = {} } = useQuery({
    queryKey: ["report-intervention-summary", schoolId, sessionId, termId, levelName, armName],
    queryFn: () => api.get(`/interventions/summary${summaryQuery ? `?${summaryQuery}` : ""}`).then((r) => r.data),
  });

  const sessions = Array.from(new Map(periods.map((period) => [period.session_id, period])).values());
  const terms = periods.filter((period) => !sessionId || String(period.session_id) === String(sessionId));
  const schoolName = reportSchoolName(schoolId, schools);

  const reportRows = useMemo(() => {
    if (reportType === "retention_risk") {
      return successRows.filter((row) =>
        ["Critical", "High"].includes(row.risk_level) || (row.risk_categories || []).includes("Retention Risk")
      );
    }
    if (reportType === "vulnerable_support") {
      return successRows.filter((row) =>
        (row.risk_score || 0) >= 25 ||
        (row.risk_categories || []).some((category) =>
          ["Academic Risk", "Attendance Risk", "Retention Risk", "Fee Risk"].includes(category)
        )
      );
    }
    return successRows.filter((row) => ["Critical", "High"].includes(row.risk_level));
  }, [reportType, successRows]);

  const reportPagination = usePagination(reportRows, [reportRows, reportType]);
  const interventionPagination = usePagination(interventionRows, [interventionRows, reportType]);
  const reportTitle = REPORT_TYPES.find((item) => item.value === reportType)?.label || "Report";
  const isLoading = successLoading || summaryLoading || interventionsLoading;

  const handleCsv = () => {
    const filenameBase = `${reportType}-${schoolId || "all-schools"}`;
    if (reportType === "intervention_tracking") {
      downloadText(`${filenameBase}.csv`, interventionCsv(interventionRows));
    } else {
      downloadText(`${filenameBase}.csv`, successCsv(reportRows));
    }
    setStatus("CSV report downloaded.");
    setError("");
  };

  const handlePdf = () => {
    try {
      openPrintReport(buildPdfHtml({
        schoolName,
        reportTitle,
        reportRows,
        interventionRows,
        summary: successSummary,
        interventionSummary,
      }));
      setStatus("PDF report opened. Choose Save as PDF in the print dialog.");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to open PDF report.");
      setStatus("");
    }
  };

  return (
    <section className="admin-stack">
      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>Reports & Evidence Pack</h3>
            <p>Produce school-ready exports for risk review, vulnerable learner support, and intervention tracking.</p>
          </div>
          <span className="section-tag">UK MIS Ready</span>
        </div>

        {status ? <div className="status-banner success">{status}</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}

        <div className="filter-bar">
          <div className="filter-inputs">
            <select className="filter-input" value={reportType} onChange={(event) => setReportType(event.target.value)}>
              {REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select
              className="filter-input"
              value={sessionId}
              onChange={(event) => { setSessionId(event.target.value); setTermId(""); setLevelName(""); setArmName(""); }}
            >
              <option value="">All Sessions</option>
              {sessions.map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {session.session_name || session.session_id}
                </option>
              ))}
            </select>
            <select className="filter-input" value={termId} onChange={(event) => { setTermId(event.target.value); setLevelName(""); setArmName(""); }}>
              <option value="">All Terms</option>
              {terms.map((term) => (
                <option key={`${term.session_id}-${term.term_id}`} value={term.term_id}>
                  {term.term_name || `Term ${term.term_id}`}
                </option>
              ))}
            </select>
            <select className="filter-input" value={levelName} onChange={(event) => { setLevelName(event.target.value); setArmName(""); }}>
              <option value="">All Class Levels</option>
              {levels.map((level) => <option key={level.level_name} value={level.level_name}>{level.level_name}</option>)}
            </select>
            <select className="filter-input" value={armName} onChange={(event) => setArmName(event.target.value)}>
              <option value="">All Class Arms</option>
              {arms.map((arm) => <option key={arm.arm_name} value={arm.arm_name}>{arm.arm_name}</option>)}
            </select>
          </div>
          <div className="table-actions">
            <button type="button" className="ghost-button" onClick={handleCsv} disabled={isLoading}>Export CSV</button>
            <button type="button" className="ghost-button" onClick={handlePdf} disabled={isLoading}>PDF Report</button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className="kpi-grid">
            <KPIBox title="School" value={schoolName} footnote="Current report scope" />
            <KPIBox title="Flagged" value={successSummary.flagged_students || 0} footnote="Students with risk signal" />
            <KPIBox title="Critical" value={successSummary.critical_risk || 0} footnote="Immediate support" />
            <KPIBox title="High" value={successSummary.high_risk || 0} footnote="Priority monitoring" />
            <KPIBox title="Open Actions" value={(interventionSummary.pending || 0) + (interventionSummary.in_progress || 0)} footnote="Pending or in progress" />
          </div>
        )}
      </div>

      <div className="surface-card table-card">
        <div className="table-toolbar">
          <div>
            <h3>{reportTitle}</h3>
            <p className="muted-text">Preview of the current report before export.</p>
          </div>
          <span className="table-chip">{reportType === "intervention_tracking" ? interventionRows.length : reportRows.length} rows</span>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : reportType === "intervention_tracking" ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Risk</th>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {interventionPagination.paginatedItems.map((row) => (
                  <tr key={row.id}>
                    <td><div className="student-cell"><strong>{row.student_name}</strong><span>{row.student_id}</span></div></td>
                    <td>{row.level_name || "-"}{row.arm_name ? <span className="numeric-subtle"> / {row.arm_name}</span> : null}</td>
                    <td>{row.risk_level || "-"}</td>
                    <td>{(row.intervention_type || "").replaceAll("_", " ")}</td>
                    <td>{row.assigned_to || "Unassigned"}</td>
                    <td>{formatDate(row.due_date) || "-"}</td>
                    <td><span className="table-badge warn">{(row.status || "").replaceAll("_", " ")}</span></td>
                    <td>{row.outcome || row.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <Pagination {...interventionPagination} onPageChange={interventionPagination.setPage} />
          </>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Risk</th>
                  <th>Categories</th>
                  <th>Reasons</th>
                  <th>Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {reportPagination.paginatedItems.map((row) => (
                  <tr key={`${row.school_id}-${row.student_id}-${row.session_id}-${row.term_id}`}>
                    <td><div className="student-cell"><strong>{row.full_name}</strong><span>{row.student_id}</span></div></td>
                    <td>{row.level_name || "-"}{row.arm_name ? <span className="numeric-subtle"> / {row.arm_name}</span> : null}</td>
                    <td>{row.risk_level} <span className="numeric-subtle">{row.risk_score}</span></td>
                    <td>{(row.risk_categories || []).join(", ")}</td>
                    <td>{(row.risk_reasons || []).join("; ")}</td>
                    <td>{row.recommended_action || "-"}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <Pagination {...reportPagination} onPageChange={reportPagination.setPage} />
          </>
        )}
      </div>
    </section>
  );
}
