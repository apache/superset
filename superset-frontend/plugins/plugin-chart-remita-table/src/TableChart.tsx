import React, {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';


import {ColumnInstance, ColumnWithLooseAccessor, DefaultSortTypes, Row,} from 'react-table';
import {extent as d3Extent, max as d3Max} from 'd3-array';
import {FaSort} from '@react-icons/all-files/fa/FaSort';
import {FaSortDown as FaSortDesc} from '@react-icons/all-files/fa/FaSortDown';
import {FaSortUp as FaSortAsc} from '@react-icons/all-files/fa/FaSortUp';
import cx from 'classnames';
import {
  BinaryQueryObjectFilterClause,
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  getSelectedText,
  getTimeFormatterForGranularity,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import { css, useTheme, type SupersetTheme } from '@apache-superset/core/ui';
import { t, tn } from '@apache-superset/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { Dropdown, Menu } from '@superset-ui/chart-controls';
import { Tooltip, SafeMarkdown, Button, Tag } from '@superset-ui/core/components';
// Column visibility control UI replaced with a simple label next to search
import HeaderCell from './TableChart/components/HeaderCell';
import {
  CheckOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  TableOutlined,
  PushpinOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  FilterOutlined,
  CopyOutlined,
  FileTextOutlined,
  MoreOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ColumnWidthOutlined,
  ReloadOutlined,
  CheckSquareOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { isEmpty, debounce, isEqual } from 'lodash';
import {ColorSchemeEnum, DataColumnMeta, TableChartTransformedProps, SearchOption} from './types';
import DataTable, {DataTableProps, SearchInputProps, SelectPageSizeRendererProps, SizeOption, BulkActionsConfig} from './DataTable';

import Styles from './Styles';
import {formatColumnValue} from './utils/formatValue';
import {PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS} from './consts';
import { updateTableOwnState } from './DataTable/utils/externalAPIs';
import getScrollBarSize from './DataTable/utils/getScrollBarSize';
import {ActionCell, RowActionConfig} from './ActionCell';
import {Alert} from "antd";
import ContextMenu from './TableChart/components/ContextMenu';
import { exportToCsv } from './utils/exportUtils';
import ErrorBoundary from './components/ErrorBoundary';
import { useTableState } from './hooks/useTableState';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useColumnStatePersistence, migrateOldColumnState } from './hooks/useColumnStatePersistence';
import { useToasts } from 'src/components/MessageToasts/withToasts';

type ValueRange = [number, number];

interface TableSize {
  width: number;
  height: number;
}

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType: GenericDataType): DefaultSortTypes {
  if (dataType === GenericDataType.Temporal) {
    return 'datetime';
  }
  if (dataType === GenericDataType.String) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
                     value,
                     valueRange,
                     alignPositiveNegative,
                   }: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
                      value,
                      valueRange,
                      alignPositiveNegative,
                    }: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
                          value,
                          colorPositiveNegative = false,
                        }: {
  value: number;
  colorPositiveNegative: boolean;
}) {
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  return `rgba(${r},0,0,0.2)`;
}

function SortIcon<D extends object>({column}: { column: ColumnInstance<D> }) {
  const {isSorted, isSortedDesc} = column;
  let sortIcon = <FaSort/>;
  if (isSorted) {
    sortIcon = isSortedDesc ? <FaSortDesc/> : <FaSortAsc/>;
  }
  return sortIcon;
}

import { Input } from '@superset-ui/core/components';
import { RawAntdSelect as Select } from '@superset-ui/core/components/Select';

function SearchInput({count, value, onChange}: SearchInputProps) {
  return (
    <span className="dt-global-filter" style={{ marginRight: '8px' }}>
      <Input
        aria-label={t('Search %s records', count)}
        size="small"
        placeholder={tn('search.num_records', count)}
        value={value}
        onChange={onChange}
        allowClear
      />
    </span>
  );
}

function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
  const { Option } = Select;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <label htmlFor="pageSizeSelect" style={{ margin: 0, fontWeight: 'normal' }}>
        {t('Show')}
      </label>
      <Select<number>
        id="pageSizeSelect"
        value={current}
        onChange={value => onChange(value)}
        size="small"
        css={(theme: SupersetTheme) => css`
          width: ${theme.sizeUnit * 18}px;
        `}
        aria-label={t('Show entries per page')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <Option key={size} value={Number(size)}>
              {text}
            </Option>
          );
        })}
      </Select>
    </span>
  );
}

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

