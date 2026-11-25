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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import type {
  CellKeyDownEvent,
  Column,
  ColumnState,
  GridApi,
  GridOptions,
  GridReadyEvent,
  SortDirection,
  ValueGetterParams,
} from 'ag-grid-community';
import type { AgGridReactProps } from 'ag-grid-react';

import copyTextToClipboard from 'src/utils/copy';

import { PIVOT_COL_ID, GridSize } from './constants';
import { Header } from './Header';
import type { TableProps } from './types';

const gridComponents = {
  agColumnHeader: Header,
};

const sameOrderby = (a: [string, boolean][], b: [string, boolean][]) =>
  a.length === b.length &&
  a.every(([col, asc], i) => col === b[i][0] && asc === b[i][1]);

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
  onServerSort,
  defaultSort,
  themeOverrides,
}: TableProps<RecordType>) {
  const theme = useTheme();
  const gridApi = useRef<GridApi>();

  // The order the rows arrive in when nobody has sorted, limited to columns
  // the grid actually shows, so its arrow can be drawn from the start.
  // Keyed on contents, so a new `columns` array alone doesn't re-seed and wipe
  // a sort the user has applied.
  const seededSortKey = JSON.stringify(
    (defaultSort ?? []).filter(([col]) =>
      columns.some(({ label }) => label === col),
    ),
  );
  const seededSort = useMemo<[string, boolean][]>(
    () => JSON.parse(seededSortKey),
    [seededSortKey],
  );

  const applySeededSort = useCallback(
    (api: GridApi) => {
      api.applyColumnState({
        state: seededSort.map(([colId, asc], sortIndex): ColumnState => ({
          colId,
          sort: asc ? 'asc' : 'desc',
          sortIndex,
        })),
        defaultState: { sort: null },
      });
    },
    [seededSort],
  );

  useEffect(() => {
    if (gridApi.current) {
      applySeededSort(gridApi.current);
    }
  }, [applySeededSort]);

  const onGridReady = useCallback(
    ({ api }: GridReadyEvent) => {
      gridApi.current = api;
      applySeededSort(api);
    },
    [applySeededSort],
  );

  const onSortChanged = useCallback<
    NonNullable<AgGridReactProps['onSortChanged']>
  >(
    ({ api }) => {
      api.refreshCells();
      const orderby = api
        .getColumnState()
        .filter(state => state.sort)
        // Order the columns by the sequence in which the user applied each
        // sort so multi-column sort reaches the server in the right priority.
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map(state => [state.colId, state.sort === 'asc'] as [string, boolean]);
      if (orderby.length === 0 && seededSort.length > 0) {
        // Clearing a sort brings back the default order, so show its arrow
        // again; that re-fires this handler with the seeded state.
        applySeededSort(api);
        return;
      }
      // The seeded state is the default order, not an explicit sort.
      onServerSort?.(sameOrderby(orderby, seededSort) ? [] : orderby);
    },
    [applySeededSort, onServerSort, seededSort],
  );
  const isExternalFilterPresent = useCallback(
    () => Boolean(externalFilter),
    [externalFilter],
  );
  const rowIndexLength = `${data.length}}`.length;
  const onKeyDown: AgGridReactProps<Record<string, any>>['onCellKeyDown'] =
    useCallback(({ event, column, data, value, api }: CellKeyDownEvent) => {
      const keyEvent = event as KeyboardEvent | undefined;
      if (
        !document.getSelection?.()?.toString?.() &&
        keyEvent &&
        keyEvent.key === 'c' &&
        (keyEvent.ctrlKey || keyEvent.metaKey)
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
  const seededDirections = useMemo(
    () =>
      Object.fromEntries(
        seededSort.map(([col, asc]) => [
          col,
          (asc ? ['asc', 'desc'] : ['desc', 'asc']) as SortDirection[],
        ]),
      ),
    [seededSort],
  );
  const columnDefs = useMemo(
    () =>
      [
        {
          field: PIVOT_COL_ID,
          valueGetter: (params: ValueGetterParams) =>
            (params.node?.rowIndex ?? 0) + 1,
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
            // A column carrying the default order has no separate unsorted
            // state, so it only toggles between the two directions.
            ...(seededDirections[label] && {
              sortingOrder: seededDirections[label],
            }),
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
      seededDirections,
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

  const defaultRowHeight = theme.sizeUnit * (size === GridSize.Middle ? 9 : 7);
  const rowHeight = themeOverrides?.rowHeight ?? defaultRowHeight;
  const headerHeight = themeOverrides?.headerHeight ?? rowHeight;

  const gridOptions = useMemo<GridOptions>(
    () => ({
      enableCellTextSelection: true,
      ensureDomOrder: true,
      suppressFieldDotNotation: true,
      headerHeight,
      rowHeight,
    }),
    [rowHeight, headerHeight],
  );

  // ag-grid paints its sticky header and pinned containers with the data
  // background, so it must be opaque or scrolled rows show through them.
  const gridThemeOverrides = useMemo(
    () => ({ backgroundColor: theme.colorBgContainer, ...themeOverrides }),
    [theme.colorBgContainer, themeOverrides],
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

        /* Preserve significant whitespace within cell values (e.g. option
        symbols and other whitespace-sensitive data). ag-Grid's default
        collapses runs of spaces, which can misrepresent the underlying
        value.

        'pre' is a deliberate trade-off over 'pre-wrap': it keeps values on a
        single line so row heights and column sizing stay unchanged. CSS has no
        value that preserves spaces while collapsing newlines, so an embedded
        newline renders on multiple lines; truncating such values to the
        visible row is acceptable here. The value element grows to fit its
        lines, so the clip is applied on .ag-cell, which has the fixed row
        height; otherwise the extra lines paint over the rows below.
        overflow/text-overflow keep over-long single-line values clipped with
        an ellipsis rather than overflowing the cell. */
        .ag-cell {
          overflow: hidden;
        }

        .ag-cell-value {
          white-space: pre;
          overflow: hidden;
          text-overflow: ellipsis;
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
        onGridReady={onGridReady}
        isExternalFilterPresent={isExternalFilterPresent}
        doesExternalFilterPass={externalFilter}
        components={gridComponents}
        gridOptions={gridOptions}
        onCellKeyDown={onKeyDown}
        themeOverrides={gridThemeOverrides}
      />
    </div>
  );
}

export type { TableProps };
