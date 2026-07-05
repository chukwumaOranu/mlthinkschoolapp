import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import Pagination, { usePagination } from "../components/Pagination";

const TEMPLATES = [
  {
    filename: "schools.csv",
    purpose: "School identity and display name",
    content: "school_id,school_name,school_short_name,country,local_authority,urn\ngreenfield_academy,Greenfield Academy,Greenfield,UK,Manchester,123456\n",
  },
  {
    filename: "students.csv",
    purpose: "Pupil identity, year group, and registration group",
    content: "school_id,student_id,upn,mis_student_id,first_name,last_name,full_name,gender,date_of_birth,year_group,registration_group,enrolment_status\ngreenfield_academy,10001,A123456789001,44501,Aisha,Khan,Aisha Khan,F,2013-04-12,Year 7,7A,active\n",
  },
  {
    filename: "classes.csv",
    purpose: "Year group and class arm mapping",
    content: "school_id,year_group,registration_group,class_level,class_arm,tutor_staff_id\ngreenfield_academy,Year 7,7A,Year 7,7A,T001\n",
  },
  {
    filename: "staff.csv",
    purpose: "Teachers, analysts, and intervention owners",
    content: "school_id,staff_id,first_name,last_name,full_name,email,role,active\ngreenfield_academy,T001,Emma,Williams,Emma Williams,emma.williams@school.org,Teacher,true\n",
  },
  {
    filename: "attendance.csv",
    purpose: "Attendance rate and absence signals",
    content: "school_id,student_id,academic_year,term,possible_sessions,present_sessions,authorised_absence_sessions,unauthorised_absence_sessions,attendance_rate\ngreenfield_academy,10001,2025/2026,Autumn,120,104,8,8,86.67\n",
  },
  {
    filename: "subjects.csv",
    purpose: "Subject catalogue",
    content: "school_id,subject_id,subject_name,department\ngreenfield_academy,MATH,Mathematics,STEM\n",
  },
  {
    filename: "assessments.csv",
    purpose: "Scores, grades, subjects, and assessment periods",
    content: "school_id,student_id,academic_year,term,subject_id,subject_name,assessment_name,score,total,grade,assessment_date\ngreenfield_academy,10001,2025/2026,Autumn,MATH,Mathematics,Autumn Assessment,62,100,6,2025-11-20\n",
  },
  {
    filename: "support_flags.csv",
    purpose: "Optional support and vulnerability flags",
    content: "school_id,student_id,sen_status,eal,fsm,pupil_premium,looked_after_child,young_carer,safeguarding_flag\ngreenfield_academy,10001,K,false,true,true,false,false,false\n",
  },
  {
    filename: "interventions.csv",
    purpose: "Optional existing intervention actions",
    content: "school_id,student_id,academic_year,term,class_level,class_arm,intervention_type,assigned_to,due_date,status,notes,outcome\ngreenfield_academy,10001,2025/2026,Autumn,Year 7,7A,attendance_warning,T001,2025-12-10,pending,Contact guardian,\n",
  },
];

const REQUIRED_COLUMNS = {
  "schools.csv": ["school_id", "school_name"],
  "students.csv": ["school_id", "student_id", "full_name", "year_group"],
  "classes.csv": ["school_id", "year_group", "class_level"],
  "staff.csv": ["school_id", "staff_id", "full_name", "role"],
  "attendance.csv": ["school_id", "student_id", "academic_year", "term", "possible_sessions", "present_sessions"],
  "subjects.csv": ["school_id", "subject_id", "subject_name"],
  "assessments.csv": ["school_id", "student_id", "academic_year", "term", "subject_id", "score", "total"],
};

