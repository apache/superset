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
import { useMemo, useState, type JSX } from 'react';
import type { ChartData, DataColumn } from '../types';
import { formatByColumn, toNumber } from '../format';

type SortDir = 'asc' | 'desc';

/** A dense, sortable, zebra-striped table with right-aligned numerics. */
export function DataTable({ data }: { data: ChartData }): JSX.Element {
  const columns = data.columns;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  function toggleSort(name: string): void {
    if (sortCol === name) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(name);
      setSortDir('asc');
    }
  }

  return (
    <div className="sv-table-scroll">
      <table className="sv-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.name}
                className={isNumeric(col) ? 'sv-num' : undefined}
                onClick={() => toggleSort(col.name)}
                title={`Sort by ${col.display_name || col.name}`}
              >
                {col.display_name || col.name}
                {sortCol === col.name && (
                  <span className="sv-sort-caret">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.name} className={isNumeric(col) ? 'sv-num' : undefined}>
                  {formatByColumn(row[col.name], col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isNumeric(col: DataColumn): boolean {
  return col.data_type === 'numeric';
}
