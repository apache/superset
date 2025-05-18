import { useCallback, useMemo, useRef, memo, useState } from 'react';

import {
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  type GetRowIdFunc,
  type GetRowIdParams,
  ModuleRegistry,
  type ValueFormatterFunc,
  type ValueGetterParams,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import './styles/ag-grid.css';

import { type FunctionComponent } from 'react';

import type { CustomCellRendererProps } from 'ag-grid-react';
import { getData } from './data';

// Memoize the TickerCellRenderer
const TickerCellRenderer: FunctionComponent<CustomCellRendererProps> = memo(
  ({ data }) =>
    data && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <b className="custom-ticker">{data.ticker}</b>
        <span className="ticker-name">{data.name}</span>
      </div>
    ),
);

TickerCellRenderer.displayName = 'TickerCellRenderer';

export interface Props {
  gridTheme?: string;
  isDarkMode?: boolean;
  gridHeight?: number | null;
  updateInterval?: number;
  data?: any[]; // Add proper type for your data
  onGridReady?: (params: GridReadyEvent) => void;
}

// Register modules once outside component
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

// Memoize formatter outside component
const numberFormatter: ValueFormatterFunc = ({ value }) => {
  if (value == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(value);
};

// Memoize the entire component
const AgGridDataTable: FunctionComponent<Props> = memo(
  ({
    gridTheme = 'ag-theme-quartz',
    isDarkMode = false,
    gridHeight = null,
    data = [],
    onGridReady,
  }) => {
    const [rowData] = useState(getData());
    const gridRef = useRef<AgGridReact>(null);
    const gridApiRef = useRef<GridApi | null>(null);

    // Memoize column definitions
    const colDefs = useMemo<ColDef[]>(
      () => [
        {
          field: 'ticker',
          cellRenderer: TickerCellRenderer,
          sortable: true,
          filter: true,
        },
        {
          headerName: 'Timeline',
          field: 'timeline',
          sortable: false,
          filter: false,
        },
        {
          field: 'instrument',
          cellDataType: 'text',
          type: 'rightAligned',
          minWidth: 100,
          initialWidth: 100,
        },
        {
          colId: 'p&l',
          headerName: 'P&L',
          cellDataType: 'number',
          filter: 'agNumberColumnFilter',
          type: 'rightAligned',
          cellRenderer: 'agAnimateShowChangeCellRenderer',
          valueGetter: ({ data }: ValueGetterParams) =>
            data ? data.quantity * (data.price / data.purchasePrice) : null,
          valueFormatter: numberFormatter,
          aggFunc: 'sum',
          minWidth: 140,
          initialWidth: 140,
        },
        {
          colId: 'totalValue',
          headerName: 'Total Value',
          type: 'rightAligned',
          cellDataType: 'number',
          filter: 'agNumberColumnFilter',
          valueGetter: ({ data }: ValueGetterParams) =>
            data ? data.quantity * data.price : null,
          cellRenderer: 'agAnimateShowChangeCellRenderer',
          valueFormatter: numberFormatter,
          aggFunc: 'sum',
          minWidth: 160,
          initialWidth: 160,
        },
      ],
      [],
    );

    // Memoize default column definition
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

    // Memoize row ID getter
    const getRowId = useCallback<GetRowIdFunc>(
      ({ data: { ticker } }: GetRowIdParams) => ticker,
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
        height: gridHeight || '100%',
        width: '100%',
      }),
      [gridHeight],
    );

    // Memoize grid class name
    const gridClassName = useMemo(
      () => `ag-theme-quartz${isDarkMode ? '-dark' : ''}`,
      [isDarkMode],
    );

    return (
      <div>
        <div className={gridClassName} style={containerStyle}>
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            rowSelection="multiple"
            animateRows
            suppressAggFuncInHeader
            groupDefaultExpanded={-1}
            rowGroupPanelShow="always"
            enableCellTextSelection
            paginationAutoPageSize
            onGridReady={handleGridReady}
          />
        </div>
      </div>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default AgGridDataTable;
