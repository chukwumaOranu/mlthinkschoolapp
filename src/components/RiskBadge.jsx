import React from "react";

export default function RiskBadge({ value, trueLabel = "Yes", falseLabel = "No", trueVariant = "danger", falseVariant = "good" }) {
  if (value === null || value === undefined) {
    return <span className="table-badge">—</span>;
  }
  const is = value === 1 || value === true;
  return (
    <span className={`table-badge ${is ? trueVariant : falseVariant}`}>
      {is ? trueLabel : falseLabel}
    </span>
  );
}
