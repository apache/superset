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
import {
  buildQueryContext,
  getTimeFormatter,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { parentDateFilters } from './buildQuery';
import { childQueryBase } from './childFilters';
import normalizeTreeFormData from './normalizeTreeFormData';
import {
  countMetric,
  defaultSort,
  rowColumns,
  sortableColumns,
} from './levelsToMirrors';
import { TreeTableChildRequest, TreeTableFormData, TreeLevel } from './types';

export const CHILD_ROW_LIMIT = 100000;
export const DEFAULT_CHILDREN_SHOWN = 100;

/** Convert a normalized temporal ID back to its dataset storage format. */
function storedKey(key: string, format?: string | null): string {
  if (!format || format === 'epoch_ms') return key;
  const epochMs = Number(key);
  if (!Number.isFinite(epochMs)) return key;
  if (format === 'epoch_s') return String(epochMs / 1000);
  if (format === 'epoch_us') return String(Math.round(epochMs * 1000));
  return getTimeFormatter(format)(epochMs);
}

/** The columns that hold each key of a path to a row at `index`: level 2's parent column, then each deeper one. */
export function pathColumns(levels: TreeLevel[], index: number): string[] {
  return levels.slice(1, index + 1).map(level => level.parent_column!);
}

/** The link columns of a query, duplicates dropped, each with the path position it reads. */
export function linkColumns(levels: TreeLevel[], index: number) {
  const seen = new Set<string>();
  return pathColumns(levels, index)
    .map((column, position) => ({ column, position }))
    .filter(({ column }) => {
      if (seen.has(column)) return false;
      seen.add(column);
      return true;
    });
}

/** The counts query's row limit: the product of the distinct values per link column, at most `CHILD_ROW_LIMIT`. */
export function countsRowLimit(
  levels: TreeLevel[],
  request: TreeTableChildRequest,
): number {
  return Math.min(
    CHILD_ROW_LIMIT,
    linkColumns(levels, request.level).reduce(
      (product, { position }) =>
        product * new Set(request.paths.map(path => path[position])).size,
      1,
    ),
  );
}

/** The rows and counts queries for the children of the given parent paths, or one Load more rows query when `offset` is set. */
export default function buildChildrenQuery(
  formData: TreeTableFormData,
  options: { ownState: { treeTableChildren: TreeTableChildRequest } },
) {
  const levels = formData.levels ?? [];
  const request = options.ownState.treeTableChildren;
  const level = levels[request.level];
  const links = linkColumns(levels, request.level);
  const linkNames = links.map(({ column }) => column);
  return buildQueryContext(normalizeTreeFormData(formData), baseQueryObject => {
    const sort =
      request.sort && sortableColumns(level).includes(request.sort[0])
        ? request.sort
        : defaultSort(level);
    const seen = new Set<string>();
    const orderby = (
      [
        ...linkNames.map(column => [column, true]),
        sort,
        [level.id_column, true],
      ] as [string, boolean][]
    ).filter(([column]) => {
      if (seen.has(column)) return false;
      seen.add(column);
      return true;
    });
    const base = childQueryBase(
      {
        ...baseQueryObject,
        filters: parentDateFilters(
          baseQueryObject,
          levels[0],
          formData.extra_form_data?.time_range,
        ),
      },
      levels,
      request.level,
    );
    const filters: QueryObjectFilterClause[] = [
      ...(base.filters ?? []),
      ...links.map(({ column, position }): QueryObjectFilterClause => ({
        col: column,
        op: 'IN',
        val: [
          ...new Set(
            request.paths.map(path =>
              storedKey(path[position], request.linkDateFormats?.get(column)),
            ),
          ),
        ],
      })),
      { col: level.id_column, op: 'IS NOT NULL' },
    ];
    const common = { ...base, filters };
    const n = level.children_shown ?? DEFAULT_CHILDREN_SHOWN;
    const columns = [
      ...rowColumns(level),
      ...linkNames.filter(column => !rowColumns(level).includes(column)),
    ];
    if (request.offset !== undefined)
      return [
        {
          ...common,
          columns,
          metrics: [],
          orderby,
          row_limit: n,
          row_offset: request.offset,
          post_processing: [],
        },
      ];
    return [
      {
        ...common,
        columns,
        metrics: [],
        orderby,
        row_limit: request.paths.length === 1 ? n : CHILD_ROW_LIMIT,
        row_offset: 0,
        post_processing:
          request.paths.length === 1
            ? []
            : [
                {
                  operation: 'first_n_per_group',
                  options: { groupby: linkNames, n },
                },
              ],
      },
      {
        ...common,
        columns: linkNames,
        metrics: [countMetric(level)],
        orderby: [],
        post_processing: [],
        row_limit: countsRowLimit(levels, request),
        row_offset: 0,
      },
    ];
  });
}
