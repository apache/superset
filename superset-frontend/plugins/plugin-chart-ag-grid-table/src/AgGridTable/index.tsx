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
} from 'react';

import {
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  ModuleRegistry,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import './styles/ag-grid.css';

import { type FunctionComponent } from 'react';

import { styled, css, JsonObject } from '@superset-ui/core';
import { SearchOutlined } from '@ant-design/icons';
import Pagination from './components/Pagination';

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
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const StyledContainer = styled.div`
  ${({ theme }) => css`
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
      line-height: 1.4;
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

// Memoize the entire component
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
  }) => {
    const gridRef = useRef<AgGridReact>(null);
    const gridApiRef = useRef<GridApi | null>(null);

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
    const onFilterTextBoxChanged = useCallback(
      ({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
        setQuickFilterText(value),
      [],
    );

    return (
      <StyledContainer>
        <div className={gridClassName} style={containerStyle}>
          {includeSearch && (
            <div className="input-wrapper">
              <div className="input-container">
                <SearchOutlined />
                <input
                  type="text"
                  id="filter-text-box"
                  placeholder="Search"
                  onInput={onFilterTextBoxChanged}
                />
              </div>
            </div>
          )}

          <AgGridReact
            ref={gridRef}
            rowData={data}
            columnDefs={colDefsFromProps}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            animateRows
            suppressAggFuncInHeader
            groupDefaultExpanded={-1}
            rowGroupPanelShow="always"
            enableCellTextSelection
            onGridReady={handleGridReady}
            quickFilterText={quickFilterText}
            suppressMovableColumns={!allowRearrangeColumns}
            pagination={pagination}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[10, 20, 50, 100, 200]}
          />
          {serverPagination && (
            <Pagination
              currentPage={serverPaginationData?.currentPage || 0}
              pageSize={serverPaginationData?.pageSize || 10}
              totalRows={rowCount || 0}
              pageSizeOptions={[10, 20, 50, 100, 200]}
              onServerPaginationChange={onServerPaginationChange}
            />
          )}
        </div>
      </StyledContainer>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default AgGridDataTable;