function TableChartInner<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
    enable_bulk_actions?: boolean;
    selection_enabled?: boolean;
    include_row_numbers?: boolean;
    row_id_column?: string;
    bulk_action_label?: string,
    selection_mode?: 'single' | 'multiple';
    split_actions?: Set<any>;
    non_split_actions?: Set<any>;
    onBulkActionClick?: (actionKey?: string, selectedIds?: any[]) => void;
    enable_table_actions?: boolean;
    hide_row_id_column?: boolean;
    table_actions?: Set<any>;
    onTableActionClick?: (action?: string, id?: string, value?: string) => void;
    slice_id?: string;
    show_split_buttons_in_slice_header: boolean;
    retain_selection_across_navigation?: boolean;
    retain_selection_accross_navigation?: boolean; // legacy alias
    showSearchColumnSelector?: boolean;
    openInNewTab?: boolean;
  },
) {
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: columnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    sortDesc = false,
    filters,
    sticky = true, // whether to use sticky header
    columnColorFormatters,
    allowRearrangeColumns = false,
    allowRenderHtml = true,
    onContextMenu,
    emitCrossFilters,
    isUsingTimeComparison,
    basicColorFormatters,
    basicColorColumnFormatters,
    enable_bulk_actions = false,
    selection_enabled = true,
    include_row_numbers = false,
    row_id_column = 'id',
    bulk_action_label = 'Bulk Action',
    selection_mode = 'multiple',
    split_actions ,
    non_split_actions ,
    enable_table_actions = false,
    hide_row_id_column = false,
    table_actions,
    show_split_buttons_in_slice_header = false,
    retain_selection_across_navigation = undefined,
    retain_selection_accross_navigation: legacy_retain_selection_accross_navigation = undefined,
    showSearchColumnSelector = false,
    // Dashboard/native filters & derived query params
    nativeFilters,
    nativeParams,
    dashboardQueryParams,
    openInNewTab,
    humanizeHeaders = false,
    enableDrillFeatures = false,
  } = props;
  // Preserve columns even when data is empty to keep table headers visible
  const lastValidColumnsRef = useRef<DataColumnMeta[]>(columnsMeta || []);
  const safeColumnsMeta = useMemo(() => {
    if (Array.isArray(columnsMeta) && columnsMeta.length > 0) {
      lastValidColumnsRef.current = columnsMeta;
      return columnsMeta;
    }
    // If columnsMeta is empty but we have previous columns, use them
    return lastValidColumnsRef.current;
  }, [columnsMeta]);

  const retainSelectionAcrossNavigation =
    typeof retain_selection_across_navigation === 'boolean'
      ? retain_selection_across_navigation
      : Boolean(legacy_retain_selection_accross_navigation);
  const { show_description, description_markdown } = props as any;
  const descriptionRef = useRef<HTMLDivElement | null>(null);

  const sliceId = props?.slice_id as any;
  const chartId = props?.slice_id as any;

  // Parse table actions config early (needed by useTableState)
  // Note: table_actions is already a Set from transformProps, no parsing needed
  const tableActionsConfig = useMemo(() => {
    if (!enable_table_actions || !row_id_column || !table_actions) {
      return undefined;
    }

    try {
      // table_actions is already parsed in transformProps
      const actions = table_actions instanceof Set ? table_actions : new Set<RowActionConfig>();
      return {
        idColumn: row_id_column,
        actions,
      };
    } catch (e) {
      console.error('[TableChart] Failed to parse table actions:', e);
      return undefined;
    }
  }, [enable_table_actions, row_id_column, table_actions]);

  // Initialize table state with reducer pattern
  const { state: tableState, actions: tableActions } = useTableState<D>();

  // Initialize toast notifications
  const { addInfoToast, addDangerToast } = useToasts();

  // Auto-save column state persistence
  const { persistState, restoreState } = useColumnStatePersistence({
    tableId: sliceId || '',
    enabled: !!sliceId,
    debounceMs: 500, // Wait 500ms after last change before saving
  });

  // Helper: update ownState only if it actually changed
  const setOwnStateIfChanged = useCallback((next: any) => {
    try {
      if (!isEqual(next, serverPaginationData)) {
        updateTableOwnState(setDataMask, next);
      }
    } catch {
      updateTableOwnState(setDataMask, next);
    }
  }, [serverPaginationData, setDataMask]);

  // legacy placeholder (previously used for dedupe); kept for compatibility
  const recentEventsRef = useRef<Map<string, number>>(new Map());
  // Dedupe config with backward compatibility across environments
  function getRemitaDedupeEnabled(): boolean {
    const win: any = window as any;
    if (typeof win?.featureFlags?.REMITA_EVENT_DEDUPE_ENABLED === 'boolean') {
      return win.featureFlags.REMITA_EVENT_DEDUPE_ENABLED;
    }
    try {
      // Some environments may expose a custom FeatureFlag entry; guard dynamically
      const FF: any = FeatureFlag as any;
      if (FF && 'RemitaEventDedupeEnabled' in FF && typeof isFeatureEnabled === 'function') {
        return Boolean(isFeatureEnabled((FF as any).RemitaEventDedupeEnabled));
      }
    } catch {}
    // default safe behavior
    return true;
  }

  function getRemitaDedupeTtlMs(): number {
    const v = (window as any)?.featureFlags?.REMITA_EVENT_DEDUPE_TTL_MS;
    return typeof v === 'number' ? v : 1000;
  }

  const dedupeEnabled = getRemitaDedupeEnabled();
  const DEDUPE_TTL_MS: number = dedupeEnabled ? getRemitaDedupeTtlMs() : 0;

  function makeEventKey(msg: any) {
    try {
      const { action, chartId, actionType, values } = msg || {};
      // Build a lightweight fingerprint to avoid expensive JSON.stringify on large payloads
      let vKey = '';
      if (Array.isArray(values) && values.length) {
        const idField = (row_id_column as string) || (tableActionsConfig as any)?.idColumn || 'id';
        const ids: string[] = [];
        // Collect at most a few identifiers to keep the key small and stable
        const limit = 3;
        for (let i = 0; i < values.length && ids.length < limit; i += 1) {
          const v = values[i];
          if (v && typeof v === 'object') {
            const id = (v as any)[idField] ?? (v as any).id ?? String(Object.values(v)[0] ?? '');
            ids.push(String(id));
          } else {
            ids.push(String(v));
          }
        }
        const last = values[values.length - 1];
        const lastId = last && typeof last === 'object'
          ? String((last as any)[idField] ?? (last as any).id ?? '')
          : String(last ?? '');
        vKey = `${values.length}:${ids.join('|')}:${lastId}`;
      }
      // Only include compact fingerprint in the key
      return JSON.stringify({ action, chartId, actionType, vKey });
    } catch (e) {
      return String(Date.now());
    }
  }

  function shouldSendMessage(msg: any): boolean {
    if (!dedupeEnabled || DEDUPE_TTL_MS <= 0) return true;
    const key = makeEventKey(msg);
    const now = Date.now();
    const last = recentEventsRef.current.get(key) || 0;
    if (now - last < DEDUPE_TTL_MS) {
      return false;
    }
    recentEventsRef.current.set(key, now);
    // cleanup old entries occasionally
    if (recentEventsRef.current.size > 200) {
      const cutoff = now - DEDUPE_TTL_MS;
      for (const [k, ts] of recentEventsRef.current.entries()) {
        if (ts < cutoff) recentEventsRef.current.delete(k);
      }
    }
    return true;
  }

  const comparisonColumns = [
    {key: 'all', label: t('Display all')},
    {key: '#', label: '#'},
    {key: '△', label: '△'},
    {key: '%', label: '%'},
  ];
  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );

  // Extract state and actions for easier access
  const {
    descriptionHeight,
    tableSize,
    openHeaderMenuKey,
    showComparisonDropdown,
    contextMenu: ctxMenu,
    openFilterKey,
    message,
    columnOrderToggle,
  } = tableState.ui;

  const {
    selectedRows: rawSelectedRows,
    visibleColumnKeys,
    pinnedLeftKeys,
    pinnedRightKeys,
    tableColWidthsByKey,
    selectedComparisonColumns,
    hideComparisonKeys,
    quickFilters,
    advancedFilters,
    searchOptions,
  } = tableState.data;

  // Ensure selectedRows is always a Map (defensive guard against serialization issues)
  const selectedRows = rawSelectedRows instanceof Map
    ? rawSelectedRows
    : new Map(Object.entries(rawSelectedRows || {})) as Map<string, D>;

  // Keep a ref in sync with current selection to avoid recreating column definitions
  const selectedRowsRef = useRef<Map<string, D>>(selectedRows);
  // Update ref synchronously during render to ensure freshest value in render paths
  selectedRowsRef.current = selectedRows;

  // Rename actions for convenience (keeping original names for compatibility)
  const setDescriptionHeight = tableActions.setDescriptionHeight;
  const setTableSize = tableActions.setTableSize;
  const setOpenHeaderMenuKey = tableActions.setOpenHeaderMenuKey;
  const setShowComparisonDropdown = tableActions.setShowComparisonDropdown;
  const setCtxMenu = tableActions.setContextMenu;
  const setOpenFilterKey = tableActions.setOpenFilterKey;
  const toggleColumnOrder = tableActions.toggleColumnOrder;
  const setSelectedRows = tableActions.setSelectedRows;
  const setVisibleColumnKeys = tableActions.setVisibleColumnKeys;
  const setPinnedLeftKeys = tableActions.setPinnedLeftKeys;
  const setPinnedRightKeys = tableActions.setPinnedRightKeys;
  const setTableColWidthsByKey = tableActions.setColumnWidths;
  const updateColumnWidth = tableActions.updateColumnWidth;
  const setSelectedComparisonColumns = tableActions.setSelectedComparisonColumns;
  const setHideComparisonKeys = tableActions.setHideComparisonKeys;
  const setQuickFilters = tableActions.setQuickFilters;
  const updateQuickFilter = tableActions.updateQuickFilter;
  const setAdvancedFilters = tableActions.setAdvancedFilters;
  const updateAdvancedFilter = tableActions.updateAdvancedFilter;
  const setSearchOptions = tableActions.setSearchOptions;
  const addSelectedRow = tableActions.addSelectedRow;
  const removeSelectedRow = tableActions.removeSelectedRow;
  const clearSelectedRows = tableActions.clearSelectedRows;
  const bulkSelectRows = tableActions.bulkSelectRows;
  const toggleSelectedRow = tableActions.toggleSelectedRow;

  // Restore persisted column state on mount
  useEffect(() => {
    if (!sliceId) return;

    try {
      // Try to load from new unified format
      let savedState = restoreState();

      // If not found, try migrating from old format
      if (!savedState) {
        savedState = migrateOldColumnState(sliceId);
      }

      if (savedState) {
        // Restore visible columns
        if (savedState.visibleColumns !== undefined) {
          tableActions.setVisibleColumnKeys(savedState.visibleColumns);
        }

        // Restore column widths
        if (savedState.columnWidths && Object.keys(savedState.columnWidths).length > 0) {
          tableActions.setColumnWidths(savedState.columnWidths);
        }

        // Restore pinned columns
        if (savedState.pinnedLeft && savedState.pinnedLeft.length > 0) {
          tableActions.setPinnedLeftKeys(savedState.pinnedLeft);
        }

        if (savedState.pinnedRight && savedState.pinnedRight.length > 0) {
          tableActions.setPinnedRightKeys(savedState.pinnedRight);
        }
      }

      // Initialize advanced filters separately (not part of column state)
      const fromOwn = (serverPaginationData as any)?.advancedFilters;
      if (!fromOwn || typeof fromOwn !== 'object') {
        const filtersRaw = localStorage.getItem(`advancedFilters_${sliceId}`);
        if (filtersRaw) {
          const filters = JSON.parse(filtersRaw);
          if (filters && typeof filters === 'object') {
            tableActions.setAdvancedFilters(filters);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to restore column state:', err);
    }
  }, [sliceId, restoreState, tableActions]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Auto-save column state when it changes
  useEffect(() => {
    if (!sliceId) return;

    // Persist current state
    persistState({
      visibleColumns: visibleColumnKeys,
      columnWidths: tableColWidthsByKey,
      pinnedLeft: pinnedLeftKeys,
      pinnedRight: pinnedRightKeys,
    });
  }, [
    sliceId,
    visibleColumnKeys,
    tableColWidthsByKey,
    pinnedLeftKeys,
    pinnedRightKeys,
    persistState,
  ]);

  const theme = useTheme();
  // Build a fast lookup for rowId -> row
  const KEY_FIELD = '__rid' as const;
  const rowById = useMemo(() => {
    const map = new Map<string, D>();
    const idColumn = row_id_column || 'id';
    const seenIds = new Set<string>();
    let duplicateCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < data.length; i += 1) {
      const row = data[i];

      // Try to get ID from KEY_FIELD, then idColumn, then index
      let idRaw = (row as any)[KEY_FIELD] ?? (row as any)[idColumn];
      let id = String(idRaw ?? '').trim();

      // Use index as fallback if no valid ID
      if (!id) {
        id = `__row_${i}`;
        fallbackCount += 1;
      }

      // Handle duplicate IDs by appending suffix
      if (seenIds.has(id)) {
        const originalId = id;
        let suffix = 1;
        while (seenIds.has(`${originalId}_dup${suffix}`)) {
          suffix += 1;
        }
        id = `${originalId}_dup${suffix}`;
        duplicateCount += 1;
      }

      seenIds.add(id);
      map.set(id, row);
    }

    // Log warnings for debugging
    if (fallbackCount > 0) {
      console.warn(
        `TableChart: ${fallbackCount} rows are missing ID column '${idColumn}', using index-based fallback IDs`
      );
    }
    if (duplicateCount > 0) {
      console.warn(
        `TableChart: ${duplicateCount} duplicate row IDs detected, suffixes added to ensure uniqueness`
      );
    }

    return map;
  }, [data, row_id_column]);

  // Initialize keyboard navigation
  const keyboardNav = useKeyboardNavigation<D>({
    rows: data,
    columnCount: safeColumnsMeta?.length || 0,
    enableSelection: selection_enabled && enable_bulk_actions,
    selectedRows,
    onRowSelect: useCallback((rowId: string, row: D, multiSelect: boolean) => {
      if (multiSelect) {
        addSelectedRow(rowId, row);
      } else {
        setSelectedRows(new Map([[rowId, row]]));
      }
    }, [addSelectedRow, setSelectedRows]),
    onRowDeselect: useCallback((rowId: string) => {
      removeSelectedRow(rowId);
    }, [removeSelectedRow]),
    onClearSelection: useCallback(() => {
      clearSelectedRows();
    }, [clearSelectedRows]),
    onSelectAll: useCallback(() => {
      const all = new Map<string, D>();
      data.forEach((row, index) => {
        const id = String((row as any)[row_id_column] || index);
        all.set(id, row);
      });
      setSelectedRows(all);
    }, [data, row_id_column, setSelectedRows]),
    getRowId: useCallback((row: D, index: number) => {
      return String((row as any)[row_id_column] || index);
    }, [row_id_column]),
    onContextMenu: useCallback((row: D, columnKey: string) => {
      // Get the row position for context menu
      const target = document.querySelector(`[data-row-id="${(row as any)[row_id_column]}"]`) as HTMLElement;
      if (target) {
        const rect = target.getBoundingClientRect();
        setCtxMenu({
          open: true,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          row,
          colKey: columnKey,
        });
      }
    }, [row_id_column, setCtxMenu]),
    onRowAction: useCallback((row: D) => {
      // Trigger first available action - use refs to avoid initialization issues
      // tableActionsConfig and handleTableAction defined later in component
      // Will be available when this callback is actually invoked
    }, []),
  });

  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const opts = serverPagination ? SERVER_PAGE_SIZE_OPTIONS : PAGE_SIZE_OPTIONS;
    const filtered = (opts.filter(([n]) =>
      serverPagination
        ? (rowCount > 0 ? n <= rowCount : true)
        : n <= 2 * data.length,
    ) as SizeOption[]);
    // Ensure we always have sensible options available
    if (serverPagination && filtered.length === 0) return SERVER_PAGE_SIZE_OPTIONS as SizeOption[];
    if (!serverPagination && filtered.length <= 1) return PAGE_SIZE_OPTIONS as SizeOption[];
    return filtered;
  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      if (typeof data?.[0]?.[key] === 'number') {
        const nums = data.map(row => row[key]) as number[];
        return (
          alignPositiveNegative
            ? [0, d3Max(nums.map(Math.abs))]
            : d3Extent(nums)
        ) as ValueRange;
      }
      return null;
    },
    [data],
  );

  // Cache ranges to avoid scanning on every cell render
  const valueRangeCache = useMemo(() => {
    const pos = new Map<string, ValueRange>();
    const normal = new Map<string, ValueRange>();
    try {
      const candidates = (safeColumnsMeta || [])
        .filter(c => c && (c.isMetric || c.isPercentMetric || c.isNumeric))
        .map(c => String(c.key));
      for (const key of candidates) {
        const nums: number[] = [];
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] as any)?.[key];
          if (typeof v === 'number' && Number.isFinite(v)) nums.push(v);
        }
        if (nums.length) {
          const maxAbs = d3Max(nums.map(Math.abs)) as number;
          const [minVal, maxVal] = d3Extent(nums) as [number, number];
          pos.set(key, [0, maxAbs]);
          normal.set(key, [minVal, maxVal]);
        }
      }
    } catch {}
    return { pos, normal };
  }, [data, safeColumnsMeta]);

  const getValueRangeCached = useCallback(
    (key: string, alignPositiveNegative: boolean) =>
      (alignPositiveNegative ? valueRangeCache.pos : valueRangeCache.normal).get(key) || null,
    [valueRangeCache],
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  // split_actions and non_split_actions are already parsed Sets from transformProps
  const actions: BulkActionsConfig = useMemo(
    () => ({
      split: split_actions instanceof Set ? split_actions : new Set(),
      nonSplit: non_split_actions instanceof Set ? non_split_actions : new Set(),
    }),
    [split_actions, non_split_actions],
  );

  // Precompute search highlight regex for server pagination to avoid per-cell construction
  const highlightRe = useMemo(() => {
    if (!props.enableHighlightSearch || !serverPagination) return null as RegExp | null;
    const q = (serverPaginationData as any)?.searchText || '';
    if (!q) return null;
    try {
      // Escape regex special characters
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(esc, 'ig');
    } catch {
      return null;
    }
  }, [props.enableHighlightSearch, serverPagination, serverPaginationData]);

  const shouldHighlightColumn = useCallback(
    (colKey: string) => {
      if (!highlightRe) return false;
      const colSel = (serverPaginationData as any)?.searchColumn || '';
      return !colSel || String(colSel) === String(colKey);
    },
    [highlightRe, serverPaginationData],
  );

  // All action configs are already parsed Sets from transformProps
  const getAllActionConfigs = useCallback((): any[] => {
    const asArray = <T,>(s?: Set<T>): T[] => s instanceof Set ? Array.from(s) : [];
    return [
      ...asArray<any>(split_actions as Set<any>),
      ...asArray<any>(non_split_actions as Set<any>),
      ...asArray<any>(table_actions as Set<any>),
    ];
  }, [split_actions, non_split_actions, table_actions]);

  const findActionConfigByKey = useCallback(
    (key?: string | null): any | undefined => {
      if (!key) return undefined;
      const all = getAllActionConfigs();
      return all.find((a: any) => String(a?.key) === String(key));
    },
    [getAllActionConfigs],
  );

  // Read allowed origins configured by backend/SPA injection
  const getAllowedOrigins = useCallback((): string[] => {
    try {
      const win: any = window;
      if (Array.isArray(win?.REMITA_TABLE_ALLOWED_ACTION_ORIGINS)) {
        return win.REMITA_TABLE_ALLOWED_ACTION_ORIGINS;
      }
    } catch {}
    return [window.location.origin];
  }, []);

  const isOriginAllowed = useCallback((origin: string): boolean => {
    try {
      const allowed = getAllowedOrigins();
      if (allowed.includes('*')) return true; // Dev-only wildcard
      if (allowed.includes(origin)) return true;
      if (origin === window.location.origin) return true;
      return false;
    } catch {
      return origin === window.location.origin;
    }
  }, [getAllowedOrigins]);

  const buildResolvedUrl = useCallback(
    (baseUrl?: string | null, extraParams?: Record<string, any>) => {
      if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) return undefined;

      // Security: Block dangerous URL schemes
      const lowerUrl = baseUrl.toLowerCase().trim();
      const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
      if (dangerousSchemes.some(scheme => lowerUrl.startsWith(scheme))) {
        console.error('[SECURITY] Blocked dangerous URL scheme:', baseUrl);
        return undefined;
      }

      try {
        // Parse URL and validate origin
        const u = new URL(baseUrl, window.location.origin);

        // Security: Validate protocol is http or https
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          console.error('[SECURITY] Blocked non-HTTP(S) protocol:', u.protocol);
          return undefined;
        }

        // Security: Validate origin is allowed
        if (!isOriginAllowed(u.origin)) {
          console.warn(
            `[SECURITY] Blocked action URL to untrusted origin: ${u.origin}. ` +
            `Allowed origins: ${getAllowedOrigins().join(', ')}`
          );
          return undefined;
        }

        const sp = u.searchParams;
        Object.entries(extraParams || {}).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          sp.set(k, String(v));
        });
        // Match expected encoding in tests: spaces as %20 and commas unencoded
        const qs = sp.toString().replace(/%2C/g, ',').replace(/\+/g, '%20');
        u.search = qs;
        return u.toString();
      } catch (e) {
        console.error('[SECURITY] Invalid action URL:', baseUrl, e);
        return undefined;
      }
    },
    [getAllowedOrigins, isOriginAllowed],
  );

  const lastSelectedRow = useRef<string | null>(null);

  // At the top of your component function, with other state and ref declarations
  const firstLoadRef = useRef(false);

