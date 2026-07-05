import React, { useEffect, useMemo, useState } from "react";

export const PAGE_SIZE = 30;

export function usePagination(items, dependencies = [], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, dependencies);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, totalPages, totalItems, pageSize, paginatedItems };
}

export default function Pagination({ page, totalPages, totalItems, pageSize = PAGE_SIZE, onPageChange }) {
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination-bar">
      <span>
        Showing <strong>{start}-{end}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="pagination-actions">
        <button type="button" onClick={() => onPageChange(1)} disabled={page <= 1}>
          First
        </button>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <em>Page {page} of {totalPages}</em>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
          Last
        </button>
      </div>
    </div>
  );
}
