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
  BackendOwnState,
  ChartStateConverterOptions,
  QuerySortBy,
  type AgGridChartState,
  type AgGridSortModel,
} from '@superset-ui/core';

/**
 * Converts AG Grid sortModel to backend sortBy format
 */
export function convertSortModel(
  sortModel: AgGridSortModel[],
): QuerySortBy[] | undefined {
  if (!sortModel || sortModel.length === 0) {
    return undefined;
  }

  const sortItem = sortModel[0];
  return [
    {
      id: sortItem.colId,
      key: sortItem.colId,
      desc: sortItem.sort === 'desc',
    },
  ];
}

/**
 * Extracts column order from AG Grid columnState
 */
export function convertColumnState(
  columnState: Array<{ colId: string }>,
): string[] | undefined {
  if (!columnState || columnState.length === 0) {
    return undefined;
  }

  return columnState.map(col => col.colId);
}

/**
 * Base converter for AG Grid-based charts (table, pivot, etc.)
 * Converts AG Grid state to backend-compatible format.
 *
 * This can be extended by specific implementations (pivot) that need
 * additional conversion logic.
 */
export function convertAgGridStateToOwnState(
  agGridState: AgGridChartState,
  options: ChartStateConverterOptions = {},
): Partial<BackendOwnState> {
  // In client mode, AG Grid handles sort/filter/pagination locally, so for
  // the *live* query none of it needs to reach the backend -- folding it
  // into ownState there would only trigger an unnecessary requery/remount.
  // A *download* query has no client-side pass to apply that state though:
  // dashboard doesn't consume the Explore-only clientView snapshot, so
  // exports still need it converted to reproduce the displayed
  // sort/filter/columns (options.forExport).
  //
  // Only an explicit `false` is treated as "definitely client mode":
  // legacy persisted table_state/permalinks predate serverPagination and
  // have it `undefined`, and treating that the same as `false` would
  // silently drop their persisted server-side sort/filter on restore.
  if (agGridState.serverPagination === false && !options.forExport) {
    return {};
  }

  const ownState: Partial<BackendOwnState> = {};

  const sortBy = convertSortModel(agGridState.sortModel);
  if (sortBy) {
    ownState.sortBy = sortBy;
  }

  const columnOrder = convertColumnState(agGridState.columnState);
  if (columnOrder) {
    ownState.columnOrder = columnOrder;
  }

  // Forward the raw AG Grid filter model so buildQuery can convert header
  // filters into structured, dialect-safe `{ col, op, val }` filters for
  // download queries (see buildQuery's isDownloadQuery branch). Serializing raw
  // SQL clauses here instead leaves column identifiers unquoted, which breaks
  // CSV/Excel export for column names with spaces or reserved words.
  //
  // Always forward it when present (even when empty) so a cleared filter set
  // overwrites any previously persisted model on merge, rather than leaving a
  // stale filter to be re-applied on the next export. An empty model yields no
  // filters in buildQuery.
  if (agGridState.filterModel) {
    ownState.agGridFilterModel = agGridState.filterModel;
  }

  if (agGridState.pageSize !== undefined) {
    ownState.pageSize = agGridState.pageSize;
  }

  if (agGridState.currentPage !== undefined) {
    ownState.currentPage = agGridState.currentPage;
  }

  return ownState;
}