const OPTIONAL_COLUMNS = {
  "support_flags.csv": ["school_id", "student_id"],
  "interventions.csv": ["school_id", "student_id", "intervention_type", "status"],
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

function numeric(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  Object.entries(OPTIONAL_COLUMNS).forEach(([filename, columns]) => {
    if (!parsedFiles[filename]) return;
    const headers = parsedFiles[filename].headers;
    const missing = columns.filter((column) => !headers.includes(column));
    if (missing.length) {
      issues.push({ severity: "error", file: filename, message: `Missing columns: ${missing.join(", ")}.` });
    }
  });

  const students = parsedFiles["students.csv"]?.rows || [];
  const studentKeys = new Set();
  students.forEach((row, index) => {
    const key = `${row.school_id || ""}/${row.student_id || row.mis_student_id || ""}`;
    if (studentKeys.has(key)) {
      issues.push({ severity: "error", file: "students.csv", row: index + 2, message: `Duplicate student key: ${key}.` });
    }
    studentKeys.add(key);
    if (!row.year_group) {
      issues.push({ severity: "warning", file: "students.csv", row: index + 2, message: "year_group is missing." });
    }
  });

  (parsedFiles["attendance.csv"]?.rows || []).forEach((row, index) => {
    const key = `${row.school_id || ""}/${row.student_id || ""}`;
    const possible = numeric(row.possible_sessions);
    const present = numeric(row.present_sessions);
    const rate = numeric(row.attendance_rate);
    if (!studentKeys.has(key)) {
      issues.push({ severity: "error", file: "attendance.csv", row: index + 2, message: `Unknown student key: ${key}.` });
    }
    if (!possible || possible <= 0) {
      issues.push({ severity: "error", file: "attendance.csv", row: index + 2, message: "possible_sessions must be greater than zero." });
    }
    if (present != null && possible != null && present > possible) {
      issues.push({ severity: "error", file: "attendance.csv", row: index + 2, message: "present_sessions cannot exceed possible_sessions." });
    }
    if (rate != null && (rate < 0 || rate > 100)) {
      issues.push({ severity: "error", file: "attendance.csv", row: index + 2, message: "attendance_rate must be between 0 and 100." });
    }
  });

  (parsedFiles["assessments.csv"]?.rows || []).forEach((row, index) => {
    const key = `${row.school_id || ""}/${row.student_id || ""}`;
    const score = numeric(row.score);
    const total = numeric(row.total);
    if (!studentKeys.has(key)) {
      issues.push({ severity: "error", file: "assessments.csv", row: index + 2, message: `Unknown student key: ${key}.` });
    }
    if (score == null) {
      issues.push({ severity: "error", file: "assessments.csv", row: index + 2, message: "score must be numeric." });
    }
    if (!total || total <= 0) {
      issues.push({ severity: "error", file: "assessments.csv", row: index + 2, message: "total must be greater than zero." });
    }
    if (score != null && total != null && score > total) {
      issues.push({ severity: "warning", file: "assessments.csv", row: index + 2, message: "score is greater than total." });
    }
  });

  return issues;
}

function countRows(parsedFiles, filename) {
  return parsedFiles[filename]?.rows?.length || 0;
}

function hasSensitiveFlags(parsedFiles) {
  const rows = parsedFiles["support_flags.csv"]?.rows || [];
  return rows.some((row) =>
    ["sen_status", "eal", "fsm", "pupil_premium", "looked_after_child", "young_carer", "safeguarding_flag"]
      .some((column) => row[column] && row[column].toLowerCase() !== "false")
  );
}

function mapStudentPreview(parsedFiles) {
  const classRows = parsedFiles["classes.csv"]?.rows || [];
  const classMap = new Map(classRows.map((row) => [
    `${row.school_id}/${row.year_group}/${row.registration_group}`,
    row,
  ]));

  return (parsedFiles["students.csv"]?.rows || []).map((student) => {
    const classKey = `${student.school_id}/${student.year_group}/${student.registration_group}`;
    const classRow = classMap.get(classKey) || {};
    return {
      school_id: student.school_id,
      student_id: student.student_id || student.mis_student_id,
      external_id: student.upn || student.mis_student_id || "",
      full_name: student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      class_level: classRow.class_level || student.year_group,
      class_arm: classRow.class_arm || student.registration_group,
      enrolment_status: student.enrolment_status || "active",
    };
  });
}

function mappedStudentCsv(rows) {
  const headers = ["school_id", "student_id", "external_id", "full_name", "class_level", "class_arm", "enrolment_status"];
  const body = rows.map((row) => headers.map((header) => `"${String(row[header] || "").replaceAll('"', '""')}"`).join(","));
  return [headers.join(","), ...body].join("\n");
}

function batchBadgeTone(batch) {
  if (batch.error_count || batch.status === "failed") return "danger";
  if (["approved_for_pipeline", "imported_to_analytics"].includes(batch.status)) return "good";
  return "warn";
}

export default function UKImport() {
  const [issues, setIssues] = useState([]);
  const [parsedFiles, setParsedFiles] = useState({});
  const [status, setStatus] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["uk-import-batches"],
    queryFn: () => api.get("/uk-imports/batches").then((response) => response.data),
  });

  const issueCounts = useMemo(() => ({
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  }), [issues]);

  const mappedStudents = useMemo(() => mapStudentPreview(parsedFiles), [parsedFiles]);
  const issuePagination = usePagination(issues, [issues]);
  const batchPagination = usePagination(batches, [batches]);
  const mappedStudentPagination = usePagination(mappedStudents, [mappedStudents]);
  const importCounts = useMemo(() => ({
    schools: countRows(parsedFiles, "schools.csv"),
    students: countRows(parsedFiles, "students.csv"),
    classes: countRows(parsedFiles, "classes.csv"),
    staff: countRows(parsedFiles, "staff.csv"),
    attendance: countRows(parsedFiles, "attendance.csv"),
    assessments: countRows(parsedFiles, "assessments.csv"),
    supportFlags: countRows(parsedFiles, "support_flags.csv"),
    interventions: countRows(parsedFiles, "interventions.csv"),
  }), [parsedFiles]);
  const sensitiveDetected = useMemo(() => hasSensitiveFlags(parsedFiles), [parsedFiles]);
  const readiness = issueCounts.errors
    ? "Needs Fixes"
    : Object.keys(parsedFiles).length
    ? sensitiveDetected
      ? "Review Sensitive Fields"
      : "Ready For Mapping"
    : "Awaiting Files";

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
      : "Validation passed. Files are ready for pilot mapping review.");
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (schoolId) formData.append("school_id", schoolId);
      selectedFiles.forEach((file) => formData.append("files", file));
      return api.post("/uk-imports/batches", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: async (response) => {
      const batch = response.data;
      setIssues(batch.issues || []);
      setStatus(batch.error_count
        ? `Batch ${batch.batch_id} uploaded with validation errors.`
        : `Batch ${batch.batch_id} staged and ready for mapping.`);
      await queryClient.invalidateQueries({ queryKey: ["uk-import-batches"] });
    },
    onError: (requestError) => {
      setStatus(requestError.response?.data?.detail || "Unable to stage import batch.");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (batchId) => api.post(`/uk-imports/batches/${batchId}/approve`),
    onSuccess: async (response) => {
      const batch = response.data;
      setStatus(`Batch ${batch.batch_id} approved for pipeline. Mapped files created.`);
      await queryClient.invalidateQueries({ queryKey: ["uk-import-batches"] });
    },
    onError: (requestError) => {
      setStatus(requestError.response?.data?.detail || "Unable to approve batch for pipeline.");
    },
  });

  const importMutation = useMutation({
    mutationFn: (batchId) => api.post(`/uk-imports/batches/${batchId}/import-analytics`),
    onSuccess: async (response) => {
      const batch = response.data;
      setStatus(`Batch ${batch.batch_id} imported into analytics. MySQL snapshot refreshed.`);
      await queryClient.invalidateQueries({ queryKey: ["uk-import-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (requestError) => {
      setStatus(requestError.response?.data?.detail || "Unable to import batch into analytics.");
    },
  });

  return (
    <section className="admin-stack">
      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>UK CSV Import Readiness</h3>
            <p>Download pilot templates, collect MIS exports, and validate files before pipeline mapping.</p>
          </div>
          <span className="section-tag">Phase 1</span>
        </div>

        {status ? <div className={`status-banner ${issueCounts.errors ? "error" : "success"}`}>{status}</div> : null}

        <div className="kpi-grid">
          <div className="kpi-box"><span>Required Files</span><strong>{Object.keys(REQUIRED_COLUMNS).length}</strong><p>Minimum pilot dataset</p></div>
          <div className="kpi-box"><span>Optional Files</span><strong>{Object.keys(OPTIONAL_COLUMNS).length}</strong><p>Support and interventions</p></div>
          <div className="kpi-box"><span>Errors</span><strong>{issueCounts.errors}</strong><p>Must fix before import</p></div>
          <div className="kpi-box"><span>Warnings</span><strong>{issueCounts.warnings}</strong><p>Review with school</p></div>
          <div className="kpi-box"><span>Readiness</span><strong>{readiness}</strong><p>Current file state</p></div>
        </div>
      </div>

      <div className="surface-card table-card">
        <div className="table-toolbar">
          <div>
            <h3>CSV Templates</h3>
            <p className="muted-text">Use these files for manual UK school pilots before Wonde or direct MIS connectors.</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => TEMPLATES.forEach((template) => downloadText(template.filename, template.content))}
          >
            Download All
          </button>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Purpose</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map((template) => (
                <tr key={template.filename}>
                  <td><strong>{template.filename}</strong></td>
                  <td>{template.purpose}</td>
                  <td>
                    <button type="button" className="ghost-button mini" onClick={() => downloadText(template.filename, template.content)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card">
        <div className="section-heading compact">
          <div>
            <h3>Validate CSV Files</h3>
            <p>Select the completed CSV files from a pilot school. Validation runs in the browser and does not import data.</p>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="uk-csv-files">Pilot CSV files</label>
          <input ref={fileInputRef} id="uk-csv-files" type="file" accept=".csv" multiple onChange={handleFiles} />
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field-group">
            <label htmlFor="uk-school-id">School ID For Staging</label>
            <input
              id="uk-school-id"
              placeholder="Example: greenfield_academy"
              value={schoolId}
              onChange={(event) => setSchoolId(event.target.value)}
            />
          </div>
          <div className="field-group">
            <label>Backend Staging</label>
            <button
              type="button"
              className="primary-button"
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFiles.length || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Staging..." : "Stage Upload Batch"}
            </button>
          </div>
        </div>

        {issues.length ? (
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>File</th>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
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
            <p className="muted-text">Batches are staged only. They do not write to Databricks or run the pipeline.</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["uk-import-batches"] })}
          >
            Refresh
          </button>
        </div>

        {batchesLoading ? (
          <div className="empty-state compact-empty">
            <div>
              <h3>Loading batches</h3>
              <p>Checking staged upload history.</p>
            </div>
          </div>
        ) : batches.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>School</th>
                  <th>Status</th>
                  <th>Files</th>
                  <th>Errors</th>
                  <th>Warnings</th>
                  <th>Mapped Files</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
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
                    <td>{batch.mapped_files?.length || 0}</td>
                    <td>{batch.created_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.created_at)) : "-"}</td>
                    <td>
                      {batch.status === "ready_for_mapping" ? (
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={() => approveMutation.mutate(batch.batch_id)}
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </button>
                      ) : ["approved_for_pipeline", "analytics_import_failed"].includes(batch.status) ? (
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={() => importMutation.mutate(batch.batch_id)}
                          disabled={importMutation.isPending}
                        >
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
          <div className="empty-state compact-empty">
            <div>
              <h3>No staged imports yet</h3>
              <p>Select CSV files, validate them, then stage an upload batch.</p>
            </div>
          </div>
        )}
      </div>

      {Object.keys(parsedFiles).length ? (
        <div className="surface-card table-card">
          <div className="table-toolbar">
            <div>
              <h3>Mapping Preview</h3>
              <p className="muted-text">Shows how UK MIS files will map into the existing DeepAcademia structure before import.</p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => downloadText("mapped_students_preview.csv", mappedStudentCsv(mappedStudents))}
              disabled={!mappedStudents.length}
            >
              Export Mapped Students
            </button>
          </div>

          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi-box"><span>Students</span><strong>{importCounts.students}</strong><p>Mapped to student dimension</p></div>
            <div className="kpi-box"><span>Classes</span><strong>{importCounts.classes}</strong><p>Year group to class level</p></div>
            <div className="kpi-box"><span>Attendance</span><strong>{importCounts.attendance}</strong><p>Rows for absence/risk</p></div>
            <div className="kpi-box"><span>Assessments</span><strong>{importCounts.assessments}</strong><p>Rows for performance</p></div>
            <div className="kpi-box"><span>Staff</span><strong>{importCounts.staff}</strong><p>Possible action owners</p></div>
            <div className="kpi-box"><span>Sensitive</span><strong>{sensitiveDetected ? "Yes" : "No"}</strong><p>Support flag review</p></div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source Field</th>
                  <th>Mapped Field</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>year_group</td><td>class_level</td><td>Used for class-level filtering and reports.</td></tr>
                <tr><td>registration_group</td><td>class_arm</td><td>Used for class-arm filtering and intervention targeting.</td></tr>
                <tr><td>academic_year</td><td>session</td><td>Used as the academic session.</td></tr>
                <tr><td>term</td><td>term</td><td>Used as the reporting term.</td></tr>
                <tr><td>student_id / mis_student_id</td><td>student_id</td><td>Stable key used across attendance, assessment, and support rows.</td></tr>
                <tr><td>possible_sessions / present_sessions</td><td>attendance_rate</td><td>Used for absenteeism and intervention risk.</td></tr>
                <tr><td>score / total</td><td>performance score</td><td>Used for academic risk and progress analysis.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="table-toolbar" style={{ marginTop: 20 }}>
            <div>
              <h3>Mapped Student Preview</h3>
              <p className="muted-text">First records after applying UK field mapping.</p>
            </div>
            <span className="table-chip">{mappedStudents.length} students</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Student ID</th>
                  <th>External ID</th>
                  <th>Name</th>
                  <th>Class Level</th>
                  <th>Class Arm</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mappedStudentPagination.paginatedItems.map((row) => (
                  <tr key={`${row.school_id}-${row.student_id}`}>
                    <td>{row.school_id}</td>
                    <td>{row.student_id}</td>
                    <td>{row.external_id || "-"}</td>
                    <td>{row.full_name}</td>
                    <td>{row.class_level || "-"}</td>
                    <td>{row.class_arm || "-"}</td>
                    <td>{row.enrolment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...mappedStudentPagination} onPageChange={mappedStudentPagination.setPage} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
