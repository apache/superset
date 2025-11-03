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
import { useCallback, useMemo } from 'react';
import { css, useTheme } from '@superset-ui/core';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import type { Column, GridOptions } from 'ag-grid-community';
import type { AgGridReactProps } from 'ag-grid-react';

import copyTextToClipboard from 'src/utils/copy';

import { PIVOT_COL_ID, GridSize } from './constants';
import { Header } from './Header';
import type { TableProps } from './types';

const gridComponents = {
  agColumnHeader: Header,
};

const onSortChanged: AgGridReactProps['onSortChanged'] = ({ api }) =>
  api.refreshCells();

export function GridTable<RecordType extends object>({
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
          cellClass: 'row-number-col',
          cellStyle: {
            backgroundColor: theme.colorFillTertiary,
            padding: '0',
            textAlign: 'center',
            fontSize: '0.9em',
            color: theme.colorTextTertiary,
          },
          width: 30 + rowIndexLength * 6,
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
    [
      rowIndexLength,
      columnReorderable,
      columns,
      showRowNumber,
      sortable,
      theme,
    ],
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

  const rowHeight = theme.sizeUnit * (size === GridSize.Middle ? 9 : 7);

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
    <div
      css={css`
        width: 100%;
        height: ${height}px;

        /* Handle hover state for row number column */
        .ag-row-hover .row-number-col {
          background: ${theme.colorFillSecondary};
        }

        .ag-header-cell {
          overflow: hidden;
        }

        & [role='columnheader']:hover .customHeaderAction {
          display: flex;
        }
      `}
    >
      <ThemedAgGridReact
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
  );
}

export type { TableProps };
