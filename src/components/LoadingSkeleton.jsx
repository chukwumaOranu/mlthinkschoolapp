import React from "react";

export default function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="loading-state">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`loading-bar ${i % 3 === 1 ? "short" : i % 3 === 2 ? "medium" : ""}`} />
      ))}
    </div>
  );
}
