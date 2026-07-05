import React from "react";

export default function KPIBox({ title, value, footnote }) {
  return (
    <div className="kpi-box">
      <p className="kpi-label">{title}</p>
      <p className="kpi-value">{value}</p>
      {footnote ? <div className="kpi-footnote">{footnote}</div> : null}
    </div>
  );
}
