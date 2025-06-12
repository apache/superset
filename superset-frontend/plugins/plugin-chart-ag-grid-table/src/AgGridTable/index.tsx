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
  useState,
  ChangeEvent,
  useEffect,
} from 'react';

import {
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  ModuleRegistry,
  GridReadyEvent,
  GridApi,
  GridState,
  SortModelItem,
  CellClickedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { type FunctionComponent } from 'react';
import {
  styled,
  css,
  JsonObject,
  DataRecordValue,
  DataRecord,
} from '@superset-ui/core';
import { SearchOutlined } from '@ant-design/icons';
import { debounce, isEqual } from 'lodash';
import Pagination from './components/Pagination';
import SearchSelectDropdown from './components/SearchSelectDropdown';
import { SearchOption, SortByItem } from '../types';
import getInitialSortState from '../utils/getInitialSortState';

interface CustomColDef extends ColDef {
  customMeta?: {
    isMetric?: boolean;
  };
}

export interface Props {
  gridTheme?: string;
  isDarkMode?: boolean;
  gridHeight?: number | null;
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
  handleCrossFilter: (key: string, val: DataRecordValue) => void;
  isActiveFilterValue: (key: string, val: DataRecordValue) => boolean;
  renderTimeComparisonDropdown: () => JSX.Element | null;
  cleanedTotals: DataRecord;
  showTotals: boolean;
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const StyledContainer = styled.div`
  ${({ theme }) => css`
    .search-container {
      display: flex;
      justify-content: flex-end;
    }

    .dropdown-controls-container {
      display: flex;
      justify-content: flex-end;
    }

    .time-comparison-dropdown {
      display: flex;
      padding-right: 16px;
      padding-top: 7px;
    }

    .ag-header,
    .ag-row,
    .ag-spanned-row {
      font-size: 12px;
      font-weight: 500;
    }

    .ag-root-wrapper {
      border-radius: 2px;
    }

    .search-by-text {
      margin-right: 5px;
    }
    .input-container {
      margin-left: auto;
    }
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      overflow: visible;
      margin-bottom: 1rem;
    }

    .input-wrapper svg {
      pointer-events: none;
      transform: translate(28px, 2px);
      color: ${theme.colors.grayscale.base};
    }

    .input-wrapper input {
      font-size: ${theme.typography.sizes.s}px;
      padding: 0.375em 0.75em 0.375em 2.4em;
      line-height: 1.8;
      border-radius: ${theme.gridUnit}px;
      border: 1px solid ${theme.colors.grayscale.light2};
      background-color: transparent;
      outline: none;

      &:focus {
        border-color: ${theme.colors.primary.base};
      }

      &::placeholder {
        color: ${theme.colors.grayscale.light1};
      }
    }
  `}
`;

const isSearchFocused = new Map<string, boolean>();

const AgGridDataTable: FunctionComponent<Props> = memo(
  ({
    gridTheme = 'ag-theme-quartz',
    isDarkMode = false,
    gridHeight = null,
    data = [],
    onGridReady,
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
    handleCrossFilter,
    isActiveFilterValue,
    renderTimeComparisonDropdown,
    cleanedTotals,
    showTotals,
  }) => {
    const gridRef = useRef<AgGridReact>(null);
    const gridApiRef = useRef<GridApi | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchId = `search-${id}`;
    const gridInitialState: GridState = {
      ...(serverPagination && {
        sort: {
          sortModel: getInitialSortState(serverPaginationData?.sortBy || []),
        },
      }),
    };

    const defaultColDef = useMemo<ColDef>(
      () => ({
        flex: 1,
        filter: true,
        enableRowGroup: true,
        enableValue: true,
        sortable: true,
        resizable: true,
        minWidth: 100,
      }),
      [],
    );

    // Handle grid ready event
    const handleGridReady = useCallback(
      (params: GridReadyEvent) => {
        gridApiRef.current = params.api;
        if (onGridReady) {
          onGridReady(params);
        }

        // Optional: Auto-size columns on initial load
        params.api.sizeColumnsToFit();
      },
      [onGridReady],
    );

    // Memoize container style
    const containerStyle = useMemo(
      () => ({
        height: gridHeight
          ? includeSearch
            ? `${gridHeight - 16}px`
            : `${gridHeight}px`
          : '100%',
        width: '100%',
      }),
      [gridHeight],
    );

    // Memoize grid class name
    const gridClassName = useMemo(
      () => `ag-theme-quartz${isDarkMode ? '-dark' : ''}`,
      [isDarkMode],
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
      () => () => {
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

    const shouldSort = ({
      colId,
      sortDir,
      percentMetrics,
      serverPagination,
      gridInitialState,
    }: {
      colId: string;
      sortDir: string;
      percentMetrics: string[];
      serverPagination: boolean;
      gridInitialState: GridState;
    }) => {
      if (percentMetrics.includes(colId)) return false;
      if (!serverPagination) return false;

      const initialSort: Partial<SortModelItem> =
        gridInitialState?.sort?.sortModel?.[0] || {};
      const { colId: initialColId = '', sort: initialSortDir = '' } =
        initialSort;

      if (initialColId === colId && initialSortDir === sortDir) return false;

      return true;
    };

    const handleColumnHeaderClick = useCallback(
      params => {
        const colId = params?.column?.colId;
        const sortDir = params?.column?.sort;

        const isSortable = shouldSort({
          colId,
          sortDir,
          percentMetrics,
          serverPagination: !!serverPagination,
          gridInitialState,
        });

        if (!isSortable) return;

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
      },
      [serverPagination, gridInitialState, percentMetrics, onSortChange],
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

    const handleCellClick = (params: CellClickedEvent<any, any>) => {
      const isMetric = (params?.column?.getColDef() as CustomColDef)?.customMeta
        ?.isMetric;
      if (isMetric) return;
      const colId = params?.column?.getColId();
      const value = params?.value;
      handleCrossFilter(colId, value);
    };

    return (
      <StyledContainer>
        <div className={gridClassName} style={containerStyle}>
          <div className="dropdown-controls-container">
            {renderTimeComparisonDropdown && (
              <div className="time-comparison-dropdown">
                {renderTimeComparisonDropdown()}
              </div>
            )}
            {includeSearch && (
              <div className="search-container">
                {serverPagination && (
                  <div>
                    <span className="search-by-text"> Search by :</span>
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
                      placeholder="Search"
                      onInput={onFilterTextBoxChanged}
                      onFocus={handleSearchFocus}
                      onBlur={handleSearchBlur}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <AgGridReact
            ref={gridRef}
            rowData={data}
            rowHeight={30}
            columnDefs={colDefsFromProps}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            animateRows
            onCellClicked={handleCellClick}
            initialState={gridInitialState}
            suppressAggFuncInHeader
            groupDefaultExpanded={-1}
            rowGroupPanelShow="always"
            enableCellTextSelection
            onGridReady={handleGridReady}
            quickFilterText={serverPagination ? '' : quickFilterText}
            suppressMovableColumns={!allowRearrangeColumns}
            pagination={pagination}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[10, 20, 50, 100, 200]}
            suppressDragLeaveHidesColumns
            pinnedBottomRowData={showTotals ? [cleanedTotals] : undefined}
            context={{
              onColumnHeaderClicked: handleColumnHeaderClick,
              initialSortState: getInitialSortState(
                serverPaginationData?.sortBy || [],
              ),
              isActiveFilterValue,
            }}
          />
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
            />
          )}
        </div>
      </StyledContainer>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default AgGridDataTable;