// Then in your useEffect
  useEffect(() => {
    // Only load from storage on initial mount, not when sliceId changes mid-session
    if (!firstLoadRef.current) {
      firstLoadRef.current = true;
      if (retainSelectionAcrossNavigation) {
        const savedSelectedRows = localStorage.getItem(`selectedRows_${sliceId}`);
        if (savedSelectedRows) {
          try {
            const parsed = JSON.parse(savedSelectedRows);
            // Back-compat: support 3 formats
            // 1) Array<[id, row]> pairs (legacy)
            // 2) Plain object { id: row }
            // 3) Array<string> of ids (current, lightweight)
            let restoredMap = new Map<string, D>();
            if (Array.isArray(parsed)) {
              if (parsed.length > 0 && typeof parsed[0] === 'string') {
                // Array of IDs → map using current data
                (parsed as string[]).forEach(id => {
                  const row = rowById.get(String(id));
                  if (row) restoredMap.set(String(id), row);
                });
              } else {
                // Assume entries
                restoredMap = new Map<string, D>(parsed as [string, D][]);
              }
            } else if (parsed && typeof parsed === 'object') {
              restoredMap = new Map<string, D>(Object.entries(parsed as Record<string, D>));
            }
            setSelectedRows(restoredMap);
          } catch (err) {
            console.warn("Could not parse selected rows", err);
          }
        }
      } else {
        // Explicitly clear persisted selection when retention is disabled
        try {
          localStorage.removeItem(`selectedRows_${sliceId}`);
        } catch (err) {
          // no-op
        }
      }
    }
  }, [sliceId, retainSelectionAcrossNavigation, rowById, setSelectedRows]);

  // @ts-ignore
  const handleRowSelect =  useCallback(
    (rowId: string, event?: React.MouseEvent) => {
      const rowData = rowById.get(rowId);
      if (!rowData) return;

      if (selection_mode === 'single') {
        // Single selection: clear all then add this row
        clearSelectedRows();
        addSelectedRow(rowId, rowData);
      } else {
        // Multiple selection mode
        if (event?.shiftKey && lastSelectedRow.current) {
          // Shift-click: select range
          const visibleRows = data;
          const visibleIds = visibleRows.map(row => String((row as any)[row_id_column as keyof D] ?? (row as any)[KEY_FIELD] ?? ''));
          const startIdx = visibleIds.indexOf(lastSelectedRow.current);
          const endIdx = visibleIds.indexOf(rowId);

          if (startIdx > -1 && endIdx > -1) {
            const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
            const rowsToAdd = visibleRows.slice(min, max + 1).map(row => {
              const id = String((row as any)[row_id_column as keyof D] ?? (row as any)[KEY_FIELD] ?? '');
              return { id, row };
            }).filter(item => item.id);

            bulkSelectRows(rowsToAdd);
          }
        } else {
          // Normal click: toggle selection
          toggleSelectedRow(rowId, rowData);
          lastSelectedRow.current = rowId;
        }
      }
    },
    [selection_mode, data, row_id_column, clearSelectedRows, addSelectedRow, bulkSelectRows, toggleSelectedRow, rowById],
  );





  const persistSelectionDebounced = useMemo(
    () =>
      debounce((key: string, ids: string[]) => {
        try {
          // Store only IDs for performance and to reduce storage size
          localStorage.setItem(key, JSON.stringify(ids));
        } catch {}
      }, 600),
    [],
  );

  useEffect(() => {
    try {
      const storageKey = `selectedRows_${sliceId}`;
      if (retainSelectionAcrossNavigation && selectedRows.size > 0) {
        const ids = Array.from(selectedRows.keys());
        persistSelectionDebounced(storageKey, ids);
      } else if (!retainSelectionAcrossNavigation) {
        localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.warn("Failed to persist selection to localStorage:", err);
    }
  }, [selectedRows, retainSelectionAcrossNavigation, sliceId, persistSelectionDebounced]);

  useEffect(() => () => persistSelectionDebounced.cancel(), [persistSelectionDebounced]);


  /**
   * Core function to send messages to the parent window or show alerts.
   */
  function doSendWindowPostMessage(messageData: any) {
    if (!shouldSendMessage(messageData)) {
      return;
    }
    if (window.self === window.top) {
      doShowAlertMessage(messageData);
    } else {
      // Restrict postMessage: same-origin by default, allow cross-origin only if allowlisted
      try {
        const ref = document.referrer || '';
        const parentOrigin = ref ? new URL(ref).origin : window.location.origin;
        if (!isOriginAllowed(parentOrigin)) {
          console.warn('[SECURITY] Blocked postMessage to untrusted origin:', parentOrigin);
          return;
        }
        window.parent.postMessage(messageData, parentOrigin);
      } catch (err) {
        console.warn('[SECURITY] Unable to determine parent origin; suppressing postMessage');
      }
    }
  }

  function doShowAlertMessage(messageData: any) {
    // Display message as toast notification
    try {
      const msgText = typeof messageData === 'string' ? messageData : JSON.stringify(messageData);
      addInfoToast(msgText);
    } catch (err) {
      console.error('Failed to display message:', err);
    }
  }
  const sendWindowPostMessage = useCallback((messageData: any) => {
    doSendWindowPostMessage(messageData);
  }, []);

  type RowActionInfo = { action: string; chartId?: string | number; key?: string; value?: any[]; matchingRlsConditions?: Record<string, any> };
  const handleTableAction = useCallback(
    (actionOrKey: string | RowActionInfo, maybeSelected?: unknown[]) => {
      const safeNavigate = (url?: string) => {
        if (!url) return;
        try {
          if (openInNewTab) {
            const win = window.open(url, '_blank', 'noopener,noreferrer');
            if (win) return;
          }
          if (!openInNewTab) {
            if (window.top && window.top.location && window.top.location.origin === window.location.origin) {
              window.top.location.href = url;
            } else {
              window.location.href = url;
            }
          }
        } catch {
          try {
            if (openInNewTab) {
              window.open(url, '_blank');
            } else {
              window.location.href = url;
            }
          } catch {}
        }
      };

      // Bulk actions: action key string
      if (typeof actionOrKey === 'string') {
        const actionKey = actionOrKey;
        const actionCfg: any = findActionConfigByKey(actionKey);
        const includeFilters = (actionCfg?.includeDashboardFilters !== undefined)
          ? Boolean(actionCfg.includeDashboardFilters)
          : true;
        const resolvedUrl = includeFilters
          ? buildResolvedUrl(actionCfg?.actionUrl, dashboardQueryParams)
          : actionCfg?.actionUrl;

        // Build values similar to single row publish: array of row objects
        // When coming from DataTable, `maybeSelected` is Array<[id, row]>; otherwise treat as array
        let selectedValues: any[] = [];
        if (Array.isArray(maybeSelected)) {
          const first = maybeSelected[0] as unknown;
          const asPairs = Array.isArray(first) && (first as any[]).length === 2;
          const rows = asPairs
            ? (maybeSelected as any[]).map((pair: any[]) => pair[1])
            : (maybeSelected as any[]);
          // Optionally trim to valueColumns if provided in action config
          const cols = Array.isArray((actionCfg as any)?.valueColumns)
            ? (actionCfg as any).valueColumns as string[]
            : undefined;
          if (cols && cols.length > 0) {
            selectedValues = rows.map((r: any) => {
              const out: any = {};
              cols.forEach(k => { if (k in r) out[k] = r[k]; });
              return out;
            });
          } else {
            selectedValues = rows;
          }
        }

        // Enforce selection mode: if single, publish at most one row
        let valuesForPublish = selectedValues;
        if (selection_mode === 'single' && Array.isArray(valuesForPublish) && valuesForPublish.length > 1) {
          valuesForPublish = [valuesForPublish[0]];
        }

        const payload = {
          action: 'bulk-action',
          chartId,
          actionType: actionKey,
          values: valuesForPublish,
          origin: 'bulk',
          ...(includeFilters ? {
            nativeFilters,
            nativeParams,
            queryParams: dashboardQueryParams,
            resolvedUrl,
          } : {}),
        } as any;
        sendWindowPostMessage(payload);
        // Show publish toast only in dev or when embedded (iframe)
        try {
          const isDev = process.env.NODE_ENV !== 'production';
          let isEmbedded = false;
          try { isEmbedded = window.self !== window.top; } catch { isEmbedded = true; }
          if (isDev || isEmbedded) {
            const count = Array.isArray(valuesForPublish) ? valuesForPublish.length : 0;
            addInfoToast(t('Published %s (%s rows)', actionKey, String(count)));
          }
        } catch {}

        // Auto-navigate if this is not a publish event and we have a resolved URL
        const publishEvent = Boolean(actionCfg?.publishEvent);
        if (!publishEvent && resolvedUrl) {
          const useNewTab = (typeof actionCfg?.openInNewTab === 'boolean')
            ? actionCfg.openInNewTab
            : (openInNewTab !== undefined ? Boolean(openInNewTab) : true);
          if (useNewTab) {
            try { window.open(resolvedUrl, '_blank', 'noopener,noreferrer'); } catch {}
          }
          const nav = (url?: string) => {
            if (!url) return;
            try {
              if (useNewTab) return; // already attempted above
              if (!useNewTab) {
                if (window.top && window.top.location && window.top.location.origin === window.location.origin) {
                  window.top.location.href = url;
                } else {
                  window.location.href = url;
                }
              }
            } catch {
              try { useNewTab ? window.open(url, '_blank') : (window.location.href = url); } catch {}
            }
          };
          nav(resolvedUrl);
        }
        return;
      }

      // Row actions: object with metadata
      const action = (actionOrKey as RowActionInfo) || ({} as RowActionInfo);
      const actionKey = action?.key;
      const actionCfg: any = findActionConfigByKey(actionKey);
      const includeFilters = (actionCfg?.includeDashboardFilters !== undefined)
        ? Boolean(actionCfg.includeDashboardFilters)
        : true;
      const resolvedUrl = includeFilters
        ? buildResolvedUrl(actionCfg?.actionUrl, dashboardQueryParams)
        : actionCfg?.actionUrl;
      const origin = action.action === 'bulk-action' ? 'bulk' : 'row';

      const payload = {
        action: action.action,
        chartId: action.chartId ?? chartId,
        actionType: actionKey,
        values: action.value,
        origin,
        // Include any RLS conditions that matched (if provided by ActionCell)
        ...(action?.matchingRlsConditions ? { matchingRlsConditions: action.matchingRlsConditions } : {}),
        ...(includeFilters ? {
          nativeFilters,
          nativeParams,
          queryParams: dashboardQueryParams,
          resolvedUrl,
        } : {}),
      } as any;

      sendWindowPostMessage(payload);
      // Show publish toast only in dev or when embedded (iframe)
      try {
        const isDev = process.env.NODE_ENV !== 'production';
        let isEmbedded = false;
        try { isEmbedded = window.self !== window.top; } catch { isEmbedded = true; }
        if (isDev || isEmbedded) {
          addInfoToast(t('Published %s (1 row)', actionKey));
        }
      } catch {}

      const publishEvent = Boolean(actionCfg?.publishEvent);
      if (!publishEvent && resolvedUrl) {
        const useNewTab = typeof actionCfg?.openInNewTab === 'boolean' ? actionCfg.openInNewTab : false;
        const nav = (url?: string) => {
          if (!url) return;
          try {
            if (useNewTab) {
              const win = window.open(url, '_blank', 'noopener,noreferrer');
              if (win) return;
            }
            if (!useNewTab) {
              if (window.top && window.top.location && window.top.location.origin === window.location.origin) {
                window.top.location.href = url;
              } else {
                window.location.href = url;
              }
            }
          } catch {
            try { useNewTab ? window.open(url, '_blank') : (window.location.href = url); } catch {}
          }
        };
        nav(resolvedUrl);
      }
    },
    [chartId, sendWindowPostMessage, nativeFilters, nativeParams, dashboardQueryParams, findActionConfigByKey, buildResolvedUrl],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Map());
  }, []);


  useEffect(() => {
    const handleMessage = (event: any) => {
      const eventData = event.detail;
      if (eventData.data && eventData.notification === 'alert-event') {
        doShowAlertMessage(eventData.data);
      } else if (eventData.data && eventData.notification === 'publish-event') {
        const data = eventData.data || {};
        // Ensure origin is present but preserve key order by appending if missing
        const enriched = 'origin' in data ? data : { ...data, origin: 'header' };
        sendWindowPostMessage(enriched);
      }
    };

    window.addEventListener('remita.notification', handleMessage);
    return () => {
      window.removeEventListener('remita.notification', handleMessage);
    };
  }, [sendWindowPostMessage]);

  const handleBulkSelect = useCallback(
    (visibleData: D[]) => {
      // Compute next selection in a single pass to avoid multiple dispatches/renders
      const visibleIds = visibleData.map(row => String(row[row_id_column as keyof D]));
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRowsRef.current.has(id));

      const next = new Map(selectedRowsRef.current);
      if (allVisibleSelected) {
        // Deselect all visible
        visibleIds.forEach(id => next.delete(id));
      } else {
        // Select all visible
        visibleData.forEach(row => {
          const id = String(row[row_id_column as keyof D]);
          next.set(id, row);
        });
      }
      setSelectedRows(next);
    },
    [row_id_column, setSelectedRows],
  );

  // Stable ref to bulk-select handler used inside column definitions
  const handleBulkSelectRef = useRef(handleBulkSelect);
  useEffect(() => { handleBulkSelectRef.current = handleBulkSelect; }, [handleBulkSelect]);

  const getCrossFilterDataMask = (key: string, value: DataRecordValue) => {
    let updatedFilters = {...(filters || {})};
    if (filters && isActiveFilterValue(key, value)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [value],
      };
    }
    if (
      Array.isArray(updatedFilters[key]) &&
      updatedFilters[key].length === 0
    ) {
      delete updatedFilters[key];
    }
    const groupBy = Object.keys(updatedFilters);
    const groupByValues = Object.values(updatedFilters);
    const labelElements: string[] = [];
    groupBy.forEach(col => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(updatedFilters?.[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map(value =>
          isTimestamp ? timestampFormatter(value) : value,
        );
        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });
    return {
      dataMask: {
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                const val = ensureIsArray(updatedFilters?.[col]);
                if (!val.length)
                  return {
                    col,
                    op: 'IS NULL' as const,
                  };
                return {
                  col,
                  op: 'IN' as const,
                  val: val.map(el =>
                    el instanceof Date ? el.getTime() : el!,
                  ),
                  grain: col === DTTM_ALIAS ? timeGrain : undefined,
                };
              }),
        },
        filterState: {
          label: labelElements.join(', '),
          value: groupByValues.length ? groupByValues : null,
          filters:
            updatedFilters && Object.keys(updatedFilters).length
              ? updatedFilters
              : null,
        },
      },
      isCurrentValueSelected: isActiveFilterValue(key, value),
    };
  };

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = (column: DataColumnMeta): CSSProperties => {
    const {isNumeric, config = {}} = column;
    const textAlign =
      config.horizontalAlign ||
      (isNumeric && !isUsingTimeComparison ? 'right' : 'left');
    return {
      textAlign,
    };
  };

  const comparisonLabels = [t('Main'), '#', '△', '%'];
  const filteredColumnsMeta = useMemo(() => {
    if (!isUsingTimeComparison) {
      return safeColumnsMeta;
    }
    const allColumns = comparisonColumns[0].key;
    const main = comparisonLabels[0];
    const showAllColumns = selectedComparisonColumns.includes(allColumns);
    return safeColumnsMeta.filter(({label, key}) => {
      // Extract the key portion after the space, assuming the format is always "label key"
      const keyPortion = key.substring(label.length);
      const isKeyHidded = hideComparisonKeys.includes(keyPortion);
      const isLableMain = label === main;

      return (
        isLableMain ||
        (!isKeyHidded &&
          (!comparisonLabels.includes(label) ||
            showAllColumns ||
            selectedComparisonColumns.includes(label)))
      );
    });
  }, [
    safeColumnsMeta,
    comparisonColumns,
    comparisonLabels,
    isUsingTimeComparison,
    hideComparisonKeys,
    selectedComparisonColumns,
  ]);

  const handleContextMenu =
    onContextMenu && !isRawRecords && enableDrillFeatures
      ? (
        value: D,
        cellPoint: {
          key: string;
          value: DataRecordValue;
          isMetric?: boolean;
        },
        clientX: number,
        clientY: number,
      ) => {
        // Build crossFilter always when applicable; conditionally add drill payloads when enabled
        const payload: any = {
          crossFilter: cellPoint.isMetric
            ? undefined
            : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
        };
        if (enableDrillFeatures) {
          try {
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            filteredColumnsMeta.forEach(col => {
              if (!col.isMetric) {
                const dataRecordValue = (value as any)[col.key];
                drillToDetailFilters.push({
                  col: col.key,
                  op: '==',
                  val: dataRecordValue as string | number | boolean,
                  formattedVal: formatColumnValue(col, dataRecordValue)[1],
                });
              }
            });
            payload.drillToDetail = drillToDetailFilters;
            if (!cellPoint.isMetric) {
              payload.drillBy = {
                filters: [
                  {
                    col: cellPoint.key,
                    op: '==',
                    val: cellPoint.value as string | number | boolean,
                  },
                ],
                groupbyFieldName: 'groupby',
              };
            }
          } catch {}
        }
        onContextMenu(clientX, clientY, payload);
      }
      : undefined;

  const getHeaderColumns = (
    safeColumnsMeta: DataColumnMeta[],
    enableTimeComparison?: boolean,
  ) => {
    const resultMap: Record<string, number[]> = {};
    if (!enableTimeComparison) {
      return resultMap;
    }
    safeColumnsMeta.forEach((element, index) => {
      // Check if element's label is one of the comparison labels
      if (comparisonLabels.includes(element.label)) {
        // Extract the key portion after the space, assuming the format is always "label key"
        const keyPortion = element.key.substring(element.label.length);

        // If the key portion is not in the map, initialize it with the current index
        if (!resultMap[keyPortion]) {
          resultMap[keyPortion] = [index];
        } else {
          // Add the index to the existing array
          resultMap[keyPortion].push(index);
        }
      }
    });
    return resultMap;
  };

  const renderTimeComparisonDropdown = (): JSX.Element => {
    const allKey = comparisonColumns[0].key;
    const handleOnClick = (data: any) => {
      const {key} = data;
      // Toggle 'All' key selection
      if (key === allKey) {
        setSelectedComparisonColumns([allKey]);
      } else if (selectedComparisonColumns.includes(allKey)) {
        setSelectedComparisonColumns([key]);
      } else {
        // Toggle selection for other keys
        setSelectedComparisonColumns(
          selectedComparisonColumns.includes(key)
            ? selectedComparisonColumns.filter(k => k !== key) // Deselect if already selected
            : [...selectedComparisonColumns, key],
        ); // Select if not already selected
      }
    };

    const handleOnBlur = () => {
      if (selectedComparisonColumns.length === 3) {
        setSelectedComparisonColumns([comparisonColumns[0].key]);
      }
    };

    return (
      <Dropdown
        placement="bottomRight"
        open={showComparisonDropdown}
        onOpenChange={(flag: boolean) => {
          setShowComparisonDropdown(flag);
          if (!flag) handleOnBlur();
        }}
        menu={{
          items: comparisonColumns.map(c => ({ key: c.key, label: (
            <span css={css`color: ${theme.colorTextSecondary};`}>{c.label}</span>
          ) })),
          onClick: ({ key }: any) => handleOnClick({ key }),
          selectable: true,
          selectedKeys: selectedComparisonColumns,
        }}
        trigger={['click']}
      >
        <span>
          <TableOutlined/> <DownOutlined/>
        </span>
      </Dropdown>
    );
  };

  const renderGroupingHeaders = (): JSX.Element => {
    // TODO: Make use of ColumnGroup to render the aditional headers
    const headers: any = [];
    let currentColumnIndex = 0;
    Object.entries(groupHeaderColumns || {}).forEach(([key, value]) => {
      // Calculate the number of placeholder columns needed before the current header
      const startPosition = value[0];
      const colSpan = value.length;

      // Add placeholder <th> for columns before this header
      for (let i = currentColumnIndex; i < startPosition; i += 1) {
        headers.push(
          <th
            key={`placeholder-${i}`}
            style={{borderBottom: 0}}
            aria-label={`Header-${i}`}
          />,
        );
      }

      // Add the current header <th>
      headers.push(
        <th key={`header-${key}`} colSpan={colSpan} style={{borderBottom: 0}}>
          {key}
          <span
            css={css`
              float: right;

              & svg {
                color: ${theme.colorText} !important;
              }
            `}
          >
            {hideComparisonKeys.includes(key) ? (
              <PlusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys(
                    hideComparisonKeys.filter(k => k !== key),
                  )
                }
              />
            ) : (
              <MinusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys([...hideComparisonKeys, key])
                }
              />
            )}
          </span>
        </th>,
      );

      // Update the current column index
      currentColumnIndex = startPosition + colSpan;
    });
    return (
      <tr
        css={css`
          th {
            border-right: 2px solid ${theme.colorSplit};
          }

          th:first-of-type {
            border-left: none;
          }

          th:last-of-type {
            border-right: none;
          }
        `}
      >
        {headers}
      </tr>
    );
  };

  const groupHeaderColumns = useMemo(
    () => getHeaderColumns(filteredColumnsMeta, isUsingTimeComparison),
    [filteredColumnsMeta, isUsingTimeComparison],
  );

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> => {
      const {
        key,
        label,
        isNumeric,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const configuredWidth = Number.isNaN(Number(config.columnWidth))
        ? (config.columnWidth as any)
        : Number(config.columnWidth);
      const persistedWidth = tableColWidthsByKey?.[key];
      const columnWidth =
        typeof persistedWidth === 'number' && Number.isFinite(persistedWidth)
          ? persistedWidth
          : configuredWidth;

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = getSharedStyle(column);
      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;
      const {truncateLongCells} = config;
      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;
      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;
      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        (config.showCellBars === undefined
          ? showCellBars
          : config.showCellBars) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRangeCached(key, alignPositiveNegative);

      let className = '';
      if (emitCrossFilters && !isMetric) {
        className += ' dt-is-filter';
      }
      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1]) {
          className += ' right-border-only';
        }
      }
      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        accessor: ((datum: D) => datum[key]) as never,
        // preserve original data key for server-side sorting
        // used to map sortBy from column id to query column key
        // @ts-ignore
        columnKey: key,
        Cell: ({value, row, column: reactTableColumn}: { value: DataRecordValue; row: Row<D>; column: any }) => {
          const [isHtml, rawText] = formatColumnValue(column, value);
          let text: any = rawText;
          // Get column index for keyboard navigation
          const columnIndex = appliedVisibleColumnsMeta.findIndex(c => c.key === key);
          // Highlight search matches (server pagination only) using precomputed regex
          if (highlightRe && serverPagination && typeof rawText === 'string' && shouldHighlightColumn(String(column.key))) {
            try {
              const re = highlightRe;
              const str = String(rawText);
              const parts = str.split(re);
              const matches = str.match(re);
              if (matches && matches.length) {
                const out: any[] = [];
                parts.forEach((p, i) => {
                  out.push(p);
                  if (i < matches.length) out.push(<mark key={`m-${i}`}>{matches[i]}</mark>);
                });
                text = out;
              }
            } catch {}
          }
          const html = isHtml && allowRenderHtml ? {__html: text} : undefined;
          let backgroundColor;
          let arrow = '';
          const originKey = column.key.substring(column.label.length).trim();
          if (!hasColumnColorFormatters && hasBasicColorFormatters) {
            backgroundColor =
              basicColorFormatters[row.index][originKey]?.backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorFormatters[row.index][originKey]?.mainArrow
                : '';
          }
          if (hasColumnColorFormatters) {
            columnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value || value === 0
                    ? formatter.getColorFromValue(value as number)
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
          }
          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            backgroundColor =
              basicColorColumnFormatters[row.index][column.key]
                ?.backgroundColor || backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorColumnFormatters[row.index][column.key]?.mainArrow
                : '';
          }
          const cellCSS = css`
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : 'normal'};
            position: relative;
            background: ${backgroundColor || 'transparent'};
          `;
          const cellBarStyles = css`
            position: absolute;
            height: 100%;
            display: block;
            top: 0;
            ${valueRange &&
            `
            width: ${`${cellWidth({
              value: value as number,
              valueRange,
              alignPositiveNegative,
            })}%`};
            left: ${`${cellOffset({
              value: value as number,
              valueRange,
              alignPositiveNegative,
            })}%`};
            background-color: ${cellBackground({
              value: value as number,
              colorPositiveNegative,
            })};
          `}
          `;
          let arrowStyles = css`
            color: ${basicColorFormatters &&
            basicColorFormatters[row.index][originKey]?.arrowColor ===
            ColorSchemeEnum.Green
              ? theme.colorSuccess
              : theme.colorError};
            margin-right: ${theme.sizeUnit}px;
          `;
          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            arrowStyles = css`
              color: ${basicColorColumnFormatters[row.index][column.key]
                ?.arrowColor === ColorSchemeEnum.Green
                ? theme.colorSuccess
                : theme.colorError};
              margin-right: ${theme.sizeUnit}px;
            `;
          }
          const cellProps = {
            'aria-labelledby': `header-${column.key}`,
            role: 'cell',
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                  // allow selecting text in a cell
                  if (!getSelectedText()) {
                    toggleFilter(key, value);
                  }
                }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              // Local copy/export menu
              if (props.enableContextMenuExport) {
                setCtxMenu({ open: true, x: (e as any).clientX, y: (e as any).clientY, row: row.original, colKey: key });
              }
              // External context handler (drill/crossfilter)
              if (handleContextMenu) {
                try {
                  handleContextMenu(
                    row.original,
                    { key, value, isMetric },
                    (e as any).clientX,
                    (e as any).clientY,
                  );
                } catch (err) {
                  // Swallow drill detail integration errors to avoid crashing render
                  // e.g., if core's buildDrillDetailItems is unavailable in a given version
                  try { console.warn('Context menu integration error:', err); } catch {}
                }
              }
            },
            onKeyDown: keyboardNav.handleKeyDown,
            onFocus: () => {
              keyboardNav.setFocusedCell({ rowIndex: row.index, columnIndex });
            },
            className: [
              className,
              value == null ? 'dt-is-null' : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
              keyboardNav.isCellFocused(row.index, columnIndex) ? 'dt-cell-focused' : '',
            ].join(' '),
            tabIndex: keyboardNav.getCellTabIndex(row.index, columnIndex),
            'data-row-index': row.index,
            'data-column-index': columnIndex,
            'data-row-id': (row.original as any)[row_id_column],
          };
          // Calculate pinned column styling first, before any cell rendering
          const pinnedLeft = props.enablePinColumns && isPinnedLeft(key);
          const pinnedRight = props.enablePinColumns && isPinnedRight(key);
          const pinnedTdStyle: CSSProperties = {
            ...(pinnedLeft ? { position: 'sticky', left: pinnedLeftOffsets.get(key) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
            ...(pinnedRight ? { position: 'sticky', right: pinnedRightOffsets.get(key) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
            ...(columnWidth !== undefined && columnWidth !== null ? ({ width: columnWidth as any } as CSSProperties) : {}),
          };
          const pinnedClassName = [pinnedLeft ? 'pinned-left' : '', pinnedRight ? 'pinned-right' : ''].filter(Boolean).join(' ');

          if (html) {
            if (truncateLongCells) {
              // eslint-disable-next-line react/no-danger
              return (
                <td key={`cell-${row.id}-${key}`} css={cellCSS} style={pinnedTdStyle} className={pinnedClassName} {...(cellProps as any)}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? {width: columnWidth} : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </td>
              );
            }
            // eslint-disable-next-line react/no-danger
            return <td key={`cell-${row.id}-${key}`} css={cellCSS} style={pinnedTdStyle} className={pinnedClassName} {...(cellProps as any)} dangerouslySetInnerHTML={html}/>;
          }
          // If cellProps renders textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
          return (
            <td key={`cell-${row.id}-${key}`} css={cellCSS} style={pinnedTdStyle} className={pinnedClassName} {...(cellProps as any)}>
              {valueRange && (
                <div
                  /* The following classes are added to support custom CSS styling */
                  className={cx(
                    'cell-bar',
                    typeof value === 'number' && value < 0
                      ? 'negative'
                      : 'positive',
                  )}
                  css={cellBarStyles}
                  role="presentation"
                />
              )}
              {truncateLongCells ? (
                <div
                  className="dt-truncate-cell"
                  style={columnWidth ? {width: columnWidth} : undefined}
                >
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </div>
              ) : (
                <>
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </>
              )}
            </td>
          );
        },
        Header: (headerProps: any) => (
          <HeaderCell
            headerProps={headerProps}
            label={label}
            colKey={key}
            column={column}
            columnHeaderClassName={className}
            sharedStyle={sharedStyle}
            columnWidth={columnWidth}
            theme={theme}
            enablePinColumns={props.enablePinColumns}
            enableColumnVisibility={props.enableColumnVisibility}
            enableColumnResize={props.enableColumnResize}
            enableAdvancedColumnFilters={(props as any).enableAdvancedColumnFilters}
            serverPagination={serverPagination}
            isPinnedLeft={isPinnedLeft}
            isPinnedRight={isPinnedRight}
            pinnedLeftOffsets={pinnedLeftOffsets}
            pinnedRightOffsets={pinnedRightOffsets}
            pinnedLeftKeys={pinnedLeftKeys}
            pinnedRightKeys={pinnedRightKeys}
            savePinned={savePinned}
            tableColWidthsByKey={tableColWidthsByKey}
            setTableColWidthsByKey={setTableColWidthsByKey}
            appliedVisibleColumnsMeta={appliedVisibleColumnsMeta}
            visibleColumnsMeta={visibleColumnsMeta}
            visibleColumnKeys={visibleColumnKeys}
            saveVisibleColumns={saveVisibleColumns}
            data={data}
            sliceId={sliceId}
            chartId={chartId}
            openHeaderMenuKey={openHeaderMenuKey}
            setOpenHeaderMenuKey={setOpenHeaderMenuKey}
            advancedFilters={advancedFilters}
            setAdvancedFilters={setAdvancedFilters}
            applyAdvancedFilters={applyAdvancedFilters}
            openFilterKey={openFilterKey}
            setOpenFilterKey={setOpenFilterKey}
            quickFilters={quickFilters}
            setQuickFilters={setQuickFilters}
            ACTION_KEYS={ACTION_KEYS}
            isNumeric={Boolean(isMetric || isPercentMetric || (column as any)?.isNumeric)}
            isTemporal={dataType === GenericDataType.Temporal}
            isBoolean={dataType === (GenericDataType as any).Boolean}
          />
        ),
        Footer: totals
          ? ((footerProps: any) => {
            const footerPinnedLeft = props.enablePinColumns && isPinnedLeft(key);
            const footerPinnedRight = props.enablePinColumns && isPinnedRight(key);
            const footerPinnedStyle: CSSProperties = {
              ...sharedStyle,
              ...(footerPinnedLeft ? { position: 'sticky', left: pinnedLeftOffsets.get(key) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
              ...(footerPinnedRight ? { position: 'sticky', right: pinnedRightOffsets.get(key) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
            };
            const footerPinnedClassName = [footerPinnedLeft ? 'pinned-left' : '', footerPinnedRight ? 'pinned-right' : ''].filter(Boolean).join(' ');

            return i === 0 ? (
              <th key={`footer-${key}`} {...footerProps} style={footerPinnedStyle} className={footerPinnedClassName}>
                <div
                  css={css`
                    display: flex;
                    align-items: center;

                    & svg {
                      margin-left: ${theme.sizeUnit}px;
                      color: ${theme.colorTextSecondary} !important;
                    }
                  `}
                >
                  {t('Summary')}
                  <Tooltip
                    title={t(
                      'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
                    )}
                  >
                    <InfoCircleOutlined/>
                  </Tooltip>
                </div>
              </th>
            ) : (
              <td key={`footer-${key}`} {...footerProps} style={footerPinnedStyle} className={footerPinnedClassName}>
                <strong>{formatColumnValue(column, totals[key])[1]}</strong>
              </td>
            );
          })
          : undefined,
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitCrossFilters,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      toggleFilter,
      totals,
      columnColorFormatters,
      columnOrderToggle,
    ],
  );

  const visibleColumnsMeta = useMemo(
    () => filteredColumnsMeta.filter(col => (col as any)?.config?.visible !== false),
    [filteredColumnsMeta],
  );

  const columns = useMemo(
    () => visibleColumnsMeta.map(getColumnConfigs),
    [visibleColumnsMeta, getColumnConfigs],
  );

  const appliedVisibleColumnsMeta = useMemo(() => {
    if (!props.enableColumnVisibility || !Array.isArray(visibleColumnKeys) || visibleColumnKeys.length === 0) {
      return visibleColumnsMeta;
    }
    const set = new Set(visibleColumnKeys);
    return visibleColumnsMeta.filter(c => set.has(c.key));
  }, [props.enableColumnVisibility, visibleColumnKeys, visibleColumnsMeta]);

  const appliedColumns = useMemo(
    () => appliedVisibleColumnsMeta.map(getColumnConfigs),
    [appliedVisibleColumnsMeta, getColumnConfigs],
  );

  // Pinning: left/right (when enabled)
  const savePinned = (left: string[], right: string[]) => {
    try {
      if (sliceId) {
        localStorage.setItem(`pinnedLeft_${sliceId}`, JSON.stringify(left));
        localStorage.setItem(`pinnedRight_${sliceId}`, JSON.stringify(right));
      }
    } catch {}
    setPinnedLeftKeys(left);
    setPinnedRightKeys(right);
  };
  const isPinnedLeft = useCallback((k: string) => pinnedLeftKeys.includes(k), [pinnedLeftKeys]);
  const isPinnedRight = useCallback((k: string) => pinnedRightKeys.includes(k), [pinnedRightKeys]);

  const widthByKey = useMemo(() => {
    const m = new Map<string, number>();
    try {
      (appliedVisibleColumnsMeta || []).forEach(meta => {
        const k = String(meta.key);
        const w = tableColWidthsByKey?.[k] ?? Number(meta?.config?.columnWidth);
        const num = Number(w);
        m.set(k, Number.isFinite(num) && num > 0 ? num : 120);
      });
    } catch {}
    return m;
  }, [appliedVisibleColumnsMeta, tableColWidthsByKey]);

  // Initialize advanced filters from server ownState or localStorage (persist indicators/chips)
  useEffect(() => {
    try {
      const fromOwn = (serverPaginationData as any)?.advancedFilters;
      if (fromOwn && typeof fromOwn === 'object') {
        if (!isEqual(fromOwn, advancedFilters)) setAdvancedFilters(fromOwn);
        return;
      }
      if (sliceId) {
        const raw = localStorage.getItem(`advancedFilters_${sliceId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !isEqual(parsed, advancedFilters)) {
            setAdvancedFilters(parsed);
          }
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPaginationData, sliceId]);

  const SELECTION_COL_WIDTH = 50;
  const ACTIONS_COL_WIDTH = 28;
  const hasSelectionColumn = Boolean(selection_enabled || include_row_numbers);
  const hasActionsColumn = Boolean(tableActionsConfig?.idColumn && tableActionsConfig?.actions);

  const pinnedLeftOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let acc = hasSelectionColumn ? SELECTION_COL_WIDTH : 0;
    (appliedVisibleColumnsMeta || []).forEach(meta => {
      const k = String(meta.key);
      if (pinnedLeftKeys.includes(k)) {
        offsets.set(k, acc);
        acc += widthByKey.get(k) || 120;
      }
    });
    return offsets;
  }, [appliedVisibleColumnsMeta, pinnedLeftKeys, widthByKey, hasSelectionColumn]);

  const pinnedRightOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let acc = hasActionsColumn ? ACTIONS_COL_WIDTH : 0;
    for (let i = (appliedVisibleColumnsMeta || []).length - 1; i >= 0; i -= 1) {
      const k = String(appliedVisibleColumnsMeta[i].key);
      if (pinnedRightKeys.includes(k)) {
        offsets.set(k, acc);
        acc += widthByKey.get(k) || 120;
      }
    }
    return offsets;
  }, [appliedVisibleColumnsMeta, pinnedRightKeys, widthByKey, hasActionsColumn]);

  // Quick filters (client-side)
  const dataWithQuickFilters = useMemo(() => {
    if (!props.enableQuickFilters || serverPagination) return data;
    const entries = Object.entries(quickFilters).filter(([, v]) => v != null && String(v).trim() !== '');
    if (!entries.length) return data;
    const lowered = entries.map(([k, v]) => [k, String(v).toLowerCase()] as [string, string]);
    return data.filter((row: any) => lowered.every(([k, q]) => String(row[k] ?? '').toLowerCase().includes(q)));
  }, [props.enableQuickFilters, serverPagination, quickFilters, data]);

  // Advanced per-column filters (client-side only)
  type FilterLogic = 'AND' | 'OR';
  type FilterOp =
    | 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with'
    | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'is_null' | 'is_not_null'
    | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  type ColumnFilter = { logic: FilterLogic; conditions: Array<{ op: FilterOp; value?: any; value2?: any }>; };
  const applyAdvancedFilters = useCallback((next: Record<string, ColumnFilter>) => {
    setAdvancedFilters(next);
    if (serverPagination) {
      try {
        setOwnStateIfChanged({
          ...((serverPaginationData as any) || {}),
          currentPage: 0,
          advancedFilters: next,
        });
      } catch {}
    }
    // Persist locally so filters persist across reloads
    try { if (sliceId) localStorage.setItem(`advancedFilters_${sliceId}`, JSON.stringify(next)); } catch {}
  }, [serverPagination, serverPaginationData, setOwnStateIfChanged, setAdvancedFilters, sliceId]);

  const evaluateCondition = (op: FilterOp, cell: any, v?: any, v2?: any) => {
    const str = (x: any) => String(x ?? '').toLowerCase();
    const num = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
    const toDate = (x: any) => {
      const d = new Date(String(x ?? ''));
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    };
    switch (op) {
      case 'contains': return str(cell).includes(str(v));
      case 'not_contains': return !str(cell).includes(str(v));
      case 'equals': return String(cell ?? '') === String(v ?? '');
      case 'not_equals': return String(cell ?? '') !== String(v ?? '');
      case 'starts_with': return str(cell).startsWith(str(v));
      case 'ends_with': return str(cell).endsWith(str(v));
      case 'in': {
        const list = String(v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return list.includes(str(cell));
      }
      case 'not_in': {
        const list = String(v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return !list.includes(str(cell));
      }
      case 'is_empty': return String(cell ?? '') === '';
      case 'is_not_empty': return String(cell ?? '') !== '';
      case 'is_null': return cell === null || cell === undefined;
      case 'is_not_null': return !(cell === null || cell === undefined);
      case 'gt': {
        const a = num(cell); const b = num(v);
        const ad = a == null ? toDate(cell) : null; const bd = b == null ? toDate(v) : null;
        if (a != null && b != null) return a > b;
        if (ad != null && bd != null) return ad > bd;
        return false;
      }
      case 'gte': {
        const a = num(cell); const b = num(v);
        const ad = a == null ? toDate(cell) : null; const bd = b == null ? toDate(v) : null;
        if (a != null && b != null) return a >= b;
        if (ad != null && bd != null) return ad >= bd;
        return false;
      }
      case 'lt': {
        const a = num(cell); const b = num(v);
        const ad = a == null ? toDate(cell) : null; const bd = b == null ? toDate(v) : null;
        if (a != null && b != null) return a < b;
        if (ad != null && bd != null) return ad < bd;
        return false;
      }
      case 'lte': {
        const a = num(cell); const b = num(v);
        const ad = a == null ? toDate(cell) : null; const bd = b == null ? toDate(v) : null;
        if (a != null && b != null) return a <= b;
        if (ad != null && bd != null) return ad <= bd;
        return false;
      }
      case 'between': {
        const a = num(cell); const b1 = num(v); const b2 = num(v2);
        if (a != null && b1 != null && b2 != null) return a >= b1 && a <= b2;
        const ad = a == null ? toDate(cell) : null; const bd1 = toDate(v); const bd2 = toDate(v2);
        if (ad != null && bd1 != null && bd2 != null) return ad >= bd1 && ad <= bd2;
        return false;
      }
      default: return true;
    }
  };

  const dataWithAdvancedFilters = useMemo(() => {
    if (!props.enableAdvancedColumnFilters || serverPagination) return dataWithQuickFilters;
    const entries = Object.entries(advancedFilters).filter(([, cfg]) => cfg && Array.isArray(cfg.conditions) && cfg.conditions.length);
    if (!entries.length) return dataWithQuickFilters;
    return (dataWithQuickFilters as any[]).filter((row: any) => {
      return entries.every(([colKey, cfg]) => {
        const cell = row[colKey];
        const conds: any[] = cfg.conditions || [];
        if (!conds.length) return true;
        // If any condition has an explicit connector, evaluate sequentially using connectors
        const hasConnectors = conds.some((c: any) => c && typeof c.connector === 'string');
        if (hasConnectors) {
          let acc = evaluateCondition(conds[0].op, cell, conds[0].value, conds[0].value2);
          for (let i = 1; i < conds.length; i += 1) {
            const c = conds[i];
            const res = evaluateCondition(c.op, cell, c.value, c.value2);
            const connector = String(c.connector || cfg.logic || 'AND').toUpperCase();
            acc = connector === 'OR' ? (acc || res) : (acc && res);
          }
          return acc;
        }
        // Fallback to group logic for all conditions
        const results = conds.map(c => evaluateCondition(c.op, cell, c.value, c.value2));
        return (cfg.logic || 'AND') === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
    });
  }, [props.enableAdvancedColumnFilters, serverPagination, advancedFilters, dataWithQuickFilters]);

  useEffect(() => {
    const humanize = (s: string) => {
      try {
        const withSpaces = String(s || '').replace(/_/g, ' ');
        return withSpaces
          .split(' ')
          .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
          .join(' ');
      } catch { return s; }
    };
    const labelByKey = new Map<string, string>();
    try {
      visibleColumnsMeta.forEach(meta => {
        labelByKey.set(String(meta.key), String(meta.label));
      });
    } catch {}
    const options = (
      appliedColumns as unknown as ColumnWithLooseAccessor &
        {
          columnKey: string;
          sortType?: string;
        }[]
    )
      .filter(col => col?.sortType === 'alphanumeric')
      .map(column => ({
        value: column.columnKey,
        label: (() => {
          const base = labelByKey.get(String(column.columnKey)) || column.columnKey;
          if (humanizeHeaders && base === column.columnKey) return humanize(column.columnKey);
          return base;
        })(),
      }));

    if (!isEqual(options, searchOptions)) {
      setSearchOptions(options || []);
    }
  }, [appliedColumns, visibleColumnsMeta, humanizeHeaders]);

  const hiddenCount = useMemo(() => {
    if (!props.enableColumnVisibility) return 0;
    const total = visibleColumnsMeta.length;
    const visible = Array.isArray(visibleColumnKeys) && visibleColumnKeys.length ? visibleColumnKeys.length : total;
    return Math.max(0, total - visible);
  }, [props.enableColumnVisibility, visibleColumnsMeta, visibleColumnKeys]);

  const pinnedCount = useMemo(() => {
    if (!props.enablePinColumns) return { left: 0, right: 0, total: 0 };
    const left = pinnedLeftKeys?.length || 0;
    const right = pinnedRightKeys?.length || 0;
    return { left, right, total: left + right };
  }, [props.enablePinColumns, pinnedLeftKeys, pinnedRightKeys]);

  const saveVisibleColumns = (keys: string[] | null) => {
    try {
      if (sliceId) {
        if (keys && keys.length) localStorage.setItem(`visibleColumns_${sliceId}`, JSON.stringify(keys));
        else localStorage.removeItem(`visibleColumns_${sliceId}`);
      }
    } catch {}
    setVisibleColumnKeys(keys);
    try {
      setOwnStateIfChanged({ ...(serverPaginationData as any), visibleColumns: keys || [] });
    } catch {}
  };

  const ColumnVisibilityControl = () => {
    if (!props.enableColumnVisibility) return null;
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => {
      try {
        const labels = document.querySelectorAll('span.dt-col-label');
        labels.forEach(el => {
          const node = el as HTMLElement;
          if (menuOpen) {
            if (!node.dataset.origText) node.dataset.origText = node.textContent || '';
            node.textContent = '\u200B';
          } else if (node.dataset.origText !== undefined) {
            node.textContent = node.dataset.origText;
            delete node.dataset.origText;
          }
        });
      } catch {}
      return () => {
        try {
          const labels = document.querySelectorAll('span.dt-col-label');
          labels.forEach(el => {
            const node = el as HTMLElement;
            if (node.dataset.origText !== undefined) {
              node.textContent = node.dataset.origText || '';
              delete node.dataset.origText;
            }
          });
        } catch {}
      };
    }, [menuOpen]);
    const allKeys = visibleColumnsMeta.map(c => c.key);
    const current = new Set(visibleColumnKeys || allKeys);
    const items = allKeys.map(k => ({ key: k, label: (
      <span>
        <input
          type="checkbox"
          checked={current.has(k)}
          onChange={() => {
            const next = new Set(current);
            if (next.has(k)) next.delete(k); else next.add(k);
            saveVisibleColumns(Array.from(next));
          }}
        />{' '}
        {k}
      </span>
    ) }));
    // Utility actions at top
    if (props.enablePinColumns) {
      items.unshift({ key: '__unpin_all__', label: <span>{t('Unpin all')}</span> } as any);
    }
    if (props.enableColumnResize) {
      items.unshift({ key: '__reset_widths__', label: <span>{t('Reset widths')}</span> } as any);
    }
    items.unshift({ key: '__reset__', label: <span>{t('Reset (show all)')}</span> } as any);
    return (
      <div style={{ display: 'inline-block', position: 'relative' }}>
        <Button size="small" onClick={() => setMenuOpen(prev => !prev)}>
          Columns{hiddenCount ? ` (hidden: ${hiddenCount})` : ''}
        </Button>
        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 4,
              padding: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: 220,
            }}
          >
            {items.map(it => (
              <div key={String((it as any).key)} className="item" role="menuitem" style={{ padding: '4px 6px' }} onClick={() => {
                const key = String((it as any).key);
                if (key === '__reset__') { saveVisibleColumns(null); setMenuOpen(false); return; }
                if (key === '__reset_widths__') { try { if (sliceId) localStorage.removeItem(`columnWidths_${sliceId}`); } catch {}; setTableColWidthsByKey({}); setMenuOpen(false); return; }
                if (key === '__unpin_all__') { savePinned([], []); setMenuOpen(false); return; }
              }}>
                {it.label as any}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSortByChange = useCallback(
    (sortBy: any[]) => {
      if (!serverPagination) return;
      let mappedSortBy = sortBy;
      if (Array.isArray(sortBy) && sortBy.length > 0) {
        const [item] = sortBy;
        const matchingColumn = (columns as any[]).find(
          (col: any) => col?.id === item?.id,
        );
        if (matchingColumn && matchingColumn.columnKey) {
          mappedSortBy = [
            {
              ...item,
              key: matchingColumn.columnKey,
            },
          ];
        }
      }
      const modifiedOwnState = {
        ...((serverPaginationData as any) || {}),
        sortBy: mappedSortBy,
      };
      setOwnStateIfChanged(modifiedOwnState);
    },
    [serverPagination, columns, serverPaginationData, setDataMask],
  );

  const handleSearch = (searchText: string) => {
    const defaultSearchColumn = filteredColumnsMeta?.[0]?.key || '';
    const modifiedOwnState = {
      ...((serverPaginationData as any) || {}),
      searchColumn: (serverPaginationData as any)?.searchColumn || defaultSearchColumn,
      searchText,
      currentPage: 0,
    };
    setOwnStateIfChanged(modifiedOwnState);
  };

  const debouncedSearch = useMemo(() => debounce(handleSearch, 800), [handleSearch]);

  // When columns change, validate server-pagination ownState fields that depend on columns
  useEffect(() => {
    if (!serverPagination) return;
    const own = (serverPaginationData as any) || {};
    const availableKeys = new Set((visibleColumnsMeta || []).map(c => String(c.key)));

    // 1) Clear sortBy if it references a removed column
    let nextSortBy = own.sortBy;
    if (Array.isArray(own.sortBy) && own.sortBy.length > 0) {
      const key = own.sortBy[0]?.key as string | undefined;
      if (key && !availableKeys.has(String(key))) {
        nextSortBy = [];
      }
    }

    // 2) Reset searchColumn if it no longer exists; also clear searchText to avoid invalid filters
    let nextSearchColumn = own.searchColumn;
    let nextSearchText = own.searchText;
    if (own.searchColumn && !availableKeys.has(String(own.searchColumn))) {
      nextSearchColumn = '';
      nextSearchText = '';
    }

    // 3) Drop advancedFilters entries for removed columns
    let nextAdvancedFilters = own.advancedFilters;
    if (own.advancedFilters && typeof own.advancedFilters === 'object') {
      const entries = Object.entries(own.advancedFilters).filter(([col, cfg]: any) => (
        availableKeys.has(String(col)) && cfg && Array.isArray(cfg.conditions) && cfg.conditions.length > 0
      ));
      const rebuilt: Record<string, any> = {};
      entries.forEach(([k, v]) => { rebuilt[String(k)] = v; });
      if (JSON.stringify(rebuilt) !== JSON.stringify(own.advancedFilters)) {
        nextAdvancedFilters = rebuilt;
      }
    }

    // Apply updates if anything changed
    if (
      nextSortBy !== own.sortBy ||
      nextSearchColumn !== own.searchColumn ||
      nextSearchText !== own.searchText ||
      nextAdvancedFilters !== own.advancedFilters
    ) {
      const modifiedOwnState = {
        ...own,
        sortBy: nextSortBy,
        searchColumn: nextSearchColumn,
        searchText: nextSearchText,
        advancedFilters: nextAdvancedFilters,
      };
      setOwnStateIfChanged(modifiedOwnState);
      // Reflect validated advanced filters locally so chips/indicators stay in sync
      try {
        if (!isEqual(nextAdvancedFilters, advancedFilters)) {
          setAdvancedFilters(nextAdvancedFilters || {});
        }
      } catch {}
    }
  }, [serverPagination, visibleColumnsMeta, serverPaginationData, setOwnStateIfChanged]);

  // Do not auto-sync advanced filters; only apply on explicit actions (Search/Reset/Remove)

  const handleChangeSearchCol = (searchCol: string) => {
    // update search column and clear searchText
    const current = (serverPaginationData as any)?.searchColumn;
    if (current === searchCol) return;
    const modifiedOwnState = {
      ...((serverPaginationData as any) || {}),
      searchColumn: searchCol,
      searchText: '',
    };
    setOwnStateIfChanged(modifiedOwnState);
  };

  // Sync initial server_page_length into ownState ONLY once (when not yet set)
  useEffect(() => {
    if (!serverPagination) return;
    const incomingSize = pageSize; // from transformProps (server_page_length)
    const currentSize = (serverPaginationData as any)?.pageSize;
    // Set only if ownState does not yet have a pageSize
    // Use explicit null/undefined check to allow pageSize=0 (show all)
    if (incomingSize !== undefined && incomingSize !== null && (currentSize == null)) {
      setOwnStateIfChanged({
        ...((serverPaginationData as any) || {}),
        currentPage: 0,
        pageSize: incomingSize,
      });
    }
  }, [serverPagination, pageSize, serverPaginationData, setOwnStateIfChanged]);

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
      };
      // Defer to allow input handler to return promptly
      setTimeout(() => setOwnStateIfChanged(modifiedOwnState), 0);
    },
    [serverPaginationData, setOwnStateIfChanged],
  );

  // Removed extraneous effect that referenced undefined flags; server pageSize changes
  // are handled via DataTable state sync and selector changes

  const handleSizeChange = useCallback(
    ({width, height}: { width: number; height: number }) => {
      setTableSize({width, height});
    },
    [],
  );

  useLayoutEffect(() => {
    // After initial load the table should resize only when the new sizes
    // Are not only scrollbar updates, otherwise, the table would twitch
    const scrollBarSize = getScrollBarSize();
    const {width: tableWidth, height: tableHeight} = tableSize;
    // Table is increasing its original size
    if (
      width - tableWidth > scrollBarSize ||
      height - tableHeight > scrollBarSize
    ) {
      handleSizeChange({
        width: width - scrollBarSize,
        height: height - scrollBarSize,
      });
    } else if (
      tableWidth - width > scrollBarSize ||
      tableHeight - height > scrollBarSize
    ) {
      // Table is decreasing its original size
      handleSizeChange({
        width,
        height,
      });
    }
  }, [width, height, handleSizeChange, tableSize]);

  const {width: widthFromState, height: heightFromState} = tableSize;
  // Observe the markdown description for dynamic height changes (e.g., images load)
  useLayoutEffect(() => {
    const compute = () => {
      if (
        show_description &&
        typeof description_markdown === 'string' &&
        description_markdown.trim()
      ) {
        const el = descriptionRef.current;
        if (el) {
          let h = el.getBoundingClientRect().height;
          const styles = window.getComputedStyle(el);
          const mt = parseFloat(styles.marginTop || '0') || 0;
          const mb = parseFloat(styles.marginBottom || '0') || 0;
          h += mt + mb;
          setDescriptionHeight(h);
          return;
        }
      }
      setDescriptionHeight(0);
    };
    compute();
    const el = descriptionRef.current;
    let ro: ResizeObserver | undefined;
    if (el && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => compute());
      ro.observe(el);
    }
    return () => {
      if (ro && el) ro.unobserve(el);
    };
  }, [show_description, description_markdown, widthFromState, heightFromState]);
  const baseColumns = useMemo(() => (props.enableColumnVisibility ? appliedColumns : columns), [props.enableColumnVisibility, appliedColumns, columns]);
  const columnsWithSelection = useMemo(() => {
    let finalColumns = baseColumns;

    // Add selection column if selection is enabled or row numbers requested
    if (selection_enabled || include_row_numbers) {
      const selectionColumn = {
        id: 'selection',
        Header: ({ data: pageData }: { data: D[] }) => {
          // Single-pass computation to reduce allocations and speed up header updates
          const rows = pageData || [];
          let selectedCount = 0;
          for (let i = 0; i < rows.length; i += 1) {
            const id = String(rows[i][row_id_column as keyof D]);
            if (selectedRowsRef.current.has(id)) selectedCount += 1;
          }
          const allVisibleSelected = rows.length > 0 && selectedCount === rows.length;
          const someVisibleSelected = selectedCount > 0 && selectedCount < rows.length;

          return (
            <th
              className=" right-border-only pinned-left"
              role="columnheader button"
              tabIndex={0}
              style={{
                width: 50,
                position: 'sticky',
                left: 0,
                zIndex: 3,
                background: theme.colorBgBase
              }}
              aria-label={t('Selection')}
            >
              <div className="selection-cell">
                {selection_enabled && (
                  <input
                    className={`selectedRows_${sliceId}_check`}
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => {
                      if (el) {
                        el.indeterminate = someVisibleSelected;
                      }
                    }}
                    onChange={() => handleBulkSelectRef.current(pageData)}
                    disabled={selection_mode === 'single'}
                  />
                )}
                {include_row_numbers && (
                  <span className="selection-cell-number">#</span>
                )}
              </div>
            </th>
          );
        },
        Cell: ({row}: { row: Row<D> }) => {
          const rowId = String(row.original[row_id_column as keyof D] ?? row.index);
          const currentPage = serverPaginationData.currentPage || 0; // Get current page index (0-based)
          const pageSize = serverPaginationData.pageSize || 10; // Get current page size
          const rowNumber = currentPage * pageSize + row.index + 1; // Calculate row number
          return (
            <td
              aria-label={t('Selection')}
              role="cell"
              className="right-border-only pinned-left"
              tabIndex={0}
              style={{
                overflow: 'hidden',
                paddingRight: "5px",
                paddingLeft: "5px",
                width: 50,
                position: 'sticky',
                left: 0,
                zIndex: 3,
                background: theme.colorBgBase
              }}
            >
              <div className="selection-cell">
                {selection_enabled && (
                  selection_mode === 'single' ? (
                    <input
                      type="radio"
                      name={`singleSelection_${sliceId}`}
                      className={`selectedRows_${sliceId}_check`}
                      checked={selectedRowsRef.current.has(rowId)}
                      onChange={e => {
                        if (e.target.checked) {
                          const rowData = rowById.get(rowId);
                          if (rowData) {
                            // Single selection: replace selection in one dispatch
                            setSelectedRows(new Map([[rowId, rowData]]));
                          }
                        }
                      }}
                    />

                  ) : (
                    <input
                      type="checkbox"
                      className={`selectedRows_${sliceId}_check`}
                      checked={selectedRowsRef.current.has(rowId)}
                      onChange={e => {
                        const rowData = rowById.get(rowId);
                        if (rowData) {
                          // Multiple selection: use toggle action
                          toggleSelectedRow(rowId, rowData);
                        }
                      }}
                    />
                  )
                )}
                {include_row_numbers && (
                  <span className="selection-cell-number" title={rowNumber.toString()}>{rowNumber}</span>
                )}
              </div>
            </td>
          )
            ;
        },
        width: 40,
      };
      finalColumns = [selectionColumn, ...finalColumns] as any;
    }

    // Add actions column if table actions enabled
    if (tableActionsConfig?.idColumn && tableActionsConfig?.actions) {
      const actionColumn = {
        id: 'actions',
        Header: () => (
          <th
            data-column-name="actions"
            className="pinned-right"
            style={{
              textAlign: 'center',
              width: '28px',
              position: 'sticky',
              right: 0,
              zIndex: 3,
              background: theme.colorBgBase
            }}
            aria-label={t('Actions')}
            title={t('Row actions')}
          >
            <span className="dt-actions-header">{t('Actions')}</span>
          </th>
        ),
        Cell: ({row}: { row: Row<D> }) => {
          return (
            <ActionCell
              rowId={tableActionsConfig.idColumn}
              actions={tableActionsConfig.actions}
              row={row.original}
              chartId={chartId}
              idColumn ={tableActionsConfig.idColumn}
              onActionClick={handleTableAction}
            />
          );
        },
        width: 28,
      };
      finalColumns = [...finalColumns, actionColumn];
    }

    return finalColumns;
  }, [
    baseColumns,
    enable_bulk_actions,
    selection_enabled,
    row_id_column,
    selection_mode,
    tableActionsConfig,
    handleTableAction,
  ]);


  return (
    <>
      {message && (
        <div style={{ position: 'fixed', top: 115, right: 20, zIndex: 1000, maxWidth: 520 }}>{message}</div>
      )}
      <Styles>
        {/* Context menu using Dropdown for consistent styling */}
        {ctxMenu.open && props.enableContextMenuExport && (() => {
          const anchorStyle: React.CSSProperties = {
            position: 'fixed',
            left: Math.max(8, Math.min(ctxMenu.x, window.innerWidth - 16)),
            top: Math.max(8, Math.min(ctxMenu.y, window.innerHeight - 16)),
            zIndex: 10000,
          };
          const menuItems: any[] = [];
          menuItems.push({ key: 'ctx-copy-cell', label: (<span><CopyOutlined style={{ marginRight: 6 }} />{t('Copy cell')}</span>) });
          menuItems.push({ key: 'ctx-copy-row', label: (<span><CopyOutlined style={{ marginRight: 6 }} />{t('Copy row')}</span>) });
          menuItems.push({ type: 'divider' as const, key: '__div1' });
          menuItems.push({ key: 'ctx-autosize-this', label: (<span><ColumnWidthOutlined style={{ marginRight: 6 }} />{t('Autosize This Column')}</span>) });
          menuItems.push({ key: 'ctx-autosize-all', label: (<span><ColumnWidthOutlined style={{ marginRight: 6 }} />{t('Autosize All Columns')}</span>) });
          menuItems.push({ type: 'divider' as const, key: '__div2' });
          menuItems.push({ key: 'ctx-export-csv', label: (<span><FileTextOutlined style={{ marginRight: 6 }} />{t('Export visible to CSV')}</span>) });
          if (props.enableColumnVisibility) {
            const children: any[] = [];
            children.push({ key: 'ctx-choose-__select_all__', label: (<span><CheckSquareOutlined style={{ marginRight: 6 }} />{t('Select All')}</span>) });
            children.push({ key: 'ctx-choose-__deselect_all__', label: (<span><MinusCircleOutlined style={{ marginRight: 6 }} />{t('Deselect All')}</span>) });
            (visibleColumnsMeta || []).forEach(c => {
              const ck = String(c.key);
              const allKeys = visibleColumnsMeta.map(cc => String(cc.key));
              const current = new Set(visibleColumnKeys || allKeys);
              const checked = current.has(ck);
              children.push({ key: `ctx-choose-${ck}`, label: (<span><input type="checkbox" readOnly checked={checked} style={{ marginRight: 6 }} />{String(c.label || ck)}</span>) });
            });
            menuItems.push({ key: 'ctx-columns', label: (<span><CheckSquareOutlined style={{ marginRight: 6 }} />{t('Columns')}</span>), children } as any);
          }
          if (props.enableColumnResize) {
            menuItems.push({ key: 'ctx-reset-widths', label: (<span><ReloadOutlined style={{ marginRight: 6 }} />{t('Reset widths')}</span>) });
          }
          if (props.enablePinColumns) {
            menuItems.push({ key: 'ctx-unpin-all', label: (<span><PushpinOutlined style={{ marginRight: 6 }} />{t('Unpin all')}</span>) });
          }
          const onMenuClick = ({ key, domEvent }: any) => {
            try { domEvent?.stopPropagation?.(); domEvent?.preventDefault?.(); } catch {}
            if (key === 'ctx-copy-cell') {
              try {
                const row: any = ctxMenu.row || {};
                const val = row?.[String(ctxMenu.colKey || '')];
                const text = String(val ?? '');
                if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
                else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(ta); }
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (key === 'ctx-copy-row') {
              try {
                const row: any = ctxMenu.row || {};
                const cols = appliedVisibleColumnsMeta;
                const parts = cols.map(c => {
                  const [, text] = formatColumnValue(c as any, row?.[c.key]);
                  return String(text ?? '');
                });
                const line = parts.join('\t');
                if (navigator.clipboard?.writeText) navigator.clipboard.writeText(line);
                else { const ta = document.createElement('textarea'); ta.value = line; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(ta); }
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (key === 'ctx-autosize-this') {
              try {
                const targetKey = String(ctxMenu.colKey || '');
                if (targetKey) {
                  let maxLen = appliedVisibleColumnsMeta.find(m => String(m.key) === targetKey)?.label?.toString().length || targetKey.length;
                  (data as any[]).slice(0, 200).forEach(r => {
                    const text = String(r?.[targetKey] ?? '');
                    if (text.length > maxLen) maxLen = text.length;
                  });
                  const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                  setTableColWidthsByKey(prev => {
                    const updated = { ...(prev || {}), [targetKey]: widthPx } as Record<string, number>;
                    try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                    return updated;
                  });
                }
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (key === 'ctx-autosize-all') {
              try {
                const updated: Record<string, number> = { ...(tableColWidthsByKey || {}) };
                (appliedVisibleColumnsMeta || []).forEach(m => {
                  let maxLen = String(m.label || m.key).length;
                  (data as any[]).slice(0, 200).forEach(r => {
                    const text = String(r?.[m.key] ?? '');
                    if (text.length > maxLen) maxLen = text.length;
                  });
                  const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                  updated[String(m.key)] = widthPx;
                });
                setTableColWidthsByKey(() => {
                  try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                  return updated;
                });
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (key === 'ctx-export-csv') {
              const rows: any[] = (selectedRows?.size || 0) > 0 ? Array.from(selectedRows.values()) : (dataWithAdvancedFilters as any[]);
              const cols = appliedVisibleColumnsMeta;
              const filename = `table-export-${sliceId || 'chart'}.csv`;

              exportToCsv(rows, cols, filename).catch((err: Error) => {
                console.error('Export to CSV failed:', err);
                addDangerToast(t('Export failed. Please try again.'));
              });

              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (String(key || '').startsWith('ctx-choose-')) {
              const target = String(key).replace('ctx-choose-','');
              const allKeys = visibleColumnsMeta.map(c => String(c.key));
              const current = new Set(visibleColumnKeys || allKeys);
              if (target === '__select_all__') {
                saveVisibleColumns(null);
              } else if (target === '__deselect_all__') {
                addInfoToast(t('At least one column must remain visible'));
              } else {
                const next = new Set(current);
                if (next.has(target)) next.delete(target); else next.add(target);
                if (next.size === 0) addInfoToast(t('At least one column must remain visible'));
                else saveVisibleColumns(Array.from(next));
              }
              // keep menu open for multi-select
              setCtxMenu(prev => ({ ...prev }));
              return;
            }
            if (key === 'ctx-reset-widths') {
              try { if (sliceId) localStorage.removeItem(`columnWidths_${sliceId}`); } catch {}
              setTableColWidthsByKey({});
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
            if (key === 'ctx-unpin-all') {
              savePinned([], []);
              setCtxMenu({ open: false, x: 0, y: 0 });
              return;
            }
          };
          return (
            <ContextMenu
              open
              anchorStyle={anchorStyle}
              items={menuItems}
              onClick={onMenuClick}
              onOpenChange={(v: boolean) => { if (!v) setCtxMenu({ open: false, x: 0, y: 0 }); }}
            />
          );
        })()}
          {/*
            <div className="item" role="menuitem" onClick={() => {
              try {
                const targetKey = String(ctxMenu.colKey || '');
                if (targetKey) {
                  let maxLen = appliedVisibleColumnsMeta.find(m => String(m.key) === targetKey)?.label?.toString().length || targetKey.length;
                  (data as any[]).slice(0, 200).forEach(r => {
                    const text = String(r?.[targetKey] ?? '');
                    if (text.length > maxLen) maxLen = text.length;
                  });
                  const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                  setTableColWidthsByKey(prev => {
                    const updated = { ...(prev || {}), [targetKey]: widthPx } as Record<string, number>;
                    try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                    return updated;
                  });
                }
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
            }}><span><ColumnWidthOutlined style={{ marginRight: 6 }} />{t('Autosize This Column')}</span></div>
            <div className="item" role="menuitem" onClick={() => {
              try {
                const updated: Record<string, number> = { ...(tableColWidthsByKey || {}) };
                (appliedVisibleColumnsMeta || []).forEach(m => {
                  let maxLen = String(m.label || m.key).length;
                  (data as any[]).slice(0, 200).forEach(r => {
                    const text = String(r?.[m.key] ?? '');
                    if (text.length > maxLen) maxLen = text.length;
                  });
                  const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                  updated[String(m.key)] = widthPx;
                });
                setTableColWidthsByKey(() => {
                  try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                  return updated;
                });
              } catch {}
              setCtxMenu({ open: false, x: 0, y: 0 });
            }}><span><ColumnWidthOutlined style={{ marginRight: 6 }} />{t('Autosize All Columns')}</span></div>
            <div className="separator" />
            <div className="item" role="menuitem" onClick={() => {
              const rows: any[] = (selectedRows?.size || 0) > 0 ? Array.from(selectedRows.values()) : (dataWithAdvancedFilters as any[]);
              const cols = appliedVisibleColumnsMeta;
              const filename = `table-export-${sliceId || 'chart'}.csv`;

              exportToCsv(rows, cols, filename).catch((err: Error) => {
                console.error('Export to CSV failed:', err);
                addDangerToast(t('Export failed. Please try again.'));
              });

              setCtxMenu({ open: false, x: 0, y: 0 });
            }}><span>{t('Export visible to CSV')}</span><FileTextOutlined /></div>

            {props.enableColumnVisibility ? (
              <>
                <div className="separator" />
                <div className="item" role="menuitem" style={{ cursor: 'default' }}>
                  <strong>{t('Columns')}</strong>
                </div>
                {visibleColumnsMeta.map(col => {
                  const k = String(col.key);
                  const allKeys = visibleColumnsMeta.map(c => String(c.key));
                  const current = new Set(visibleColumnKeys || allKeys);
                  const checked = current.has(k);
                  return (
                    <div key={`col-${k}`} className="item" role="menuitem" onClick={() => {
                      const next = new Set(current);
                      if (checked) next.delete(k); else next.add(k);
                      if (next.size === 0) {
                        addInfoToast(t('At least one column must remain visible'));
                        return;
                      }
                      saveVisibleColumns(Array.from(next));
                    }}>
                      <span>
                        <input type="checkbox" readOnly checked={checked} style={{ marginRight: 6 }} />
                        {String(col.label || k)}
                      </span>
                    </div>
                  );
                })}
                <div className="item" role="menuitem" onClick={() => { saveVisibleColumns(null); setCtxMenu({ open: false, x: 0, y: 0 }); }}>
                  <span>{t('Select all columns')}</span>
                </div>
                <div className="item" role="menuitem" onClick={() => { addInfoToast(t('At least one column must remain visible')); }}>
                  <span>{t('Deselect all columns')}</span>
                </div>
              </>
            ) : null}
            {props.enableColumnResize ? (
              <div className="item" role="menuitem" onClick={() => {
                try { if (sliceId) localStorage.removeItem(`columnWidths_${sliceId}`); } catch {}
                setTableColWidthsByKey({});
                setCtxMenu({ open: false, x: 0, y: 0 });
              }}>
                <span>{t('Reset widths')}</span>
              </div>
            ) : null}
            {props.enablePinColumns ? (
              <div className="item" role="menuitem" onClick={() => { savePinned([], []); setCtxMenu({ open: false, x: 0, y: 0 }); }}>
                <span>{t('Unpin all')}</span>
              </div>
            ) : null}
          </div>
          */}
        
        {/* Context menu managed by Dropdown; no manual overlay */}
        {show_description && typeof description_markdown === 'string' && description_markdown.trim() ? (
          <div className="dt-description" ref={descriptionRef}>
            <SafeMarkdown source={description_markdown} />
          </div>
        ) : null}
        {/* Column visibility label moved next to search via renderRightControls */}
          <DataTable<D>
          columns={columnsWithSelection}
          data={dataWithAdvancedFilters}
          rowCount={rowCount}
          tableClassName="table table-striped table-condensed"
          pageSize={pageSize}
          serverPaginationData={serverPaginationData}
          pageSizeOptions={pageSizeOptions}
          width={widthFromState}
          height={Math.max(140, heightFromState - (descriptionHeight || 0))}
          serverPagination={serverPagination}
          onServerPaginationChange={handleServerPaginationChange}
          onColumnOrderChange={() => toggleColumnOrder()}
          // 9 page items in > 340px works well even for 100+ pages
          maxPageItemCount={width > 340 ? 9 : 7}
          noResults={getNoResultsMessage}
          searchInput={includeSearch && SearchInput}
          manualSearch={serverPagination}
          onSearchChange={debouncedSearch}
          initialSearchText={(serverPaginationData as any)?.searchText || ''}
          sortByFromParent={(serverPaginationData as any)?.sortBy || []}
          searchOptions={searchOptions}
          onSearchColChange={handleChangeSearchCol}
          handleSortByChange={handleSortByChange}
          showSearchColumnSelector={showSearchColumnSelector}
          selectPageSize={pageSize !== null && SelectPageSize}
          // Advanced filters toggle removed
          renderRightControls={() => (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
              {/* Filters tag with total active conditions; closing clears staged filters (requires Search to apply) */}
              {(() => {
                const totalFilters = (() => {
                  try {
                    return Object.values(advancedFilters || {}).reduce((acc: number, cfg: any) => acc + (Array.isArray(cfg?.conditions) ? cfg.conditions.length : 0), 0);
                  } catch { return 0; }
                })();
                const tagStyle = totalFilters > 0
                  ? ({ backgroundColor: theme.colorPrimary, color: theme.colorBgContainer, border: 'none' } as React.CSSProperties)
                  : undefined;
                const label = totalFilters > 0 ? `Filters (${totalFilters})` : 'Filters';
                // Build tooltip content listing all filters
                const lbk = new Map<string, string>();
                try {
                  (visibleColumnsMeta || []).forEach((m: any) => lbk.set(String(m.key), String(m.label || m.key)));
                  (appliedVisibleColumnsMeta || []).forEach((m: any) => lbk.set(String(m.key), String(m.label || m.key)));
                } catch {}
                const entries = Object.entries(advancedFilters || {}).filter(([, cfg]: any) => cfg && Array.isArray((cfg as any).conditions) && (cfg as any).conditions.length > 0);
                const tooltipContent = entries.length
                  ? (
                    <div style={{ maxWidth: 420 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('Active filters') as any}</div>
                      {entries.map(([colKey, cfg]: any) => (
                        <div key={`af-tt-${String(colKey)}`} style={{ marginBottom: 4 }}>
                          <div style={{ fontWeight: 600 }}>{lbk.get(String(colKey)) || String(colKey)}</div>
                          <div>
                            {((cfg?.conditions || []) as any[]).map((c: any, idx: number) => (
                              <div key={`c-tt-${idx}`}>
                                {idx > 0 ? (<span style={{ color: theme.colorTextTertiary, marginRight: 4 }}>{String((c && c.connector) || (cfg?.logic || 'AND'))}</span>) : null}
                                <span style={{ fontWeight: 600, marginRight: 4 }}>{String(c?.op)}</span>
                                {c?.value !== undefined && <span style={{ marginRight: 4 }}>{String(c?.value)}</span>}
                                {c?.value2 !== undefined && <span>{` - ${String(c?.value2)}`}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (t('No filters') as any);
                // Detect if there are staged (unapplied) filters
                const appliedFilters = serverPagination ? (serverPaginationData as any)?.advancedFilters : undefined;
                // Only show Apply Filters if there are actual filters AND they differ from applied filters
                const hasStagedFilters = serverPagination && totalFilters > 0 && !isEqual(advancedFilters, appliedFilters);
                const applyButtonStyle = {
                  backgroundColor: theme.colorPrimary,
                  color: theme.colorBgContainer,
                  border: 'none',
                  cursor: 'pointer',
                } as React.CSSProperties;
                return (
                  <>
                    <Tooltip title={tooltipContent}>
                      <Tag
                        style={tagStyle}
                        closable={totalFilters > 0}
                        onClose={(e: any) => {
                          try { e?.preventDefault?.(); } catch {};
                          // Use applyAdvancedFilters to ensure backend is called for server pagination
                          applyAdvancedFilters({});
                        }}
                        title={t('Clear all filters (staged)') as any}
                      >
                        {label}
                      </Tag>
                    </Tooltip>
                    {hasStagedFilters && (
                      <Tooltip title={t('Apply staged filters to refresh data') as any}>
                        <Tag
                          style={applyButtonStyle}
                          onClick={() => applyAdvancedFilters(advancedFilters)}
                        >
                          {t('Apply Filters')}
                        </Tag>
                      </Tooltip>
                    )}
                  </>
                );
              })()}
              {/* Column visibility label with count; click to reset hidden columns */}
              {props.enableColumnVisibility ? (() => {
                const all = (visibleColumnsMeta || []).map((c: any) => ({ key: String(c.key), label: String(c.label || c.key) }));
                const currentSet = new Set((visibleColumnKeys && visibleColumnKeys.length ? visibleColumnKeys : all.map(a => a.key)).map(String));
                const hiddenLabels = all.filter(a => !currentSet.has(a.key)).map(a => a.label);
                const MAX_LIST = 20;
                const tooltipContent = hiddenLabels.length
                  ? (
                    <div style={{ maxWidth: 360 }}>
                      {hiddenLabels.slice(0, MAX_LIST).map((lbl, i) => (
                        <div key={`hidden-col-${i}`}>{String(lbl)}</div>
                      ))}
                      {hiddenLabels.length > MAX_LIST ? (
                        <div style={{ color: theme.colorTextTertiary }}>{`+${hiddenLabels.length - MAX_LIST} more`}</div>
                      ) : null}
                    </div>
                  )
                  : (t('No hidden columns') as any);
                return (
                  <Tooltip title={tooltipContent}>
                    <Tag
                      style={hiddenCount > 0 ? ({ backgroundColor: theme.colorPrimary, color: theme.colorBgContainer, border: 'none' } as React.CSSProperties) : undefined}
                      closable
                      onClose={(e: any) => { try { e?.preventDefault?.(); } catch {}; saveVisibleColumns(null); }}
                      title={t('Reset hidden columns') as any}
                    >
                      {hiddenCount > 0
                        ? t('Columns (hidden: %s)', String(hiddenCount)) as any
                        : t('Columns') as any}
                    </Tag>
                  </Tooltip>
                );
              })() : null}
              {/* Pinned columns label with count; click to unpin all */}
              {props.enablePinColumns && pinnedCount.total > 0 ? (() => {
                const leftLabels: string[] = [];
                const rightLabels: string[] = [];
                try {
                  const labelByKey = new Map<string, string>();
                  (visibleColumnsMeta || []).forEach((c: any) => labelByKey.set(String(c.key), String(c.label || c.key)));
                  (appliedVisibleColumnsMeta || []).forEach((c: any) => labelByKey.set(String(c.key), String(c.label || c.key)));
                  pinnedLeftKeys.forEach((k: string) => leftLabels.push(labelByKey.get(k) || k));
                  pinnedRightKeys.forEach((k: string) => rightLabels.push(labelByKey.get(k) || k));
                } catch {}
                const MAX_LIST = 20;
                const tooltipContent = (
                  <div style={{ maxWidth: 360 }}>
                    {leftLabels.length > 0 ? (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('Pinned Left') as any}</div>
                        {leftLabels.slice(0, MAX_LIST).map((lbl, i) => (
                          <div key={`pinned-left-${i}`}>{String(lbl)}</div>
                        ))}
                        {leftLabels.length > MAX_LIST ? (
                          <div style={{ color: theme.colorTextTertiary }}>{`+${leftLabels.length - MAX_LIST} more`}</div>
                        ) : null}
                      </>
                    ) : null}
                    {rightLabels.length > 0 ? (
                      <>
                        <div style={{ fontWeight: 600, marginBottom: 4, marginTop: leftLabels.length > 0 ? 8 : 0 }}>{t('Pinned Right') as any}</div>
                        {rightLabels.slice(0, MAX_LIST).map((lbl, i) => (
                          <div key={`pinned-right-${i}`}>{String(lbl)}</div>
                        ))}
                        {rightLabels.length > MAX_LIST ? (
                          <div style={{ color: theme.colorTextTertiary }}>{`+${rightLabels.length - MAX_LIST} more`}</div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
                return (
                  <Tooltip title={tooltipContent}>
                    <Tag
                      style={{ backgroundColor: theme.colorPrimary, color: theme.colorBgContainer, border: 'none' } as React.CSSProperties}
                      closable
                      onClose={(e: any) => { try { e?.preventDefault?.(); } catch {}; savePinned([], []); }}
                      title={t('Unpin all columns') as any}
                    >
                      {pinnedCount.left > 0 && pinnedCount.right > 0
                        ? t('Pinned (L: %s, R: %s)', String(pinnedCount.left), String(pinnedCount.right)) as any
                        : pinnedCount.left > 0
                        ? t('Pinned Left (%s)', String(pinnedCount.left)) as any
                        : t('Pinned Right (%s)', String(pinnedCount.right)) as any}
                    </Tag>
                  </Tooltip>
                );
              })() : null}
            </span>
          )}
          // not in use in Superset, but needed for unit tests
          sticky={sticky}
          renderGroupingHeaders={
            !isEmpty(groupHeaderColumns) ? renderGroupingHeaders : undefined
          }
          renderTimeComparisonDropdown={
            isUsingTimeComparison ? renderTimeComparisonDropdown : undefined
          }
          selectedRows={selectedRows}
          enableColumnResize={props.enableColumnResize}
          enableBulkActions={enable_bulk_actions}
          bulkActions={actions}
          enableTableActions={enable_table_actions}
          includeRowNumber={include_row_numbers}
          tableActionsIdColumn={row_id_column}
          hideTableActionsIdColumn={hide_row_id_column}
          bulkActionLabel={bulk_action_label}
          tableActions={table_actions}
          onBulkActionClick={handleTableAction}
          onClearSelection={handleClearSelection}
          showSplitInSliceHeader={show_split_buttons_in_slice_header}
          retainSelectionAccrossNavigation={retainSelectionAcrossNavigation}
          chartId={props?.slice_id}
          onInvertSelection={undefined}
        />
      </Styles>
    </>
  );
}

// Wrap the component with ErrorBoundary for graceful error handling
export default function TableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
  },
) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error for monitoring/debugging
        console.error('TableChart error:', error, errorInfo);

        // Could also send to error tracking service here
        // e.g., Sentry.captureException(error, { contexts: { react: errorInfo } });
      }}
    >
      <TableChartInner {...props} />
    </ErrorBoundary>
  );
}
