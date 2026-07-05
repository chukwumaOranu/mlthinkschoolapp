import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import Pagination, { usePagination } from "../components/Pagination";

const TEMPLATES = [
  {
    filename: "schools.csv",
    purpose: "School identity",
    content: "school_id,school_name,school_short_name,country,state\nlagos_demo_college,Lagos Demo College,LDC,Nigeria,Lagos\n",
  },
  {
    filename: "academic_sessions.csv",
    purpose: "Academic sessions",
    content: "school_id,session_id,session_name,current\nlagos_demo_college,2026,2025/2026,1\n",
  },
  {
    filename: "classes.csv",
    purpose: "Levels, arms, and level arms",
    content: "school_id,level_id,level_name,arm_id,arm_name,level_arm_id\nlagos_demo_college,7,JSS 1,1,A,701\n",
  },
  {
    filename: "students.csv",
    purpose: "Student identity and class assignment",
    content: "school_id,student_id,full_name,gender,dob,level_id,level_arm_id,registration_number\nlagos_demo_college,10001,Chinedu Okafor,Male,2013-05-14,7,701,LDC-10001\n",
  },
  {
    filename: "subjects.csv",
    purpose: "Subject catalogue",
    content: "school_id,subject_id,subject_name\nlagos_demo_college,101,Mathematics\n",
  },
  {
    filename: "scores.csv",
    purpose: "Scores and term performance",
    content: "school_id,student_id,session_id,term_id,subject_id,exam,ca_scores,total,grade\nlagos_demo_college,10001,2026,1,101,42,28,70,A\n",
  },
  {
    filename: "staff.csv",
    purpose: "Optional teachers and staff",
    content: "school_id,staff_id,full_name,email,active\nlagos_demo_college,501,Ada Balogun,ada.balogun@school.org,true\n",
  },
  {
    filename: "subject_teachers.csv",
    purpose: "Optional teacher-subject mapping",
    content: "school_id,staff_id,subject_id,level_id\nlagos_demo_college,501,101,7\n",
  },
];

const REQUIRED_COLUMNS = {
  "schools.csv": ["school_id", "school_name"],
  "academic_sessions.csv": ["school_id", "session_id", "session_name"],
  "classes.csv": ["school_id", "level_id", "level_name", "arm_id", "arm_name", "level_arm_id"],
  "students.csv": ["school_id", "student_id", "full_name", "level_id", "level_arm_id"],
  "subjects.csv": ["school_id", "subject_id", "subject_name"],
  "scores.csv": ["school_id", "student_id", "session_id", "term_id", "subject_id", "total"],
};

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((item) => item.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((record, header, index) => {
      record[header] = (values[index] || "").trim();
      return record;
    }, {});
  });
  return { headers, rows };
}

async function readFiles(files) {
  const entries = await Promise.all(Array.from(files).map(async (file) => ({
    name: file.name,
    text: await file.text(),
  })));
  return Object.fromEntries(entries.map((entry) => [entry.name, parseCsv(entry.text)]));
}

function validateFiles(parsedFiles) {
  const issues = [];
  Object.entries(REQUIRED_COLUMNS).forEach(([filename, columns]) => {
    if (!parsedFiles[filename]) {
      issues.push({ severity: "error", file: filename, message: "Required file is missing." });
      return;
    }
    const headers = parsedFiles[filename].headers;
    const missing = columns.filter((column) => !headers.includes(column));
    if (missing.length) {
      issues.push({ severity: "error", file: filename, message: `Missing columns: ${missing.join(", ")}.` });
    }
  });

  const students = new Set((parsedFiles["students.csv"]?.rows || []).map((row) => `${row.school_id}/${row.student_id}`));
  const subjects = new Set((parsedFiles["subjects.csv"]?.rows || []).map((row) => `${row.school_id}/${row.subject_id}`));
  const sessions = new Set((parsedFiles["academic_sessions.csv"]?.rows || []).map((row) => `${row.school_id}/${row.session_id}`));
  const levelArms = new Set((parsedFiles["classes.csv"]?.rows || []).map((row) => `${row.school_id}/${row.level_arm_id}`));

  (parsedFiles["students.csv"]?.rows || []).forEach((row, index) => {
    if (!levelArms.has(`${row.school_id}/${row.level_arm_id}`)) {
      issues.push({ severity: "error", file: "students.csv", row: index + 2, message: "Unknown level_arm_id for this school." });
    }
  });

  (parsedFiles["scores.csv"]?.rows || []).forEach((row, index) => {
    if (!students.has(`${row.school_id}/${row.student_id}`)) {
      issues.push({ severity: "error", file: "scores.csv", row: index + 2, message: "Unknown student_id for this school." });
    }
    if (!subjects.has(`${row.school_id}/${row.subject_id}`)) {
      issues.push({ severity: "error", file: "scores.csv", row: index + 2, message: "Unknown subject_id for this school." });
    }
    if (!sessions.has(`${row.school_id}/${row.session_id}`)) {
      issues.push({ severity: "error", file: "scores.csv", row: index + 2, message: "Unknown session_id for this school." });
    }
    if (!Number.isFinite(Number(row.total))) {
      issues.push({ severity: "error", file: "scores.csv", row: index + 2, message: "total must be numeric." });
    }
  });

  return issues;
}

