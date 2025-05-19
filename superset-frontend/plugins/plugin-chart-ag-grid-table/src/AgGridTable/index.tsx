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
  type ValueFormatterFunc,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import './styles/ag-grid.css';

import { type FunctionComponent } from 'react';

import { styled, css } from '@superset-ui/core';

export interface Props {
  gridTheme?: string;
  isDarkMode?: boolean;
  gridHeight?: number | null;
  updateInterval?: number;
  data?: any[]; // Add proper type for your data
  onGridReady?: (params: GridReadyEvent) => void;
  colDefsFromProps: any[];
  includeSearch: boolean;
}

// Register modules once outside component
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
    colDefsFromProps,
    includeSearch,
  }) => {
    console.log({
      colDefsFromProps,
      data,
    });

    const gridRef = useRef<AgGridReact>(null);
    const gridApiRef = useRef<GridApi | null>(null);

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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.5014 7.00039C11.5014 7.59133 11.385 8.1765 11.1588 8.72246C10.9327 9.26843 10.6012 9.7645 10.1833 10.1824C9.76548 10.6002 9.2694 10.9317 8.72344 11.1578C8.17747 11.384 7.59231 11.5004 7.00136 11.5004C6.41041 11.5004 5.82525 11.384 5.27929 11.1578C4.73332 10.9317 4.23725 10.6002 3.81938 10.1824C3.40152 9.7645 3.07005 9.26843 2.8439 8.72246C2.61776 8.1765 2.50136 7.59133 2.50136 7.00039C2.50136 5.80691 2.97547 4.66232 3.81938 3.81841C4.6633 2.97449 5.80789 2.50039 7.00136 2.50039C8.19484 2.50039 9.33943 2.97449 10.1833 3.81841C11.0273 4.66232 11.5014 5.80691 11.5014 7.00039ZM10.6814 11.7404C9.47574 12.6764 7.95873 13.1177 6.43916 12.9745C4.91959 12.8314 3.51171 12.1145 2.50211 10.9698C1.49252 9.8251 0.957113 8.33868 1.0049 6.81314C1.05268 5.28759 1.68006 3.83759 2.75932 2.75834C3.83857 1.67908 5.28856 1.0517 6.81411 1.00392C8.33966 0.956136 9.82608 1.49154 10.9708 2.50114C12.1154 3.51073 12.8323 4.91862 12.9755 6.43819C13.1187 7.95775 12.6773 9.47476 11.7414 10.6804L14.5314 13.4704C14.605 13.539 14.6642 13.6218 14.7051 13.7138C14.7461 13.8058 14.7682 13.9052 14.77 14.0059C14.7717 14.1066 14.7532 14.2066 14.7155 14.3C14.6778 14.3934 14.6216 14.4782 14.5504 14.5494C14.4792 14.6206 14.3943 14.6768 14.301 14.7145C14.2076 14.7522 14.1075 14.7708 14.0068 14.769C13.9061 14.7672 13.8068 14.7452 13.7148 14.7042C13.6228 14.6632 13.54 14.6041 13.4714 14.5304L10.6814 11.7404Z"
                    fill="currentColor"
                  />
                </svg>

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
            paginationAutoPageSize
            onGridReady={handleGridReady}
            quickFilterText={quickFilterText}
          />
        </div>
      </StyledContainer>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default AgGridDataTable;
