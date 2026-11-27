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
import { ChartDataResponseResult, Column } from '@superset-ui/core';
import {
  TreeTableChartProps,
  TreeTableTransformedProps,
  TreeTableOwnState,
  TreeLevel,
} from './types';
import { normalizePage, normalizePageSize } from './pageState';
import buildColumns from './columns';

const noop = () => {};

export default function transformProps(
  chartProps: TreeTableChartProps,
): TreeTableTransformedProps {
  const {
    width,
    height,
    formData,
    rawFormData,
    queriesData,
    datasource,
    hooks,
    filterState,
    emitCrossFilters,
  } = chartProps;
  const ownState: TreeTableOwnState = chartProps.ownState ?? {};
  const queryData: Partial<ChartDataResponseResult> = queriesData[0] ?? {};
  const { data = [], colnames = [], coltypes = [] } = queryData;
  const levels: TreeLevel[] = (formData.levels ?? []).map(
    (level: TreeLevel) => ({
      ...level,
      columns: level.columns ?? [],
      detail_fields: level.detail_fields ?? [],
    }),
  );
  const [level] = levels;
  const verboseMap = datasource.verboseMap ?? {};
  const datasourceColumns: Column[] = datasource.columns ?? [];
  const linkDateFormats = new Map<string, string>();
  levels.slice(1).forEach(({ parent_column }) => {
    const column = datasourceColumns.find(
      ({ column_name }) => column_name === parent_column,
    );
    if (column?.is_dttm && column.python_date_format) {
      linkDateFormats.set(column.column_name, column.python_date_format);
    }
  });
  const pageSize = normalizePageSize(
    ownState.pageSize,
    rawFormData.tree_server_page_length,
  );
  return {
    width,
    height,
    levels,
    data,
    colnames,
    coltypes,
    rowcount: queriesData[1]?.data?.[0]?.rowcount ?? 0,
    columns: level
      ? buildColumns(
          [level.id_column, ...level.columns],
          colnames,
          coltypes,
          verboseMap,
        )
      : [],
    pageSize,
    currentPage: normalizePage(
      ownState.currentPage,
      pageSize,
      rawFormData.row_limit,
    ),
    serverPageLength: normalizePageSize(
      undefined,
      rawFormData.tree_server_page_length,
    ),
    ownState,
    setDataMask: hooks.setDataMask ?? noop,
    emitCrossFilters: emitCrossFilters ?? false,
    filters: filterState.filters,
    sliceId: rawFormData.slice_id ?? 0,
    rawFormData,
    verboseMap,
    ...(linkDateFormats.size && { linkDateFormats }),
  };
}
