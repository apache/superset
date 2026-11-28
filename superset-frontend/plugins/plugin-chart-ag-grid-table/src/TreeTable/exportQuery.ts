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
import { QueryObject, QueryObjectFilterClause } from '@superset-ui/core';
import { TreeLevel } from './types';
import { defaultSort, rowColumns } from './levelsToMirrors';
import { childDateFilters, childRangeApplies } from './childFilters';

export interface TreeTableExportLevel {
  id_column: string;
  columns: string[];
  time_column?: string;
}

interface TreeTableExportFold {
  operation: 'tree_rows';
  options: { levels: TreeTableExportLevel[]; time_ranges: string[] };
}

export interface TreeTableExportSpec {
  query: QueryObject & { post_processing: [TreeTableExportFold] };
  child_filters: QueryObjectFilterClause[];
}

const valueOf = (filter: QueryObjectFilterClause): unknown =>
  'val' in filter ? filter.val : undefined;

function linkedLevels(levels: TreeLevel[]): TreeLevel[] {
  const end = levels.findIndex(level => !level?.id_column);
  return end === -1 ? levels : levels.slice(0, end);
}

/**
 * The flat query for "Export to .CSV" and "Export to Excel". The server
 * uses non-date filters to select parents and date filters to select children.
 * The `tree_rows` step keeps one row for a parent with no children in range.
 */
export function buildExportSpec(
  pageQuery: QueryObject,
  base: QueryObject,
  allLevels: TreeLevel[],
): TreeTableExportSpec | undefined {
  const levels = linkedLevels(allLevels);
  if (!levels.length) return undefined;

  const columns: string[] = [];
  const exportLevels: TreeTableExportLevel[] = levels.map(level => {
    const owned = rowColumns(level).filter(column => !columns.includes(column));
    columns.push(...owned);
    return { id_column: level.id_column, columns: owned };
  });

  const orderby: NonNullable<QueryObject['orderby']> = [];
  const sorts: NonNullable<QueryObject['orderby']> = [
    ...(pageQuery.orderby ?? []),
    [levels[0].id_column, true] as [string, boolean],
    ...levels
      .slice(1)
      .flatMap(level => [
        defaultSort(level),
        [level.id_column, true] as [string, boolean],
      ]),
  ];
  sorts.forEach(pair => {
    if (pair && !orderby.some(([column]) => column === pair[0]))
      orderby.push(pair);
  });

  const childFilters = childDateFilters(base, levels, levels.length - 1);
  const filters: QueryObjectFilterClause[] = [...(pageQuery.filters ?? [])];
  levels.forEach((level, j) => {
    if (j === 0 || !childRangeApplies(base, levels, j)) return;
    if (columns.includes(level.time_column!)) {
      exportLevels[j].time_column = level.time_column;
      return;
    }
    childFilters
      .filter(filter => filter.col === level.time_column)
      .forEach(filter => {
        if (
          !filters.some(
            existing =>
              existing.op === filter.op &&
              existing.col === filter.col &&
              valueOf(existing) === valueOf(filter),
          )
        )
          filters.push(filter);
      });
  });

  const timeRanges = [
    ...new Set(
      filters
        .filter(
          filter =>
            filter.op === 'TEMPORAL_RANGE' &&
            filter.col === levels[0].time_column &&
            typeof valueOf(filter) === 'string',
        )
        .map(filter => valueOf(filter) as string),
    ),
  ];

  const { is_rowcount: _isRowcount, ...rest } = pageQuery;
  const fold: TreeTableExportFold = {
    operation: 'tree_rows',
    options: { levels: exportLevels, time_ranges: timeRanges },
  };
  return {
    query: {
      ...rest,
      granularity: undefined,
      columns,
      metrics: [],
      orderby,
      filters,
      extras: { ...pageQuery.extras, having: '' },
      row_limit: 0,
      row_offset: 0,
      post_processing: [fold],
    },
    child_filters: childFilters,
  };
}
