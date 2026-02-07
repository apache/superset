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

import { useReducer, useMemo, Dispatch } from 'react';
import { DataRecord } from '@superset-ui/core';
import {
  TableState,
  DataState,
  TableAction,
  ActionType,
  createInitialTableState,
  tableStateReducer,
  ContextMenuState,
  TableSize,
  ColumnFilter,
} from '../state/tableState';

/**
 * Hook that provides table state management with reducer pattern
 * Consolidates 18 individual useState hooks into a single reducer
 */
export function useTableState<D extends DataRecord = DataRecord>(
  initialDataState?: Partial<DataState<D>>
) {
  const [state, dispatch] = useReducer<
    typeof tableStateReducer<D>,
    Partial<DataState<D>> | undefined
  >(
    tableStateReducer,
    initialDataState,
    (override) => createInitialTableState<D>(override)
  );

  // Create stable action dispatchers
  const actions = useMemo(
    () => ({
      // UI Actions
      setDescriptionHeight: (height: number) =>
        dispatch({ type: ActionType.SET_DESCRIPTION_HEIGHT, payload: height }),

      setTableSize: (size: TableSize) =>
        dispatch({ type: ActionType.SET_TABLE_SIZE, payload: size }),

      setOpenHeaderMenuKey: (key: string | null) =>
        dispatch({ type: ActionType.SET_OPEN_HEADER_MENU_KEY, payload: key }),

      setShowComparisonDropdown: (show: boolean) =>
        dispatch({ type: ActionType.SET_SHOW_COMPARISON_DROPDOWN, payload: show }),

      setContextMenu: (menu: ContextMenuState) =>
        dispatch({ type: ActionType.SET_CONTEXT_MENU, payload: menu }),

      setOpenFilterKey: (key: string | null) =>
        dispatch({ type: ActionType.SET_OPEN_FILTER_KEY, payload: key }),

      setMessage: (message: string) =>
        dispatch({ type: ActionType.SET_MESSAGE, payload: message }),

      toggleColumnOrder: () =>
        dispatch({ type: ActionType.TOGGLE_COLUMN_ORDER }),

      // Data Actions - Row Selection
      setSelectedRows: (rows: Map<string, D>) =>
        dispatch({ type: ActionType.SET_SELECTED_ROWS, payload: rows }),

      addSelectedRow: (id: string, row: D) =>
        dispatch({ type: ActionType.ADD_SELECTED_ROW, payload: { id, row } }),

      removeSelectedRow: (id: string) =>
        dispatch({ type: ActionType.REMOVE_SELECTED_ROW, payload: id }),

      clearSelectedRows: () =>
        dispatch({ type: ActionType.CLEAR_SELECTED_ROWS }),

      bulkSelectRows: (rows: Array<{ id: string; row: D }>) =>
        dispatch({ type: ActionType.BULK_SELECT_ROWS, payload: rows }),

      toggleSelectedRow: (id: string, row: D) =>
        dispatch({ type: ActionType.TOGGLE_SELECTED_ROW, payload: { id, row } }),

      // Data Actions - Column Management
      setVisibleColumnKeys: (keys: string[] | null) =>
        dispatch({ type: ActionType.SET_VISIBLE_COLUMN_KEYS, payload: keys }),

      setPinnedLeftKeys: (keys: string[]) =>
        dispatch({ type: ActionType.SET_PINNED_LEFT_KEYS, payload: keys }),

      setPinnedRightKeys: (keys: string[]) =>
        dispatch({ type: ActionType.SET_PINNED_RIGHT_KEYS, payload: keys }),

      setColumnWidths: (widths: Record<string, number>) =>
        dispatch({ type: ActionType.SET_COLUMN_WIDTHS, payload: widths }),

      updateColumnWidth: (key: string, width: number) =>
        dispatch({ type: ActionType.UPDATE_COLUMN_WIDTH, payload: { key, width } }),

      // Data Actions - Comparison
      setSelectedComparisonColumns: (columns: string[]) =>
        dispatch({ type: ActionType.SET_SELECTED_COMPARISON_COLUMNS, payload: columns }),

      setHideComparisonKeys: (keys: string[]) =>
        dispatch({ type: ActionType.SET_HIDE_COMPARISON_KEYS, payload: keys }),

      // Data Actions - Filters
      setQuickFilters: (filters: Record<string, string>) =>
        dispatch({ type: ActionType.SET_QUICK_FILTERS, payload: filters }),

      updateQuickFilter: (key: string, value: string) =>
        dispatch({ type: ActionType.UPDATE_QUICK_FILTER, payload: { key, value } }),

      clearQuickFilters: () =>
        dispatch({ type: ActionType.CLEAR_QUICK_FILTERS }),

      setAdvancedFilters: (filters: Record<string, ColumnFilter>) =>
        dispatch({ type: ActionType.SET_ADVANCED_FILTERS, payload: filters }),

      updateAdvancedFilter: (key: string, filter: ColumnFilter) =>
        dispatch({ type: ActionType.UPDATE_ADVANCED_FILTER, payload: { key, filter } }),

      clearAdvancedFilters: () =>
        dispatch({ type: ActionType.CLEAR_ADVANCED_FILTERS }),

      // Data Actions - Search
      setSearchOptions: (options: any[]) =>
        dispatch({ type: ActionType.SET_SEARCH_OPTIONS, payload: options }),

      // Batch Actions
      resetUIState: () =>
        dispatch({ type: ActionType.RESET_UI_STATE }),

      resetDataState: () =>
        dispatch({ type: ActionType.RESET_DATA_STATE }),

      resetAll: () =>
        dispatch({ type: ActionType.RESET_ALL }),
    }),
    []
  );

  return {
    state,
    dispatch,
    actions,
    // Expose individual state sections for convenience
    ui: state.ui,
    data: state.data,
  };
}

/**
 * Type for the return value of useTableState
 */
export type UseTableStateReturn<D extends DataRecord = DataRecord> = ReturnType<
  typeof useTableState<D>
>;

/**
 * Type for the actions object
 */
export type TableStateActions<D extends DataRecord = DataRecord> = UseTableStateReturn<D>['actions'];
