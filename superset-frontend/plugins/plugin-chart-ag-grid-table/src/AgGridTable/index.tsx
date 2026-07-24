/* eslint-disable camelcase */
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
  useCallback,
  useMemo,
  useRef,
  memo,
  FunctionComponent,
  useState,
  ChangeEvent,
  useEffect,
  type RefObject,
} from 'react';

import { Constants, ThemedAgGridReact } from '@superset-ui/core/components';
import {
  AgGridReact,
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  type ColumnState,
  ModuleRegistry,
  GridReadyEvent,
  GridState,
  CellClickedEvent,
  CellContextMenuEvent,
  CellKeyDownEvent,
  SelectionChangedEvent,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { t } from '@apache-superset/core/translation';
import {
  AgGridChartState,
  DataRecordValue,
  DataRecord,
  JsonObject,
} from '@superset-ui/core';
import { SearchOutlined } from '@ant-design/icons';
import { debounce, isEqual } from 'lodash-es';
import Pagination from './components/Pagination';
import SearchSelectDropdown from './components/SearchSelectDropdown';
import { SearchOption, SortByItem } from '../types';
import getInitialSortState, { shouldSort } from '../utils/getInitialSortState';
import getInitialFilterModel from '../utils/getInitialFilterModel';
import reconcileColumnState from '../utils/reconcileColumnState';
import getColumnStateSignature from '../utils/getColumnStateSignature';
import { PAGE_SIZE_OPTIONS, ROW_NUMBER_COL_ID } from '../consts';
import { getCompleteFilterState } from '../utils/filterStateManager';
import { copyCellValueOnKeyDown } from '../utils/copyCellValue';
import type { ClientViewSnapshot } from '../utils/externalAPIs';

export interface AgGridState extends Partial<GridState> {
  timestamp?: number;
  hasChanges?: boolean;
}

// AgGridChartState with optional metadata fields for state change events
export type AgGridChartStateWithMetadata = Partial<AgGridChartState> & {
  timestamp?: number;
  hasChanges?: boolean;
};

export interface AgGridTableProps {
  gridTheme?: string;
  isDarkMode?: boolean;
  updateInterval?: number;
  data?: any[];
  onGridReady?: (params: GridReadyEvent) => void;
  colDefsFromProps: any[];
  includeSearch: boolean;
  allowRearrangeColumns: boolean;
  pagination: boolean;
  pageSize: number;
  serverPagination?: boolean;
  rowCount?: number;
  onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
  serverPaginationData: JsonObject;
  onServerPageSizeChange: (pageSize: number) => void;
  searchOptions: SearchOption[];
  onSearchColChange: (searchCol: string) => void;
  onSearchChange: (searchText: string) => void;
  onSortChange: (sortBy: SortByItem[]) => void;
  id: number;
  percentMetrics: string[];
  serverPageLength: number;
  hasServerPageLengthChanged: boolean;
  handleCellClicked: (event: CellClickedEvent) => void;
  handleCellContextMenu?: (event: CellContextMenuEvent) => void;
  handleSelectionChanged: (event: SelectionChangedEvent) => void;
  filters?: Record<string, DataRecordValue[]> | null;
  isActiveFilterValue?: (key: string, val: DataRecordValue) => boolean;
  renderTimeComparisonDropdown: () => JSX.Element | null;
  cleanedTotals: DataRecord;
  showTotals: boolean;
  width: number;
  onColumnStateChange?: (state: AgGridChartStateWithMetadata) => void;
  onFilterChanged?: (filterModel: Record<string, any>) => void;
  metricColumns?: string[];
  gridRef?: RefObject<AgGridReact>;
  chartState?: AgGridChartState;
  onClientViewChange?: (snapshot: ClientViewSnapshot) => void;
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const isSearchFocused = new Map<string, boolean>();

const AgGridDataTable: FunctionComponent<AgGridTableProps> = memo(
  ({
    data = [],
    colDefsFromProps,
    includeSearch,
    allowRearrangeColumns,
    pagination,
    pageSize,
    serverPagination,
    rowCount,
    onServerPaginationChange,
    serverPaginationData,
    onServerPageSizeChange,
    searchOptions,
    onSearchColChange,
    onSearchChange,
    onSortChange,
    id,
    percentMetrics,
    serverPageLength,
    hasServerPageLengthChanged,
    handleCellClicked,
    handleCellContextMenu,
    handleSelectionChanged,
    filters,
    isActiveFilterValue,
    renderTimeComparisonDropdown,
    cleanedTotals,
    showTotals,
    width,
    onColumnStateChange,
    onFilterChanged,
    metricColumns = [],
    chartState,
    onClientViewChange,
  }) => {
    const gridRef = useRef<AgGridReact>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowData = useMemo(() => data, [data]);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastCapturedStateRef = useRef<string | null>(null);
    const hasCapturedInitialGridStateRef = useRef(false);
    const filterOperationVersionRef = useRef(0);

    const searchId = `search-${id}`;

    const initialFilterModel = getInitialFilterModel(
      chartState,
      serverPaginationData,
      serverPagination,
    );

    const gridInitialState: GridState = {
      ...(serverPagination && {
        sort: {
          sortModel: getInitialSortState(serverPaginationData?.sortBy || []),
        },
      }),
      ...(initialFilterModel && {
        filter: {
          filterModel: initialFilterModel,
        },
      }),
    };

    const defaultColDef = useMemo<ColDef>(
      () => ({
        filter: true,
        sortable: true,
        resizable: true,
        minWidth: 100,
      }),
      [],
    );

    // Fills the full height allotted by the chart container (StyledChartContainer);
    // the search/time-comparison controls and pagination bar take their natural
    // height and the grid flexes into whatever space remains (see gridFlexStyles),
    // instead of a hardcoded pixel height that drifts from the actual chrome height.
    const containerStyles = useMemo(
      () => ({
        height: '100%',
        width,
        display: 'flex',
        flexDirection: 'column' as const,
      }),
      [width],
    );

    const gridFlexStyles = useMemo(
      () => ({
        flex: '1 1 auto',
        minHeight: 0,
      }),
      [],
    );

    const [quickFilterText, setQuickFilterText] = useState<string>();
    const [searchValue, setSearchValue] = useState(
      serverPaginationData?.searchText || '',
    );

    const debouncedSearch = useMemo(
      () =>
        debounce((value: string) => {
          onSearchChange(value);
        }, 500),
      [onSearchChange],
    );

    useEffect(
      () =>
        // Cleanup debounced search
        () => {
          debouncedSearch.cancel();
        },
      [debouncedSearch],
    );

    useEffect(() => {
      if (
        serverPagination &&
        isSearchFocused.get(searchId) &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current?.focus();
      }
    }, [searchValue, serverPagination, searchId]);

    const handleSearchFocus = useCallback(() => {
      isSearchFocused.set(searchId, true);
    }, [searchId]);

    const handleSearchBlur = useCallback(() => {
      isSearchFocused.set(searchId, false);
    }, [searchId]);

    // Copy the focused cell's value on Ctrl/Cmd+C. Needed because cell text is
    // no longer natively selectable (see enableCellTextSelection below) and the
    // Enterprise clipboard module is not registered (#106389).
    const handleCellKeyDown = useCallback((event: CellKeyDownEvent) => {
      copyCellValueOnKeyDown(event);
    }, []);

    const onFilterTextBoxChanged = useCallback(
      ({ target: { value } }: ChangeEvent<HTMLInputElement>) => {
        if (serverPagination) {
          setSearchValue(value);
          debouncedSearch(value);
        } else {
          setQuickFilterText(value);
        }
      },
      [serverPagination, debouncedSearch, searchId],
    );

    const handleColSort = (colId: string, sortDir: string | null) => {
      const isSortable = shouldSort({
        colId,
        sortDir,
        percentMetrics,
        serverPagination: !!serverPagination,
        gridInitialState,
      });

      if (!isSortable) return;

      if (serverPagination && gridRef.current?.api && onColumnStateChange) {
        const { api } = gridRef.current;

        if (sortDir == null) {
          api.applyColumnState({
            defaultState: { sort: null },
          });
        } else {
          api.applyColumnState({
            defaultState: { sort: null },
            state: [{ colId, sort: sortDir as 'asc' | 'desc', sortIndex: 0 }],
          });
        }

        const columnState = api.getColumnState?.() || [];
        const filterModel = api.getFilterModel?.() || {};
        const sortModel = sortDir
          ? [{ colId, sort: sortDir as 'asc' | 'desc', sortIndex: 0 }]
          : [];

        onColumnStateChange({
          columnState,
          sortModel,
          filterModel,
          timestamp: Date.now(),
        });
      }

      if (sortDir == null) {
        onSortChange([]);
        return;
      }

      onSortChange([
        {
          id: colId,
          key: colId,
          desc: sortDir === 'desc',
        },
      ]);
    };

    const handleColumnHeaderClick = useCallback(
      (params: { column?: { colId?: string; sort?: string | null } }) => {
        const colId = params?.column?.colId;
        const sortDir = params?.column?.sort;
        if (colId && sortDir !== undefined) {
          handleColSort(colId, sortDir);
        }
      },
      [serverPagination, gridInitialState, percentMetrics, onSortChange],
    );

    const handleGridStateChange = useCallback(
      debounce(() => {
        if (onColumnStateChange && gridRef.current?.api) {
          try {
            const { api } = gridRef.current;

            const columnState = api.getColumnState ? api.getColumnState() : [];

            const filterModel = api.getFilterModel ? api.getFilterModel() : {};

            const sortModel = columnState
              .filter(col => col.sort)
              .map(col => ({
                colId: col.colId,
                sort: col.sort as 'asc' | 'desc',
                sortIndex: col.sortIndex || 0,
              }))
              .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));

            const stateToSave = {
              columnState,
              sortModel,
              filterModel,
              timestamp: Date.now(),
            };

            const stateHash = getColumnStateSignature(
              columnState,
              sortModel,
              filterModel,
            );

            // AG Grid fires onStateUpdated once as it applies the initial
            // column/sort/filter state on mount, before any user
            // interaction. That first event just reflects the state the grid
            // was initialized with (chartState/gridInitialState) - not a
            // user-driven change - so it's skipped rather than compared
            // against `lastCapturedStateRef`, which is always null right
            // after mount. Persisting it anyway would write a chart-state
            // change on every mount, which can cascade into a
            // remount/onStateUpdated loop.
            if (!hasCapturedInitialGridStateRef.current) {
              hasCapturedInitialGridStateRef.current = true;
              lastCapturedStateRef.current = stateHash;
              return;
            }

            if (stateHash !== lastCapturedStateRef.current) {
              lastCapturedStateRef.current = stateHash;

              onColumnStateChange(stateToSave);
            }
          } catch (error) {
            console.warn('Error capturing AG Grid state:', error);
          }
        }
      }, Constants.SLOW_DEBOUNCE),
      [onColumnStateChange],
    );

    useEffect(
      () =>
        // Cleanup debounced grid-state capture
        () => {
          handleGridStateChange.cancel();
        },
      [handleGridStateChange],
    );

    const handleFilterChanged = useCallback(async () => {
      filterOperationVersionRef.current += 1;
      const currentVersion = filterOperationVersionRef.current;

      const completeFilterState = await getCompleteFilterState(
        gridRef,
        metricColumns,
      );

      // Skip stale operations from rapid filter changes
      if (currentVersion !== filterOperationVersionRef.current) {
        return;
      }

      // Reject invalid filter states (e.g., text filter on numeric column)
      if (completeFilterState.originalFilterModel) {
        const filterModel = completeFilterState.originalFilterModel;
        const hasInvalidFilterType = Object.entries(filterModel).some(
          ([colId, filter]: [string, any]) => {
            if (
              filter?.filterType === 'text' &&
              metricColumns?.includes(colId)
            ) {
              return true;
            }
            return false;
          },
        );

        if (hasInvalidFilterType) {
          return;
        }
      }

      if (
        !isEqual(
          serverPaginationData?.agGridFilterModel,
          completeFilterState.originalFilterModel,
        )
      ) {
        if (onFilterChanged) {
          onFilterChanged(completeFilterState);
        }
      }
    }, [
      onFilterChanged,
      metricColumns,
      serverPaginationData?.agGridFilterModel,
    ]);

    // Captures the "current view" (post-filter/sort, all rows across all
    // pages) for the "Export Current View" menu, mirroring Table V1's
    // clientView snapshot. Client-side mode only: in server pagination mode
    // the grid only ever holds a single page's rows, so a client-derived
    // snapshot can't represent the full filtered/sorted result and export
    // falls back to a fresh backend query instead (see useExploreAdditionalActionsMenu).
    const lastClientViewSignatureRef = useRef<string | null>(null);
    // AG Grid fires onModelUpdated once as it applies the initial row data on
    // mount, before any user interaction. That first event reflects data the
    // chart already has - not a view change worth persisting - so it's
    // skipped rather than compared against `lastClientViewSignatureRef`,
    // which is always null right after mount. Persisting it anyway would
    // write an ownState change on every mount, which (if the dashboard
    // decides that warrants a requery) unmounts/remounts this component and
    // re-fires onModelUpdated, looping forever.
    const hasCapturedInitialModelRef = useRef(false);
    // Debounced (like handleGridStateChange below) because the full
    // filtered+sorted traversal is O(n) and onModelUpdated can fire rapidly
    // in succession (e.g. while typing into a quick filter); only the
    // trailing update needs to recompute the snapshot.
    const handleModelUpdated = useCallback(
      debounce(() => {
        if (serverPagination || !onClientViewChange || !gridRef.current?.api) {
          return;
        }
        const { api } = gridRef.current;
        const displayedColumns = api
          .getAllDisplayedColumns()
          .filter(column => column.getColId() !== ROW_NUMBER_COL_ID);
        const columns = displayedColumns.map(column => ({
          key: column.getColId(),
          label: column.getColDef().headerName || column.getColId(),
        }));

        const rows: Record<string, unknown>[] = [];
        api.forEachNodeAfterFilterAndSort(node => {
          if (node.data) {
            rows.push(node.data);
          }
        });

        // Without a getRowId callback, AG Grid's node ids are purely
        // positional and reset to 0..n-1 on every setRowData call, so they
        // don't identify a row's content across a data refresh — hashing
        // the actual filtered+sorted row content (which this function
        // already has to visit to build `rows`) is what actually detects
        // both value changes (e.g. a refresh with the same row count) and
        // order changes (e.g. a pure sort), not just count/column changes.
        const signature = `${JSON.stringify(rows)}|${columns.map(c => c.key).join(',')}`;

        if (!hasCapturedInitialModelRef.current) {
          hasCapturedInitialModelRef.current = true;
          lastClientViewSignatureRef.current = signature;
          return;
        }

        if (signature === lastClientViewSignatureRef.current) {
          return;
        }
        lastClientViewSignatureRef.current = signature;
        onClientViewChange({ rows, columns, count: rows.length });
      }, Constants.SLOW_DEBOUNCE),
      [serverPagination, onClientViewChange],
    );

    useEffect(
      () =>
        // Cleanup debounced client-view snapshot capture
        () => {
          handleModelUpdated.cancel();
        },
      [handleModelUpdated],
    );

    useEffect(() => {
      if (
        hasServerPageLengthChanged &&
        serverPaginationData?.pageSize &&
        !isEqual(serverPaginationData?.pageSize, serverPageLength)
      ) {
        // Explore editor handling
        // if user updates server page length from control panel &
        // if server page length & ownState pageSize are not equal
        // they must be resynced
        onServerPageSizeChange(serverPageLength);
      }
    }, [hasServerPageLengthChanged]);

    useEffect(() => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    }, [width]);

    // Row highlighting must reflect the active cross filter regardless of how
    // it was applied (cell click, context menu, or an external dashboard
    // filter), so it survives re-renders and server-side re-queries rather
    // than only reflecting whichever handler last called setSelected.
    useEffect(() => {
      const api = gridRef.current?.api;
      if (!api) return;

      if (!filters || Object.keys(filters).length === 0) {
        if (api.getSelectedRows().length) {
          api.deselectAll();
        }
        return;
      }

      if (!isActiveFilterValue) return;

      api.forEachNode(node => {
        const matches = Object.keys(filters).some(key =>
          isActiveFilterValue(key, node.data?.[key] as DataRecordValue),
        );
        if (node.isSelected() !== matches) {
          node.setSelected(matches, false, 'api');
        }
      });
    }, [filters, isActiveFilterValue, rowData]);

    const onGridReady = (params: GridReadyEvent) => {
      // This will make columns fill the grid width
      params.api.sizeColumnsToFit();

      // Restore saved column state from permalink if available
      // Note: filterModel is now handled via gridInitialState for better performance
      if (chartState?.columnState && params.api) {
        try {
          const reconciledColumnState = reconcileColumnState(
            chartState.columnState as ColumnState[],
            colDefsFromProps as ColDef[],
          );

          if (reconciledColumnState) {
            params.api.applyColumnState?.({
              state: reconciledColumnState.columnState,
              applyOrder: reconciledColumnState.applyOrder,
            });
          }
        } catch {
          // Silently fail if state restoration fails
        }
      }
    };

    return (
      <div style={containerStyles} ref={containerRef}>
        <div className="dropdown-controls-container">
          {renderTimeComparisonDropdown && (
            <div className="time-comparison-dropdown">
              {renderTimeComparisonDropdown()}
            </div>
          )}
          {includeSearch && (
            <div className="search-container">
              {serverPagination && searchOptions?.length > 0 && (
                <div className="search-by-text-container">
                  <span className="search-by-text"> {t('Search by')}:</span>
                  <SearchSelectDropdown
                    onChange={onSearchColChange}
                    searchOptions={searchOptions}
                    value={serverPaginationData?.searchColumn || ''}
                  />
                </div>
              )}
              <div className="input-wrapper">
                <div className="input-container">
                  <SearchOutlined />
                  <input
                    ref={inputRef}
                    value={
                      serverPagination ? searchValue : quickFilterText || ''
                    }
                    type="text"
                    id="filter-text-box"
                    placeholder={t('Search')}
                    onInput={onFilterTextBoxChanged}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={gridFlexStyles}>
          <ThemedAgGridReact
            ref={gridRef}
            onGridReady={onGridReady}
            className="ag-container"
            rowData={rowData}
            headerHeight={36}
            rowHeight={30}
            columnDefs={colDefsFromProps}
            defaultColDef={defaultColDef}
            onColumnGroupOpened={params => params.api.sizeColumnsToFit()}
            rowSelection="multiple"
            animateRows
            onCellClicked={handleCellClicked}
            onCellContextMenu={handleCellContextMenu}
            onCellKeyDown={handleCellKeyDown}
            onSelectionChanged={handleSelectionChanged}
            onFilterChanged={handleFilterChanged}
            onModelUpdated={handleModelUpdated}
            onStateUpdated={handleGridStateChange}
            initialState={gridInitialState}
            maintainColumnOrder
            suppressAggFuncInHeader
            // Clicking a cell should select (focus) the cell rather than select
            // its text content (#106389). enableCellTextSelection forces browser
            // text selection on click, which suppresses the cell-focus behavior.
            // Because the Enterprise clipboard module isn't registered, native
            // text selection was the only way to copy a value, so onCellKeyDown
            // (above) restores Ctrl/Cmd+C copy for the focused cell. Full
            // multi-cell range selection still requires AG Grid Enterprise, which
            // is not available in the Community build used here.
            enableCellTextSelection={false}
            quickFilterText={serverPagination ? '' : quickFilterText}
            suppressMovableColumns={!allowRearrangeColumns}
            pagination={pagination}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={PAGE_SIZE_OPTIONS}
            suppressDragLeaveHidesColumns
            pinnedBottomRowData={showTotals ? [cleanedTotals] : undefined}
            tooltipShowDelay={500}
            localeText={{
              // Pagination controls
              next: t('Next'),
              previous: t('Previous'),
              page: t('Page'),
              more: t('More'),
              to: t('to'),
              of: t('of'),
              first: t('First'),
              last: t('Last'),
              loadingOoo: t('Loading...'),
              // Set Filter
              selectAll: t('Select All'),
              searchOoo: t('Search...'),
              blanks: t('Blanks'),
              // Filter operations
              filterOoo: t('Filter'),
              applyFilter: t('Apply Filter'),
              equals: t('Equals'),
              notEqual: t('Not Equal'),
              lessThan: t('Less Than'),
              greaterThan: t('Greater Than'),
              lessThanOrEqual: t('Less Than or Equal'),
              greaterThanOrEqual: t('Greater Than or Equal'),
              inRange: t('In Range'),
              contains: t('Contains'),
              notContains: t('Not Contains'),
              startsWith: t('Starts With'),
              endsWith: t('Ends With'),
              // Logical conditions
              andCondition: t('AND'),
              orCondition: t('OR'),
              // Panel and group labels
              group: t('Group'),
              columns: t('Columns'),
              filters: t('Filters'),
              valueColumns: t('Value Columns'),
              pivotMode: t('Pivot Mode'),
              groups: t('Groups'),
              values: t('Values'),
              pivots: t('Pivots'),
              toolPanelButton: t('Tool Panel'),
              // Enterprise menu items
              pinColumn: t('Pin Column'),
              valueAggregation: t('Value Aggregation'),
              autosizeThiscolumn: t('Autosize This Column'),
              autosizeAllColumns: t('Autosize All Columns'),
              groupBy: t('Group By'),
              ungroupBy: t('Ungroup By'),
              resetColumns: t('Reset Columns'),
              expandAll: t('Expand All'),
              collapseAll: t('Collapse All'),
              toolPanel: t('Tool Panel'),
              export: t('Export'),
              csvExport: t('CSV Export'),
              excelExport: t('Excel Export'),
              excelXmlExport: t('Excel XML Export'),
              // Aggregation functions
              sum: t('Sum'),
              min: t('Min'),
              max: t('Max'),
              none: t('None'),
              count: t('Count'),
              average: t('Average'),
              // Standard menu items
              copy: t('Copy'),
              copyWithHeaders: t('Copy with Headers'),
              paste: t('Paste'),
              // Column menu and sorting
              sortAscending: t('Sort Ascending'),
              sortDescending: t('Sort Descending'),
              sortUnSort: t('Clear Sort'),
            }}
            context={{
              onColumnHeaderClicked: handleColumnHeaderClick,
              initialSortState: getInitialSortState(
                serverPaginationData?.sortBy || [],
              ),
              lastFilteredColumn: serverPaginationData?.lastFilteredColumn,
              lastFilteredInputPosition:
                serverPaginationData?.lastFilteredInputPosition,
            }}
          />
        </div>
        {serverPagination && (
          <Pagination
            currentPage={serverPaginationData?.currentPage || 0}
            pageSize={
              hasServerPageLengthChanged
                ? serverPageLength
                : serverPaginationData?.pageSize || 10
            }
            totalRows={rowCount || 0}
            pageSizeOptions={[10, 20, 50, 100, 200]}
            onServerPaginationChange={onServerPaginationChange}
            onServerPageSizeChange={onServerPageSizeChange}
            sliceId={id}
          />
        )}
      </div>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default memo(AgGridDataTable);
