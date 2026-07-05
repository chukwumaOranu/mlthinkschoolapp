import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import SubjectChart from "../components/SubjectChart";
import LoadingSkeleton from "../components/LoadingSkeleton";

export default function Subjects({ schoolId = "" }) {
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", schoolId],
    queryFn: () => {
      const schoolQs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/overview/sessions${schoolQs}`).then((r) => r.data);
    },
  });

  const qs = new URLSearchParams();
  if (schoolId) qs.set("school_id", schoolId);
  if (sessionId) qs.set("session_id", sessionId);
  if (termId) qs.set("term_id", termId);

  const { data = [], isLoading } = useQuery({
    queryKey: ["subjects", sessionId, termId, schoolId],
    queryFn: () => {
      const q = qs.toString();
      return api.get(`/subjects${q ? `?${q}` : ""}`).then((r) => r.data);
    },
  });

  if (isLoading) {
    return (
      <section className="surface-card">
        <LoadingSkeleton rows={4} />
      </section>
    );
  }

  const first = data[0];
  const periodLabel = first?.session_name && first?.term_name
    ? `${first.term_name}, ${first.session_name} Session`
    : "Current Term";

  return (
    <section className="surface-card chart-card">
      <div className="section-heading">
        <div>
          <h3>Subject Performance</h3>
          <p>
            Average score, pass rate, and excellence count per subject — <strong>{periodLabel}</strong>.
            Dashed lines mark the pass threshold (50) and excellence threshold (75).
          </p>
        </div>
        <div className="filter-inputs" style={{ gap: "0.5rem", display: "flex" }}>
          <select
            className="filter-input"
            value={sessionId}
            onChange={(e) => { setSessionId(e.target.value); setTermId(""); }}
          >
            <option value="">Current Session</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            <option value="">Current Term</option>
            <option value="1">First Term</option>
            <option value="2">Second Term</option>
            <option value="3">Third Term</option>
          </select>
        </div>
      </div>

      <SubjectChart data={data} />
    </section>
  );
}