function countRows(parsedFiles, filename) {
  return parsedFiles[filename]?.rows?.length || 0;
}

function batchBadgeTone(batch) {
  if (batch.error_count || batch.status === "failed" || batch.status === "analytics_import_failed") return "danger";
  if (batch.status === "imported_to_analytics") return "good";
  return "warn";
}

export default function NigeriaImport() {
  const [issues, setIssues] = useState([]);
  const [parsedFiles, setParsedFiles] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["nigeria-import-batches"],
    queryFn: () => api.get("/nigeria-imports/batches").then((response) => response.data),
  });

  const issueCounts = useMemo(() => ({
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  }), [issues]);

  const importCounts = useMemo(() => ({
    schools: countRows(parsedFiles, "schools.csv"),
    sessions: countRows(parsedFiles, "academic_sessions.csv"),
    classes: countRows(parsedFiles, "classes.csv"),
    students: countRows(parsedFiles, "students.csv"),
    subjects: countRows(parsedFiles, "subjects.csv"),
    scores: countRows(parsedFiles, "scores.csv"),
  }), [parsedFiles]);
  const issuePagination = usePagination(issues, [issues]);
  const batchPagination = usePagination(batches, [batches]);

  const handleFiles = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    setSelectedFiles(Array.from(files));
    const nextParsedFiles = await readFiles(files);
    const nextIssues = validateFiles(nextParsedFiles);
    setParsedFiles(nextParsedFiles);
    setIssues(nextIssues);
    setStatus(nextIssues.some((issue) => issue.severity === "error")
      ? "Validation completed with errors."
      : "Validation passed. Files are ready for analytics import.");
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (schoolId) formData.append("school_id", schoolId);
      selectedFiles.forEach((file) => formData.append("files", file));
      return api.post("/nigeria-imports/batches", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: async (response) => {
      const batch = response.data;
      setIssues(batch.issues || []);
      setStatus(batch.error_count
        ? `Batch ${batch.batch_id} uploaded with validation errors.`
        : `Batch ${batch.batch_id} staged and ready for analytics import.`);
      await queryClient.invalidateQueries({ queryKey: ["nigeria-import-batches"] });
    },
    onError: (requestError) => {
      setStatus(requestError.response?.data?.detail || "Unable to stage Nigeria import batch.");
    },
  });

  const importMutation = useMutation({
    mutationFn: (batchId) => api.post(`/nigeria-imports/batches/${batchId}/import-analytics`),
    onSuccess: async (response) => {
      const batch = response.data;
      setStatus(`Batch ${batch.batch_id} imported into analytics. MySQL snapshot refreshed.`);
      await queryClient.invalidateQueries({ queryKey: ["nigeria-import-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (requestError) => {
      setStatus(requestError.response?.data?.detail || "Unable to import Nigeria batch into analytics.");
    },
  });

  return (
    <section className="admin-stack">
      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>Nigeria CSV Import</h3>
            <p>Onboard schools that already use the Nigeria / ThinkSchool-style data model.</p>
          </div>
          <span className="section-tag">Same Model</span>
        </div>
        {status ? <div className={`status-banner ${issueCounts.errors ? "error" : "success"}`}>{status}</div> : null}
        <div className="kpi-grid">
          <div className="kpi-box"><span>Students</span><strong>{importCounts.students}</strong><p>Student dimension</p></div>
          <div className="kpi-box"><span>Scores</span><strong>{importCounts.scores}</strong><p>Performance facts</p></div>
          <div className="kpi-box"><span>Subjects</span><strong>{importCounts.subjects}</strong><p>Subject catalogue</p></div>
          <div className="kpi-box"><span>Classes</span><strong>{importCounts.classes}</strong><p>Level arms</p></div>
          <div className="kpi-box"><span>Errors</span><strong>{issueCounts.errors}</strong><p>Must fix before import</p></div>
        </div>
      </div>

      <div className="surface-card table-card">
        <div className="table-toolbar">
          <div>
            <h3>CSV Templates</h3>
            <p className="muted-text">Use these files for schools with data close to the existing Nigeria model.</p>
          </div>
          <button type="button" className="ghost-button" onClick={() => TEMPLATES.forEach((template) => downloadText(template.filename, template.content))}>
            Download All
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Template</th><th>Purpose</th><th>Action</th></tr></thead>
            <tbody>
              {TEMPLATES.map((template) => (
                <tr key={template.filename}>
                  <td><strong>{template.filename}</strong></td>
                  <td>{template.purpose}</td>
                  <td><button type="button" className="ghost-button mini" onClick={() => downloadText(template.filename, template.content)}>Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card">
        <div className="section-heading compact">
          <div>
            <h3>Validate And Stage</h3>
            <p>Select completed CSV files. Validation checks required columns and important joins.</p>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="nigeria-csv-files">Nigeria school CSV files</label>
          <input id="nigeria-csv-files" type="file" accept=".csv" multiple onChange={handleFiles} />
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field-group">
            <label htmlFor="nigeria-school-id">School ID For Staging</label>
            <input id="nigeria-school-id" placeholder="Example: lagos_demo_college" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} />
          </div>
          <div className="field-group">
            <label>Backend Staging</label>
            <button type="button" className="primary-button" onClick={() => uploadMutation.mutate()} disabled={!selectedFiles.length || uploadMutation.isPending}>
              {uploadMutation.isPending ? "Staging..." : "Stage Upload Batch"}
            </button>
          </div>
        </div>

        {issues.length ? (
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead><tr><th>Severity</th><th>File</th><th>Row</th><th>Message</th></tr></thead>
              <tbody>
                {issuePagination.paginatedItems.map((issue, index) => (
                  <tr key={`${issue.file}-${issue.row || "file"}-${index}`}>
                    <td><span className={`table-badge ${issue.severity === "error" ? "danger" : "warn"}`}>{issue.severity}</span></td>
                    <td>{issue.file}</td>
                    <td>{issue.row || "-"}</td>
                    <td>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...issuePagination} onPageChange={issuePagination.setPage} />
          </div>
        ) : null}
      </div>

      <div className="surface-card table-card">
        <div className="table-toolbar">
          <div>
            <h3>Import History</h3>
            <p className="muted-text">Ready batches can be imported directly into the analytics layers.</p>
          </div>
          <button type="button" className="ghost-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["nigeria-import-batches"] })}>Refresh</button>
        </div>
        {isLoading ? (
          <div className="empty-state compact-empty"><div><h3>Loading batches</h3><p>Checking staged upload history.</p></div></div>
        ) : batches.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Batch</th><th>School</th><th>Status</th><th>Files</th><th>Errors</th><th>Warnings</th><th>Created</th><th>Action</th></tr>
              </thead>
              <tbody>
                {batchPagination.paginatedItems.map((batch) => (
                  <tr key={batch.batch_id}>
                    <td><strong>{batch.batch_id}</strong></td>
                    <td>{batch.school_id || "unspecified"}</td>
                    <td><span className={`table-badge ${batchBadgeTone(batch)}`}>{batch.status.replaceAll("_", " ")}</span></td>
                    <td>{batch.file_count}</td>
                    <td>{batch.error_count}</td>
                    <td>{batch.warning_count}</td>
                    <td>{batch.created_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.created_at)) : "-"}</td>
                    <td>
                      {["ready_for_import", "analytics_import_failed"].includes(batch.status) ? (
                        <button type="button" className="ghost-button mini" onClick={() => importMutation.mutate(batch.batch_id)} disabled={importMutation.isPending}>
                          {importMutation.isPending ? "Importing..." : "Import"}
                        </button>
                      ) : batch.status === "imported_to_analytics" ? (
                        <span className="table-chip">Imported</span>
                      ) : (
                        <span className="muted-text">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...batchPagination} onPageChange={batchPagination.setPage} />
          </div>
        ) : (
          <div className="empty-state compact-empty"><div><h3>No staged imports yet</h3><p>Select CSV files, validate them, then stage an upload batch.</p></div></div>
        )}
      </div>
    </section>
  );
}
