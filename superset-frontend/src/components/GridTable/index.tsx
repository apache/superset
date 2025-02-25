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
import { ReactNode, useCallback, useMemo } from 'react';
import { Global } from '@emotion/react';
import { css, useTheme } from '@superset-ui/core';

import type { Column, GridOptions } from 'ag-grid-community';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import copyTextToClipboard from 'src/utils/copy';
import ErrorBoundary from 'src/components/ErrorBoundary';

import { PIVOT_COL_ID, GridSize } from './constants';
import Header from './Header';

const gridComponents = {
  agColumnHeader: Header,
};

export { GridSize };

export type ColDef = {
  type: string;
  field: string;
};

export interface TableProps<RecordType> {
  /**
   * Data that will populate the each row and map to the column key.
   */
  data: RecordType[];
  /**
   * Table column definitions.
   */
  columns: {
    label: string;
    headerName?: string;
    width?: number;
    comparator?: (valueA: string | number, valueB: string | number) => number;
    render?: (value: any) => ReactNode;
  }[];

  size?: GridSize;

  externalFilter?: AgGridReactProps['doesExternalFilterPass'];

  height: number;

  columnReorderable?: boolean;

  sortable?: boolean;

  enableActions?: boolean;

  showRowNumber?: boolean;

  usePagination?: boolean;

  striped?: boolean;
}

const onSortChanged: AgGridReactProps['onSortChanged'] = ({ api }) =>
  api.refreshCells();

function GridTable<RecordType extends object>({
  data,
  columns,
  sortable = true,
  columnReorderable,
  height,
  externalFilter,
  showRowNumber,
  enableActions,
  size = GridSize.Middle,
  striped,
}: TableProps<RecordType>) {
  const theme = useTheme();
  const isExternalFilterPresent = useCallback(
    () => Boolean(externalFilter),
    [externalFilter],
  );
  const rowIndexLength = `${data.length}}`.length;
  const onKeyDown: AgGridReactProps<Record<string, any>>['onCellKeyDown'] =
    useCallback(({ event, column, data, value, api }) => {
      if (
        !document.getSelection?.()?.toString?.() &&
        event &&
        event.key === 'c' &&
        (event.ctrlKey || event.metaKey)
      ) {
        const columns =
          column.getColId() === PIVOT_COL_ID
            ? api
                .getAllDisplayedColumns()
                .filter((column: Column) => column.getColId() !== PIVOT_COL_ID)
            : [column];
        const record =
          column.getColId() === PIVOT_COL_ID
            ? [
                columns.map((column: Column) => column.getColId()).join('\t'),
                columns
                  .map((column: Column) => data?.[column.getColId()])
                  .join('\t'),
              ].join('\n')
            : String(value);
        copyTextToClipboard(() => Promise.resolve(record));
      }
    }, []);
  const columnDefs = useMemo(
    () =>
      [
        {
          field: PIVOT_COL_ID,
          valueGetter: 'node.rowIndex+1',
          cellClass: 'locked-col',
          width: 20 + rowIndexLength * 6,
          suppressNavigable: true,
          resizable: false,
          pinned: 'left' as const,
          sortable: false,
          ...(columnReorderable && { suppressMovable: true }),
        },
        ...columns.map(
          (
            { label, headerName, width, render: cellRenderer, comparator },
            index,
          ) => ({
            field: label,
            headerName,
            cellRenderer,
            sortable,
            comparator,
            ...(index === columns.length - 1 && {
              flex: 1,
              width,
              minWidth: 150,
            }),
          }),
        ),
      ].slice(showRowNumber ? 0 : 1),
    [rowIndexLength, columnReorderable, columns, showRowNumber, sortable],
  );
  const defaultColDef: AgGridReactProps['defaultColDef'] = useMemo(
    () => ({
      ...(!columnReorderable && { suppressMovable: true }),
      resizable: true,
      sortable,
      filter: Boolean(enableActions),
    }),
    [columnReorderable, enableActions, sortable],
  );

  const rowHeight = theme.gridUnit * (size === GridSize.Middle ? 9 : 7);

  const gridOptions = useMemo<GridOptions>(
    () => ({
      enableCellTextSelection: true,
      ensureDomOrder: true,
      suppressFieldDotNotation: true,
      headerHeight: rowHeight,
      rowSelection: 'multiple',
      rowHeight,
    }),
    [rowHeight],
  );

  return (
    <ErrorBoundary>
      <Global
        styles={() => css`
          #grid-table.ag-theme-quartz {
            --ag-icon-font-family: agGridMaterial;
            --ag-grid-size: ${theme.gridUnit}px;
            --ag-font-size: ${theme.typography.sizes[
              size === GridSize.Middle ? 'm' : 's'
            ]}px;
            --ag-font-family: ${theme.typography.families.sansSerif};
            --ag-row-height: ${rowHeight}px;
            ${!striped &&
            `--ag-odd-row-background-color: ${theme.colors.grayscale.light5};`}
            --ag-border-color: ${theme.colors.grayscale.light2};
            --ag-row-border-color: ${theme.colors.grayscale.light2};
            --ag-header-background-color: ${theme.colors.grayscale.light4};
          }
          #grid-table .ag-cell {
            -webkit-font-smoothing: antialiased;
          }
          .locked-col {
            background: var(--ag-row-border-color);
            padding: 0;
            text-align: center;
            font-size: calc(var(--ag-font-size) * 0.9);
            color: var(--ag-disabled-foreground-color);
          }
          .ag-row-hover .locked-col {
            background: var(--ag-row-hover-color);
          }
          .ag-header-cell {
            overflow: hidden;
          }
          & [role='columnheader']:hover .customHeaderAction {
            display: block;
          }
        `}
      />
      <div
        id="grid-table"
        className="ag-theme-quartz"
        css={css`
          width: 100%;
          height: ${height}px;
        `}
      >
        <AgGridReact
          // TODO: migrate to Theme API - https://www.ag-grid.com/react-data-grid/theming-migration/
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onSortChanged={onSortChanged}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={externalFilter}
          components={gridComponents}
          gridOptions={gridOptions}
          onCellKeyDown={onKeyDown}
        />
      </div>
    </ErrorBoundary>
  );
}

export default GridTable;
