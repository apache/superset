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

import { DataRecord } from '@superset-ui/core';

/**
 * Table size dimensions
 */
export interface TableSize {
  width: number;
  height: number;
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  row?: any;
  colKey?: string;
}

/**
 * Filter operator types for advanced filtering
 */
export type FilterOp =
  | 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'is_null' | 'is_not_null'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

/**
 * Filter logic for combining conditions
 */
export type FilterLogic = 'AND' | 'OR';

/**
 * Column filter configuration
 */
export interface ColumnFilter {
  logic: FilterLogic;
  conditions: Array<{
    op: FilterOp;
    value?: any;
    value2?: any;
    connector?: string;
  }>;
}

/**
 * UI-related state (ephemeral, doesn't need persistence)
 */
export interface UIState {
  // Layout and dimensions
  descriptionHeight: number;
  tableSize: TableSize;

  // Menus and dropdowns
  openHeaderMenuKey: string | null;
  showComparisonDropdown: boolean;
  contextMenu: ContextMenuState;
  openFilterKey: string | null;

  // Messages and notifications
  message: string;

  // UI toggles
  columnOrderToggle: boolean;
}

/**
 * Data-related state (may need persistence)
 */
export interface DataState<D extends DataRecord = DataRecord> {
  // Row selection
  selectedRows: Map<string, D>;

  // Column management
  visibleColumnKeys: string[] | null;
  pinnedLeftKeys: string[];
  pinnedRightKeys: string[];
  tableColWidthsByKey: Record<string, number>;

  // Time comparison
  selectedComparisonColumns: string[];
  hideComparisonKeys: string[];

  // Filtering
  quickFilters: Record<string, string>;
  advancedFilters: Record<string, ColumnFilter>;

  // Search
  searchOptions: any[];
}

/**
 * Complete table state combining UI and data state
 */
export interface TableState<D extends DataRecord = DataRecord> {
  ui: UIState;
  data: DataState<D>;
}

/**
 * Action types for state updates
 */
export enum ActionType {
  // UI Actions
  SET_DESCRIPTION_HEIGHT = 'SET_DESCRIPTION_HEIGHT',
  SET_TABLE_SIZE = 'SET_TABLE_SIZE',
  SET_OPEN_HEADER_MENU_KEY = 'SET_OPEN_HEADER_MENU_KEY',
  SET_SHOW_COMPARISON_DROPDOWN = 'SET_SHOW_COMPARISON_DROPDOWN',
  SET_CONTEXT_MENU = 'SET_CONTEXT_MENU',
  SET_OPEN_FILTER_KEY = 'SET_OPEN_FILTER_KEY',
  SET_MESSAGE = 'SET_MESSAGE',
  TOGGLE_COLUMN_ORDER = 'TOGGLE_COLUMN_ORDER',

  // Data Actions
  SET_SELECTED_ROWS = 'SET_SELECTED_ROWS',
  ADD_SELECTED_ROW = 'ADD_SELECTED_ROW',
  REMOVE_SELECTED_ROW = 'REMOVE_SELECTED_ROW',
  CLEAR_SELECTED_ROWS = 'CLEAR_SELECTED_ROWS',
  BULK_SELECT_ROWS = 'BULK_SELECT_ROWS',
  TOGGLE_SELECTED_ROW = 'TOGGLE_SELECTED_ROW',

  SET_VISIBLE_COLUMN_KEYS = 'SET_VISIBLE_COLUMN_KEYS',
  SET_PINNED_LEFT_KEYS = 'SET_PINNED_LEFT_KEYS',
  SET_PINNED_RIGHT_KEYS = 'SET_PINNED_RIGHT_KEYS',
  SET_COLUMN_WIDTHS = 'SET_COLUMN_WIDTHS',
  UPDATE_COLUMN_WIDTH = 'UPDATE_COLUMN_WIDTH',

  SET_SELECTED_COMPARISON_COLUMNS = 'SET_SELECTED_COMPARISON_COLUMNS',
  SET_HIDE_COMPARISON_KEYS = 'SET_HIDE_COMPARISON_KEYS',

  SET_QUICK_FILTERS = 'SET_QUICK_FILTERS',
  UPDATE_QUICK_FILTER = 'UPDATE_QUICK_FILTER',
  CLEAR_QUICK_FILTERS = 'CLEAR_QUICK_FILTERS',

  SET_ADVANCED_FILTERS = 'SET_ADVANCED_FILTERS',
  UPDATE_ADVANCED_FILTER = 'UPDATE_ADVANCED_FILTER',
  CLEAR_ADVANCED_FILTERS = 'CLEAR_ADVANCED_FILTERS',

  SET_SEARCH_OPTIONS = 'SET_SEARCH_OPTIONS',

  // Batch/Reset Actions
  RESET_UI_STATE = 'RESET_UI_STATE',
  RESET_DATA_STATE = 'RESET_DATA_STATE',
  RESET_ALL = 'RESET_ALL',
}

/**
 * Action union type
 */
