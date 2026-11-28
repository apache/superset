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
import { getMetricLabel } from '@superset-ui/core';
import {
  countsRowLimit,
  DEFAULT_CHILDREN_SHOWN,
  pathColumns,
} from './buildChildrenQuery';
import { countMetric } from './levelsToMirrors';
import { TreeTableQueryResult } from './fetchTreeTableData';
import { ChildrenEntry, TreeTableChildRequest, TreeLevel } from './types';

/** The key of a row ID; NULL, undefined and '' have none. */
export function keyOf(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

export const loadingEntry: ChildrenEntry = {
  status: 'loading',
  rows: [],
  total: 0,
  colnames: [],
  coltypes: [],
};

/** The path key of a row's parent, read from the link columns. */
function parentPathKey(row: Record<string, unknown>, columns: string[]) {
  const path = columns.map(column => keyOf(row[column]));
  return path.every(key => key !== undefined)
    ? JSON.stringify(path)
    : undefined;
}

/**
 * Turn a rows + counts answer into one entry per requested parent path, keyed
 * by `JSON.stringify(path)`. Rows of paths that weren't requested are ignored.
 */
export function toEntries(
  result: TreeTableQueryResult[] & { countsSeparate?: boolean },
  request: TreeTableChildRequest,
  levels: TreeLevel[],
  inRange = false,
): Map<string, ChildrenEntry> & { ambiguous: string[][] } {
  const [rowsResult, countsResult] = result;
  const level = levels[request.level];
  const n = level.children_shown ?? DEFAULT_CHILDREN_SHOWN;
  const columns = pathColumns(levels, request.level);
  const groups = new Map<string, Record<string, unknown>[]>();
  (rowsResult?.data ?? []).forEach(row => {
    const key = parentPathKey(row, columns);
    if (key === undefined) return;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });
  const label = getMetricLabel(countMetric(level));
  const totals = new Map<string, number>();
  const countRows = countsResult?.data ?? [];
  countRows.forEach(row => {
    const key = parentPathKey(row, columns);
    if (key !== undefined) totals.set(key, Number(row[label] ?? 0));
  });
  const countsCut = countRows.length >= countsRowLimit(levels, request);
  const ambiguous: string[][] = [];
  const colnames = rowsResult?.colnames ?? [];
  const coltypes = rowsResult?.coltypes ?? [];
  const entries = new Map<string, ChildrenEntry>();
  request.paths.forEach(path => {
    const key = JSON.stringify(path);
    const total = totals.get(key) ?? 0;
    const rows = groups.get(key) ?? [];
    let status: ChildrenEntry['status'] = 'loaded';
    if (!totals.has(key)) {
      if (countsCut && request.paths.length > 1) {
        ambiguous.push(path);
        return;
      }
      status = countsCut ? 'error' : 'empty';
    } else if (total === 0) status = 'empty';
    else if (rows.length < Math.min(total, n)) {
      if (result.countsSeparate && request.paths.length > 1) {
        ambiguous.push(path);
        return;
      }
      status = 'error';
    }
    entries.set(key, {
      status,
      inRange,
      rows: status === 'loaded' ? rows : [],
      total,
      colnames,
      coltypes,
    });
  });
  return Object.assign(entries, { ambiguous });
}

/** Append a Load more answer to the entry's rows, in order, and clear `more`. */
export function appendMore(
  entry: ChildrenEntry,
  result: TreeTableQueryResult[],
  batchSize = DEFAULT_CHILDREN_SHOWN,
): ChildrenEntry {
  const received = result[0]?.data ?? [];
  const rows = [...entry.rows, ...received];
  const next = {
    ...entry,
    rows,
    total: received.length < batchSize ? rows.length : entry.total,
  };
  delete next.more;
  return next;
}
