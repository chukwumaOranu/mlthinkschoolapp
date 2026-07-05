import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import KPIBox from "../components/KPIBox";
import LoadingSkeleton from "../components/LoadingSkeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


const PAGE_SIZE = 30;
const RISK_COLORS = {
  "High Risk": "#dc2626",
  "Medium Risk": "#d97706",
  "Low Risk": "#0284c7",
  Paid: "#16a34a",
};


function money(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}


function riskClass(riskBand) {
  if (riskBand === "Paid" || riskBand === "Low Risk") return "good";
  if (riskBand === "Medium Risk") return "warn";
  return "danger";
}


function periodLabel(row) {
  const school = row.school_short_name || row.school_name || row.school_id || "School";
  return `${school} · ${row.session_name || "Session"} · ${row.term_name || "Term"}`;
}


function compactMoney(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}


function percent(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(1)}%`;
}


function OwnerDecisionInsights({ totals, collectionRate }) {
  const outstandingPct = totals.allocated > 0 ? (totals.outstanding / totals.allocated) * 100 : 0;
  const highRiskPct = totals.students > 0 ? (totals.highRisk / totals.students) * 100 : 0;
  const paidPct = totals.allocated > 0 ? (totals.paid / totals.allocated) * 100 : 0;
  const points = [
    {
      label: "Collection Health",
      value: collectionRate,
      tone: paidPct >= 70 ? "good" : paidPct >= 45 ? "warn" : "danger",
      text: paidPct >= 70
        ? "Collections are moving well. Keep reminders focused on balances still open."
        : "Collections need attention. Use the risk chart to target the term with the biggest gap.",
    },
    {
      label: "Outstanding Exposure",
      value: percent(outstandingPct),
      tone: outstandingPct <= 20 ? "good" : outstandingPct <= 45 ? "warn" : "danger",
      text: "This is the share of assigned fees still unpaid or uncovered by waivers.",
    },
    {
      label: "High-Risk Balances",
      value: percent(highRiskPct),
      tone: highRiskPct <= 10 ? "good" : highRiskPct <= 25 ? "warn" : "danger",
      text: "These students need payment follow-up before the term closes.",
    },
  ];

  return (
    <div className="insight-grid">
      {points.map((point) => (
        <div key={point.label} className={`insight-card ${point.tone}`}>
          <span>{point.label}</span>
          <strong>{point.value}</strong>
          <p>{point.text}</p>
        </div>
      ))}
    </div>
  );
}


function FeeRiskBandChart({ rows }) {
  const data = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = `${row.school_id}-${row.session_id}-${row.term_id}`;
      const current = grouped.get(key) || {
        period: periodLabel(row),
        total: 0,
        Paid: 0,
        "Low Risk": 0,
        "Medium Risk": 0,
        "High Risk": 0,
      };
      const band = row.fee_risk_band || "High Risk";
      current[band] = (current[band] || 0) + (row.student_count || 0);
      current.total += row.student_count || 0;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).slice(0, 8);
  }, [rows]);

  if (!data.length) return null;

  return (
    <div className="chart-panel chart-card">
      <div className="section-heading compact">
        <div>
          <h3>Risk Bands By Term</h3>
          <p>Shows how many students are paid, low risk, medium risk, or high risk in each fee period.</p>
        </div>
      </div>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 18, left: -8, bottom: 48 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: "#64748b", fontSize: 11 }} angle={-28} textAnchor="end" interval={0} height={72} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip formatter={(value, name) => [`${value} students`, name]} />
            <Legend />
            <Bar dataKey="Paid" stackId="risk" fill={RISK_COLORS.Paid} radius={[0, 0, 4, 4]} />
            <Bar dataKey="Low Risk" stackId="risk" fill={RISK_COLORS["Low Risk"]} />
            <Bar dataKey="Medium Risk" stackId="risk" fill={RISK_COLORS["Medium Risk"]} />
            <Bar dataKey="High Risk" stackId="risk" fill={RISK_COLORS["High Risk"]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function OutstandingComparisonChart({ rows }) {
  const data = useMemo(() => rows.slice(0, 8).map((row) => ({
    period: periodLabel(row),
    Paid: row.total_fees_paid || 0,
    Outstanding: row.total_fees_outstanding || 0,
    Allocated: row.total_fees_allocated || 0,
    collectionRate: row.collection_rate_pct || 0,
  })), [rows]);

  if (!data.length) return null;

  return (
    <div className="chart-panel chart-card">
      <div className="section-heading compact">
        <div>
          <h3>Paid Vs Outstanding</h3>
          <p>Term comparison of collected money against remaining balances.</p>
        </div>
      </div>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 18, left: -8, bottom: 48 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: "#64748b", fontSize: 11 }} angle={-28} textAnchor="end" interval={0} height={72} />
            <YAxis yAxisId="money" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={compactMoney} />
            <YAxis yAxisId="rate" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value, name) => name === "Collection %" ? [`${value}%`, name] : [money(value), name]} />
            <Legend />
            <Bar yAxisId="money" dataKey="Paid" fill="#16a34a" radius={[5, 5, 0, 0]} />
            <Bar yAxisId="money" dataKey="Outstanding" fill="#dc2626" radius={[5, 5, 0, 0]} />
            <Line yAxisId="rate" type="monotone" dataKey="collectionRate" name="Collection %" stroke="#4338ca" strokeWidth={3} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function WaiverImpactChart({ rows }) {
  const data = rows.slice(0, 8).map((row) => ({
    period: periodLabel(row),
    Waived: row.total_waived_amount || 0,
    Paid: row.total_fees_paid || 0,
    "Collection %": row.collection_rate_pct || 0,
  }));
  const waiverTotal = data.reduce((sum, row) => sum + row.Waived, 0);

  return (
    <div className="chart-panel chart-card">
      <div className="section-heading compact">
        <div>
          <h3>Waiver Impact</h3>
          <p>Compares discounts with actual collection, so owners can judge whether waivers support payment behavior.</p>
        </div>
      </div>
      {data.length === 0 || waiverTotal === 0 ? (
        <div className="empty-state compact-empty">
          <div>
            <h3>No waivers recorded yet</h3>
            <p>When waivers exist, this chart will show whether discounted students are also improving collections.</p>
          </div>
        </div>
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 18, left: -8, bottom: 48 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: "#64748b", fontSize: 11 }} angle={-28} textAnchor="end" interval={0} height={72} />
              <YAxis yAxisId="money" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={compactMoney} />
              <YAxis yAxisId="rate" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value, name) => name === "Collection %" ? [`${value}%`, name] : [money(value), name]} />
              <Legend />
              <Bar yAxisId="money" dataKey="Waived" fill="#d97706" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="money" dataKey="Paid" fill="#16a34a" radius={[5, 5, 0, 0]} />
              <Line yAxisId="rate" type="monotone" dataKey="Collection %" stroke="#4338ca" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


export default function Fees({ schoolId = "" }) {
  const [riskBand, setRiskBand] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [page, setPage] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: periods = [] } = useQuery({
    queryKey: ["fees-periods", schoolId],
    queryFn: () => {
      const qs = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : "";
      return api.get(`/fees/periods${qs}`).then((r) => r.data);
    },
  });

  const feeParams = new URLSearchParams();
  if (schoolId) feeParams.set("school_id", schoolId);
  if (sessionId) feeParams.set("session_id", sessionId);
  if (termId) feeParams.set("term_id", termId);
  const feeQuery = feeParams.toString();

  const { data: overview = [], isLoading: overviewLoading } = useQuery({
    queryKey: ["fees-overview", schoolId, sessionId, termId],
    queryFn: () => {
      return api.get(`/fees/overview${feeQuery ? `?${feeQuery}` : ""}`).then((r) => r.data);
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["fees-students", riskBand, schoolId, sessionId, termId, page],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (schoolId) qs.set("school_id", schoolId);
      if (sessionId) qs.set("session_id", sessionId);
      if (termId) qs.set("term_id", termId);
      if (riskBand) qs.set("risk_band", riskBand);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(page * PAGE_SIZE));
      const query = qs.toString();
      return api.get(`/fees/students${query ? `?${query}` : ""}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["fees-trend", schoolId, sessionId, termId],
    queryFn: () => {
      return api.get(`/fees/trend${feeQuery ? `?${feeQuery}` : ""}`).then((r) => r.data);
    },
  });

  const { data: riskBands = [] } = useQuery({
    queryKey: ["fees-risk-bands", schoolId, sessionId, termId],
    queryFn: () => {
      return api.get(`/fees/risk-bands${feeQuery ? `?${feeQuery}` : ""}`).then((r) => r.data);
    },
  });

  const { data: waivers = [] } = useQuery({
    queryKey: ["fees-waivers", schoolId, sessionId, termId],
    queryFn: () => {
      return api.get(`/fees/waivers${feeQuery ? `?${feeQuery}` : ""}`).then((r) => r.data);
    },
  });

  useEffect(() => {
    setPage(0);
  }, [riskBand, schoolId, sessionId, termId]);

  const totals = overview.reduce((acc, row) => ({
    students: acc.students + (row.students_with_fee_records ?? 0),
    allocated: acc.allocated + (row.total_fees_allocated ?? 0),
    paid: acc.paid + (row.total_fees_paid ?? 0),
    outstanding: acc.outstanding + (row.total_fees_outstanding ?? 0),
    highRisk: acc.highRisk + (row.high_fee_risk_students ?? 0),
    waived: acc.waived + (row.total_waived_amount ?? 0),
  }), { students: 0, allocated: 0, paid: 0, outstanding: 0, highRisk: 0, waived: 0 });

  const collectionRate = totals.allocated > 0
    ? `${((totals.paid / totals.allocated) * 100).toFixed(1)}%`
    : "N/A";
  const sessions = Array.from(
    new Map(periods.map((period) => [period.session_id, period])).values()
  );
  const terms = periods.filter((period) => !sessionId || String(period.session_id) === String(sessionId));
  const createActionMutation = useMutation({
    mutationFn: (row) => api.post("/interventions", {
      school_id: row.school_id || schoolId || null,
      school_name: row.school_name || null,
      school_short_name: row.school_short_name || null,
      target_type: "fee",
      target_id: String(row.student_id || row.registration_number || row.full_name || "fee"),
      target_name: row.full_name || "Fee follow-up",
      source_module: "fees",
      student_id: row.student_id || null,
      student_name: row.full_name || null,
      session_id: row.session_id || null,
      term_id: row.term_id || null,
      level_name: row.level_name || null,
      arm_name: row.arm_name || null,
      risk_level: row.fee_risk_band === "High Risk" ? "High" : "Medium",
      risk_score: row.total_fees_outstanding ? Math.min(100, Math.max(0, Math.round(Number(row.total_fees_outstanding) / 10000))) : null,
      risk_categories: ["Fee Risk"],
      risk_reasons: [`Outstanding balance is ${money(row.total_fees_outstanding)}.`],
      intervention_type: "fee_followup",
      status: "pending",
      notes: "Finance/admin team should follow up on outstanding balance and agree next steps.",
    }),
    onSuccess: async (_, row) => {
      setStatusMessage(`Fee follow-up action created for ${row.full_name || "student"}.`);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["interventions"] });
      await queryClient.invalidateQueries({ queryKey: ["intervention-summary"] });
    },
    onError: (requestError) => {
      setError(requestError.response?.data?.detail || "Unable to create fee action.");
      setStatusMessage("");
    },
  });

  return (
    <section className="surface-card">
      <div className="section-heading">
        <div>
          <h3>School Fees</h3>
          <p>Termly fee collection, outstanding balances, waivers, and student payment risk across schools.</p>
        </div>
        <span className="section-tag">Finance Analytics</span>
      </div>

      <div className="filter-bar">
        <div className="filter-inputs">
          <select
            className="filter-input"
            value={sessionId}
            onChange={(event) => { setSessionId(event.target.value); setTermId(""); }}
          >
            <option value="">All Fee Sessions</option>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.session_name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="">All Fee Terms</option>
            {terms.map((period) => (
              <option key={`${period.session_id}-${period.term_id}`} value={period.term_id}>
                {period.term_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMessage ? <div className="status-banner success">{statusMessage}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {overviewLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="kpi-grid">
            <KPIBox title="Students With Fees" value={totals.students.toLocaleString()} footnote="Students with fee allocation records" />
            <KPIBox title="Fees Allocated" value={money(totals.allocated)} footnote="Total assigned fee value" />
            <KPIBox title="Fees Paid" value={money(totals.paid)} footnote={`Collection rate ${collectionRate}`} />
            <KPIBox title="Outstanding" value={money(totals.outstanding)} footnote={`${totals.highRisk} high-risk student balances`} />
            <KPIBox title="Waivers" value={money(totals.waived)} footnote="Approved discounts recorded" />
          </div>

          <OwnerDecisionInsights totals={totals} collectionRate={collectionRate} />

          <div className="analytics-grid">
            <FeeRiskBandChart rows={riskBands} />
            <OutstandingComparisonChart rows={overview} />
            <WaiverImpactChart rows={waivers} />
          </div>

          <div className="overview-grid">
            <div className="overview-note">
              <h3>Term Collection Summary</h3>
              <ul className="overview-points">
                {overview.map((row) => (
                  <li key={`${row.school_id}-${row.session_id}-${row.term_id}`}>
                    <span>{row.school_short_name || row.school_name} · {row.term_name}</span>
                    <strong>{money(row.total_fees_outstanding)} outstanding</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overview-note">
              <h3>Recent Payment Months</h3>
              <ul className="overview-points">
                {trend.slice(0, 5).map((row, index) => (
                  <li key={`${row.school_id}-${row.payment_month}-${row.payment_source}-${row.channel}-${index}`}>
                    <span>{row.payment_month} · {row.term_name || "Unmatched term"}</span>
                    <strong>{money(row.payment_amount)}</strong>
                  </li>
                ))}
                {trend.length === 0 ? (
                  <li>
                    <span>No payment trend yet</span>
                    <strong>—</strong>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="surface-card table-card" style={{ marginTop: "1.5rem" }}>
        <div className="table-toolbar">
          <div>
            <h3>Student Fee Balances</h3>
            <p className="muted-text">Ranked by outstanding amount. Page {page + 1}</p>
          </div>
          <select
            className="filter-input"
            value={riskBand}
            onChange={(event) => setRiskBand(event.target.value)}
          >
            <option value="">All risk bands</option>
            <option value="High Risk">High Risk</option>
            <option value="Medium Risk">Medium Risk</option>
            <option value="Low Risk">Low Risk</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        {studentsLoading ? (
          <LoadingSkeleton rows={6} />
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div>
              <h3>No fee balances found</h3>
              <p>This is expected for schools that do not currently use the fee module.</p>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
            <tr>
                  <th>Student</th>
                  <th>School</th>
                  <th>Session</th>
                  <th>Term</th>
                  <th>Allocated</th>
                  <th>Paid</th>
                  <th>Waived</th>
                  <th>Outstanding</th>
                  <th>Collection</th>
                  <th>Risk</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={`${row.school_id}-${row.student_id}`}>
                    <td>
                      <div className="student-cell">
                        <strong>{row.full_name || "—"}</strong>
                        <span>{row.registration_number || "No registration number"}</span>
                      </div>
                    </td>
                    <td>{row.school_short_name || row.school_name || "—"}</td>
                    <td>{row.session_name || "—"}</td>
                    <td>{row.term_name || "—"}</td>
                    <td>{money(row.total_fees_allocated)}</td>
                    <td>{money(row.total_fees_paid)}</td>
                    <td>{money(row.student_waived_amount)}</td>
                    <td>
                      <strong style={{ color: row.total_fees_outstanding > 0 ? "var(--danger)" : "var(--success)" }}>
                        {money(row.total_fees_outstanding)}
                      </strong>
                    </td>
                    <td>{row.collection_rate_pct != null ? `${row.collection_rate_pct}%` : "—"}</td>
                    <td>
                      <span className={`table-badge ${riskClass(row.fee_risk_band)}`}>
                        {row.fee_risk_band}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button mini"
                        onClick={() => createActionMutation.mutate(row)}
                        disabled={createActionMutation.isPending || !schoolId || !(row.total_fees_outstanding > 0)}
                      >
                        Create Action
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <span>Showing <strong>{students.length ? page * PAGE_SIZE + 1 : 0}-{page * PAGE_SIZE + students.length}</strong></span>
          <div className="pagination-actions">
            <button
              type="button"
              disabled={page === 0 || studentsLoading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
            <em>Page {page + 1}</em>
            <button
              type="button"
              disabled={studentsLoading || students.length < PAGE_SIZE}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