export type TableAction<D extends DataRecord = DataRecord> =
  // UI Actions
  | { type: ActionType.SET_DESCRIPTION_HEIGHT; payload: number }
  | { type: ActionType.SET_TABLE_SIZE; payload: TableSize }
  | { type: ActionType.SET_OPEN_HEADER_MENU_KEY; payload: string | null }
  | { type: ActionType.SET_SHOW_COMPARISON_DROPDOWN; payload: boolean }
  | { type: ActionType.SET_CONTEXT_MENU; payload: ContextMenuState }
  | { type: ActionType.SET_OPEN_FILTER_KEY; payload: string | null }
  | { type: ActionType.SET_MESSAGE; payload: string }
  | { type: ActionType.TOGGLE_COLUMN_ORDER }

  // Data Actions - Row Selection
  | { type: ActionType.SET_SELECTED_ROWS; payload: Map<string, D> }
  | { type: ActionType.ADD_SELECTED_ROW; payload: { id: string; row: D } }
  | { type: ActionType.REMOVE_SELECTED_ROW; payload: string }
  | { type: ActionType.CLEAR_SELECTED_ROWS }
  | { type: ActionType.BULK_SELECT_ROWS; payload: Array<{ id: string; row: D }> }
  | { type: ActionType.TOGGLE_SELECTED_ROW; payload: { id: string; row: D } }

  // Data Actions - Column Management
  | { type: ActionType.SET_VISIBLE_COLUMN_KEYS; payload: string[] | null }
  | { type: ActionType.SET_PINNED_LEFT_KEYS; payload: string[] }
  | { type: ActionType.SET_PINNED_RIGHT_KEYS; payload: string[] }
  | { type: ActionType.SET_COLUMN_WIDTHS; payload: Record<string, number> }
  | { type: ActionType.UPDATE_COLUMN_WIDTH; payload: { key: string; width: number } }

  // Data Actions - Comparison
  | { type: ActionType.SET_SELECTED_COMPARISON_COLUMNS; payload: string[] }
  | { type: ActionType.SET_HIDE_COMPARISON_KEYS; payload: string[] }

  // Data Actions - Filters
  | { type: ActionType.SET_QUICK_FILTERS; payload: Record<string, string> }
  | { type: ActionType.UPDATE_QUICK_FILTER; payload: { key: string; value: string } }
  | { type: ActionType.CLEAR_QUICK_FILTERS }
  | { type: ActionType.SET_ADVANCED_FILTERS; payload: Record<string, ColumnFilter> }
  | { type: ActionType.UPDATE_ADVANCED_FILTER; payload: { key: string; filter: ColumnFilter } }
  | { type: ActionType.CLEAR_ADVANCED_FILTERS }

  // Data Actions - Search
  | { type: ActionType.SET_SEARCH_OPTIONS; payload: any[] }

  // Batch Actions
  | { type: ActionType.RESET_UI_STATE }
  | { type: ActionType.RESET_DATA_STATE }
  | { type: ActionType.RESET_ALL };

/**
 * Create initial UI state
 */
export function createInitialUIState(): UIState {
  return {
    descriptionHeight: 0,
    tableSize: { width: 0, height: 0 },
    openHeaderMenuKey: null,
    showComparisonDropdown: false,
    contextMenu: { open: false, x: 0, y: 0 },
    openFilterKey: null,
    message: '',
    columnOrderToggle: false,
  };
}

/**
 * Create initial data state with optional overrides
 */
export function createInitialDataState<D extends DataRecord = DataRecord>(
  overrides?: Partial<DataState<D>>
): DataState<D> {
  return {
    selectedRows: new Map(),
    visibleColumnKeys: null,
    pinnedLeftKeys: [],
    pinnedRightKeys: [],
    tableColWidthsByKey: {},
    selectedComparisonColumns: ['all'],
    hideComparisonKeys: [],
    quickFilters: {},
    advancedFilters: {},
    searchOptions: [],
    ...overrides,
  };
}

/**
 * Create initial complete table state
 */
export function createInitialTableState<D extends DataRecord = DataRecord>(
  dataOverrides?: Partial<DataState<D>>
): TableState<D> {
  return {
    ui: createInitialUIState(),
    data: createInitialDataState(dataOverrides),
  };
}

/**
 * Main reducer function for table state management
 */
