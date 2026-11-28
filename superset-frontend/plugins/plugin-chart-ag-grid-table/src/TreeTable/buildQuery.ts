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
  QueryContext,
  QueryObject,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { TreeTableFormData, TreeLevel, TreeTableOwnState } from './types';
import { defaultSort, rowColumns, sortableColumns } from './levelsToMirrors';
import { normalizePage, normalizePageSize, pageLimit } from './pageState';
import { buildExportSpec } from './exportQuery';
import normalizeTreeFormData from './normalizeTreeFormData';

/**
 * Bind the chart's own time range and the dashboard's date ranges to level 1's
 * time column: the first date range of the chart's filters, a range on the
 * time column or on the legacy granularity column, a dashboard range, or else
 * the query's `time_range`. Any other date range keeps its own column. A
 * dashboard time range (`extra_form_data.time_range`) replaces the chart's own
 * range, as Superset's dashboard filter merge does.
 */
export function parentDateFilters(
  baseQueryObject: QueryObject,
  level: TreeLevel,
  dashboardTimeRange?: string,
): QueryObjectFilterClause[] {
  const timeColumn = level.time_column!;
  const { granularity } = baseQueryObject;
  const temporalValues = new Set<unknown>();
  let ownRangeSeen = false;
  const filters: QueryObjectFilterClause[] = (
    baseQueryObject.filters ?? []
  ).flatMap(filter => {
    if (filter.op !== 'TEMPORAL_RANGE') return [filter];
    const own = !filter.isExtra && !ownRangeSeen;
    if (!filter.isExtra) ownRangeSeen = true;
    const chartOwned =
      !filter.isExtra &&
      (own ||
        filter.col === timeColumn ||
        (granularity !== undefined && filter.col === granularity));
    if (!chartOwned && !filter.isExtra) return [filter];
    if (chartOwned && dashboardTimeRange !== undefined) return [];
    if (temporalValues.has(filter.val)) return [];
    temporalValues.add(filter.val);
    return [{ ...filter, col: timeColumn }];
  });
  if (
    dashboardTimeRange !== undefined &&
    !temporalValues.has(dashboardTimeRange)
  ) {
    temporalValues.add(dashboardTimeRange);
    filters.push({
      col: timeColumn,
      op: 'TEMPORAL_RANGE',
      val: dashboardTimeRange,
    });
  }
  if (
    !temporalValues.size &&
    baseQueryObject.time_range &&
    baseQueryObject.time_range !== 'No filter'
  ) {
    filters.push({
      col: timeColumn,
      op: 'TEMPORAL_RANGE',
      val: baseQueryObject.time_range,
    });
  }
  return filters;
}

export default function buildQuery(
  formData: TreeTableFormData,
  options?: { ownState?: TreeTableOwnState },
): QueryContext {
  const level = formData.levels?.[0];
  const ownState = options?.ownState ?? {};
  let exportSpec: ReturnType<typeof buildExportSpec>;
  const context = buildQueryContext(
    normalizeTreeFormData(formData),
    baseQueryObject => {
      if (!level?.id_column) {
        return [{ ...baseQueryObject, columns: [], metrics: [], orderby: [] }];
      }
      const pageSize = normalizePageSize(
        ownState.pageSize,
        formData.tree_server_page_length,
      );
      const page = normalizePage(
        ownState.currentPage,
        pageSize,
        formData.row_limit,
      );
      const sortable = sortableColumns(level);
      const sort = ownState.sortBy?.[0];
      const orderby: [string, boolean] =
        sort && sortable.includes(sort.id)
          ? [sort.id, !sort.desc]
          : defaultSort(level);
      const filters = parentDateFilters(
        baseQueryObject,
        level,
        formData.extra_form_data?.time_range,
      );
      const pageQuery: QueryObject = {
        ...baseQueryObject,
        granularity: undefined,
        columns: rowColumns(level),
        metrics: [],
        orderby: [
          orderby,
          ...sortable
            .filter(column => column !== orderby[0])
            .map((column): [string, boolean] => [column, true]),
        ],
        filters,
        ...pageLimit(page, pageSize, formData.row_limit),
      };
      exportSpec = buildExportSpec(
        pageQuery,
        {
          ...baseQueryObject,
          filters: parentDateFilters(
            baseQueryObject,
            level,
            formData.extra_form_data?.time_range,
          ),
        },
        formData.levels ?? [],
      );
      return [
        pageQuery,
        {
          ...pageQuery,
          row_limit: Number(formData.row_limit ?? 0),
          row_offset: 0,
          orderby: [],
          post_processing: [],
          is_rowcount: true,
        },
      ];
    },
  );
  return exportSpec
    ? {
        ...context,
        form_data: {
          ...(context.form_data ?? formData),
          tree_export: exportSpec,
        },
      }
    : context;
}
