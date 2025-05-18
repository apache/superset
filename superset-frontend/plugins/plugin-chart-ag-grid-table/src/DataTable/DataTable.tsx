import { useCallback, useMemo, useRef, useState } from 'react';

import {
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  type GetRowIdFunc,
  type GetRowIdParams,
  ModuleRegistry,
  type ValueFormatterFunc,
  type ValueGetterParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import './styles/ag-grid.css';

import { type FunctionComponent } from 'react';

import type { CustomCellRendererProps } from 'ag-grid-react';
import { getData } from './data';

export const TickerCellRenderer: FunctionComponent<CustomCellRendererProps> = ({
  data,
}) =>
  data && (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      <b className="custom-ticker">{data.ticker}</b>
      <span className="ticker-name"> {data.name}</span>
    </div>
  );

export interface Props {
  gridTheme?: string;
  isDarkMode?: boolean;
  gridHeight?: number | null;
  updateInterval?: number;
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const numberFormatter: ValueFormatterFunc = ({ value }) => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
  });
  return value == null ? '' : formatter.format(value);
};

const AgGridDataTable: React.FC<Props> = ({
  gridTheme = 'ag-theme-quartz',
  isDarkMode = false,
  gridHeight = null,
}) => {
  const [rowData] = useState(getData());
  const gridRef = useRef<AgGridReact>(null);

  const colDefs = useMemo<ColDef[]>(
    () => [
      {
        field: 'ticker',
        cellRenderer: TickerCellRenderer,
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
          data && data.quantity * (data.price / data.purchasePrice),
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
          data && data.quantity * data.price,
        cellRenderer: 'agAnimateShowChangeCellRenderer',
        valueFormatter: numberFormatter,
        aggFunc: 'sum',
        minWidth: 160,
        initialWidth: 160,
      },
    ],
    [],
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      flex: 1,
      filter: true,
      enableRowGroup: true,
      enableValue: true,
    }),
    [],
  );

  const getRowId = useCallback<GetRowIdFunc>(
    ({ data: { ticker } }: GetRowIdParams) => ticker,
    [],
  );

  return (
    <div>
      <div
        className={`ag-theme-quartz${isDarkMode ? '-dark' : ''}`}
        style={{
          height: gridHeight || '100%',
          width: '100%',
        }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={{
            ...defaultColDef,
            sortable: true,
            resizable: true,
            filter: true,
            flex: 1,
            minWidth: 100,
          }}
          getRowId={getRowId}
          rowSelection="multiple"
          animateRows
          suppressAggFuncInHeader
          groupDefaultExpanded={-1}
          rowGroupPanelShow="always"
          enableCellTextSelection
          paginationAutoPageSize
        />
      </div>
    </div>
  );
};

export default AgGridDataTable;
