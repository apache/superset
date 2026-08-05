/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { ChartData, DataColumn } from '../types';
import { formatByColumn, stripUntrustedMarkers, toNumber } from '../format';

type SortDir = 'asc' | 'desc';

/** Selectable page sizes. Superset returns up to ~1000 rows per result. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

export const DEFAULT_PAGE_SIZE = 25;

/** Rows for one page, plus the bookkeeping the footer needs to describe it. */
export interface PageSlice<T> {
  rows: T[];
  /** Zero-based index of the page actually shown (clamped into range). */
  page: number;
  pageCount: number;
  /** One-based row numbers of the visible window, for "x–y of z". */
  from: number;
  to: number;
  total: number;
}

/**
 * Clamp a requested page into range and slice it out. Pure so the paging
 * arithmetic — the part that silently drops rows when it is wrong — is
 * testable without a DOM.
 */
export function paginate<T>(
  rows: T[],
  page: number,
  pageSize: number,
): PageSlice<T> {
  const total = rows.length;
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  const start = current * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}

/** A dense, sortable, zebra-striped, paginated table with sticky headers. */
export function DataTable({
  data,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: {
  data: ChartData;
  initialPageSize?: number;
}): JSX.Element {
  const columns = data.columns;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const rows = [...(data.data ?? [])];
    if (!sortCol) return rows;
    const col = columns.find((c) => c.name === sortCol);
    const numeric = col?.data_type === 'numeric';
    rows.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      let cmp: number;
      if (numeric) {
        cmp = (toNumber(av) ?? -Infinity) - (toNumber(bv) ?? -Infinity);
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data.data, sortCol, sortDir, columns]);

  // A re-query, a re-sort or a bigger page all invalidate the current offset;
  // land the reader back at the top rather than on an arbitrary window.
  useEffect(() => {
    setPage(0);
  }, [data.data, sortCol, sortDir, pageSize]);

  const slice = useMemo(
    () => paginate(sorted, page, pageSize),
    [sorted, page, pageSize],
  );
  const multiPage = slice.total > PAGE_SIZE_OPTIONS[0];

  function toggleSort(name: string): void {
    if (sortCol === name) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(name);
      setSortDir('asc');
    }
  }

  return (
    <div className="sv-table-view">
      <div className="sv-table-scroll">
        <table className="sv-table">
          <caption className="sv-sr-only">
            {stripUntrustedMarkers(data.chart_name)} — {slice.total} rows,{' '}
            {columns.length} columns. Column headers sort the whole result.
          </caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.name}
                  scope="col"
                  className={isNumeric(col) ? 'sv-num' : undefined}
                  aria-sort={
                    sortCol === col.name
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {/* A button, not a click handler on the th: sorting has to
                      be reachable by keyboard and announced as actionable. */}
                  <button
                    type="button"
                    className="sv-th-sort"
                    onClick={() => toggleSort(col.name)}
                    title={`Sort by ${col.display_name || col.name}`}
                  >
                    {col.display_name || col.name}
                    {sortCol === col.name && (
                      <span className="sv-sort-caret" aria-hidden="true">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.rows.map((row, i) => (
              <tr key={slice.page * pageSize + i}>
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className={isNumeric(col) ? 'sv-num' : undefined}
                  >
                    {formatByColumn(row[col.name], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {multiPage && (
        <div className="sv-pagination">
          <span className="sv-page-range" aria-live="polite">
            {slice.from.toLocaleString()}–{slice.to.toLocaleString()} of{' '}
            {slice.total.toLocaleString()}
          </span>
          <span className="sv-spacer" />
          <label className="sv-page-size">
            Rows
            <select
              value={pageSize}
              aria-label="Rows per page"
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="sv-page-nav">
            <button
              type="button"
              className="sv-btn sv-btn--subtle"
              aria-label="Previous page"
              disabled={slice.page === 0}
              onClick={() => setPage(slice.page - 1)}
            >
              ‹
            </button>
            <span className="sv-page-count">
              {slice.page + 1} / {slice.pageCount}
            </span>
            <button
              type="button"
              className="sv-btn sv-btn--subtle"
              aria-label="Next page"
              disabled={slice.page >= slice.pageCount - 1}
              onClick={() => setPage(slice.page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function isNumeric(col: DataColumn): boolean {
  return col.data_type === 'numeric';
}