export function tableStateReducer<D extends DataRecord = DataRecord>(
  state: TableState<D>,
  action: TableAction<D>
): TableState<D> {
  switch (action.type) {
    // UI Actions
    case ActionType.SET_DESCRIPTION_HEIGHT:
      return {
        ...state,
        ui: { ...state.ui, descriptionHeight: action.payload },
      };

    case ActionType.SET_TABLE_SIZE:
      return {
        ...state,
        ui: { ...state.ui, tableSize: action.payload },
      };

    case ActionType.SET_OPEN_HEADER_MENU_KEY:
      return {
        ...state,
        ui: { ...state.ui, openHeaderMenuKey: action.payload },
      };

    case ActionType.SET_SHOW_COMPARISON_DROPDOWN:
      return {
        ...state,
        ui: { ...state.ui, showComparisonDropdown: action.payload },
      };

    case ActionType.SET_CONTEXT_MENU:
      return {
        ...state,
        ui: { ...state.ui, contextMenu: action.payload },
      };

    case ActionType.SET_OPEN_FILTER_KEY:
      return {
        ...state,
        ui: { ...state.ui, openFilterKey: action.payload },
      };

    case ActionType.SET_MESSAGE:
      return {
        ...state,
        ui: { ...state.ui, message: action.payload },
      };

    case ActionType.TOGGLE_COLUMN_ORDER:
      return {
        ...state,
        ui: { ...state.ui, columnOrderToggle: !state.ui.columnOrderToggle },
      };

    // Data Actions - Row Selection
    case ActionType.SET_SELECTED_ROWS:
      return {
        ...state,
        data: { ...state.data, selectedRows: action.payload },
      };

    case ActionType.ADD_SELECTED_ROW: {
      const newRows = new Map(state.data.selectedRows);
      newRows.set(action.payload.id, action.payload.row);
      return {
        ...state,
        data: { ...state.data, selectedRows: newRows },
      };
    }

    case ActionType.REMOVE_SELECTED_ROW: {
      const newRows = new Map(state.data.selectedRows);
      newRows.delete(action.payload);
      return {
        ...state,
        data: { ...state.data, selectedRows: newRows },
      };
    }

    case ActionType.CLEAR_SELECTED_ROWS:
      return {
        ...state,
        data: { ...state.data, selectedRows: new Map() },
      };

    case ActionType.BULK_SELECT_ROWS: {
      const newRows = new Map(state.data.selectedRows);
      action.payload.forEach(({ id, row }) => newRows.set(id, row));
      return {
        ...state,
        data: { ...state.data, selectedRows: newRows },
      };
    }

    case ActionType.TOGGLE_SELECTED_ROW: {
      const newRows = new Map(state.data.selectedRows);
      if (newRows.has(action.payload.id)) {
        newRows.delete(action.payload.id);
      } else {
        newRows.set(action.payload.id, action.payload.row);
      }
      return {
        ...state,
        data: { ...state.data, selectedRows: newRows },
      };
    }

    // Data Actions - Column Management
    case ActionType.SET_VISIBLE_COLUMN_KEYS:
      return {
        ...state,
        data: { ...state.data, visibleColumnKeys: action.payload },
      };

    case ActionType.SET_PINNED_LEFT_KEYS:
      return {
        ...state,
        data: { ...state.data, pinnedLeftKeys: action.payload },
      };

    case ActionType.SET_PINNED_RIGHT_KEYS:
      return {
        ...state,
        data: { ...state.data, pinnedRightKeys: action.payload },
      };

    case ActionType.SET_COLUMN_WIDTHS:
      return {
        ...state,
        data: { ...state.data, tableColWidthsByKey: action.payload },
      };

    case ActionType.UPDATE_COLUMN_WIDTH:
      return {
        ...state,
        data: {
          ...state.data,
          tableColWidthsByKey: {
            ...state.data.tableColWidthsByKey,
            [action.payload.key]: action.payload.width,
          },
        },
      };

    // Data Actions - Comparison
    case ActionType.SET_SELECTED_COMPARISON_COLUMNS:
      return {
        ...state,
        data: { ...state.data, selectedComparisonColumns: action.payload },
      };

    case ActionType.SET_HIDE_COMPARISON_KEYS:
      return {
        ...state,
        data: { ...state.data, hideComparisonKeys: action.payload },
      };

    // Data Actions - Filters
    case ActionType.SET_QUICK_FILTERS:
      return {
        ...state,
        data: { ...state.data, quickFilters: action.payload },
      };

    case ActionType.UPDATE_QUICK_FILTER:
      return {
        ...state,
        data: {
          ...state.data,
          quickFilters: {
            ...state.data.quickFilters,
            [action.payload.key]: action.payload.value,
          },
        },
      };

    case ActionType.CLEAR_QUICK_FILTERS:
      return {
        ...state,
        data: { ...state.data, quickFilters: {} },
      };

    case ActionType.SET_ADVANCED_FILTERS:
      return {
        ...state,
        data: { ...state.data, advancedFilters: action.payload },
      };

    case ActionType.UPDATE_ADVANCED_FILTER:
      return {
        ...state,
        data: {
          ...state.data,
          advancedFilters: {
            ...state.data.advancedFilters,
            [action.payload.key]: action.payload.filter,
          },
        },
      };

    case ActionType.CLEAR_ADVANCED_FILTERS:
      return {
        ...state,
        data: { ...state.data, advancedFilters: {} },
      };

    // Data Actions - Search
    case ActionType.SET_SEARCH_OPTIONS:
      return {
        ...state,
        data: { ...state.data, searchOptions: action.payload },
      };

    // Batch Actions
    case ActionType.RESET_UI_STATE:
      return {
        ...state,
        ui: createInitialUIState(),
      };

    case ActionType.RESET_DATA_STATE:
      return {
        ...state,
        data: createInitialDataState(),
      };

    case ActionType.RESET_ALL:
      return createInitialTableState();

    default:
      return state;
  }
}
