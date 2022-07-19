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
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
// import { styled } from '@superset-ui/core';
import { AgGridReact } from '@ag-grid-community/react';
import {
  AllModules,
  LicenseManager,
  MenuItemDef,
  GetContextMenuItemsParams,
} from '@ag-grid-enterprise/all-modules';
import { NULL_STRING } from 'src/utils/common';
import { ensureIsArray } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { clearDataMask } from 'src/dataMask/actions';
import { RootState } from 'src/dashboard/types';
import { CccsGridTransformedProps } from './types';

import CountryValueRenderer from './CountryValueRenderer';
import Ipv4ValueRenderer from './Ipv4ValueRenderer';
import Ipv6ValueRenderer from './Ipv6ValueRenderer';
import DomainValueRenderer from './DomainValueRenderer';
import JsonValueRenderer from './JsonValueRenderer';
import CustomTooltip from './CustomTooltip';

/// / jcc

// 'use strict';

import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';

import { PAGE_SIZE_OPTIONS } from './plugin/controlPanel';

const DEFAULT_COLUMN_DEF = {
  editable: false,
  filter: true,
  resizable: true,
  tooltipField: '',
  tooltipComponent: 'customTooltip',
};

export default function CccsGrid({
  width,
  height,
  agGridLicenseKey,
  columnDefs,
  rowData,
  formData,
  setDataMask,
  setControlValue,
  selectedValues,
  tooltipShowDelay,
  rowSelection,
  emitFilter,
  include_search,
  page_length = 0,
  enable_grouping = false,
  column_state,
  filters: initialFilters = {},
}: CccsGridTransformedProps) {
  LicenseManager.setLicenseKey(agGridLicenseKey);
  const dispatch = useDispatch();
  const crossFilterValue = useSelector<RootState, any>(
    state => state.dataMask[formData.slice_id]?.filterState?.value,
  );

  const [filters, setFilters] = useState(initialFilters);
  const [searchValue, setSearchValue] = useState('');
  const [pageSize, setPageSize] = useState<number>(page_length);

  const gridRef = useRef<AgGridReact<any>>(null);

  const handleChange = useCallback(
    filters => {
      if (!emitFilter) {
        return;
      }

      const groupBy = Object.keys(filters);
      const groupByValues = Object.values(filters);
      setDataMask({
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                  const val = ensureIsArray(filters?.[col]);
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val,
                  };
                }),
        },
        filterState: {
          value: groupByValues.length ? groupByValues : null,
        },
      });
    },
    [emitFilter, setDataMask],
  ); // only take relevant page size options

  const getContextMenuItems = useCallback(
    (params: GetContextMenuItemsParams): (string | MenuItemDef)[] => {
      let result: (string | MenuItemDef)[] = [];
      if (!emitFilter) {
        result = ['copy', 'copyWithHeaders', 'paste', 'separator', 'export'];
      } else {
        result = [
          'copy',
          'copyWithHeaders',
          'paste',
          'separator',
          {
            name: 'Emit Filter(s)',
            disabled: params.value === null,
            action: () => handleChange(filters),
            // eslint-disable-next-line theme-colors/no-literal-colors
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" class=""><path fill-rule="evenodd" clip-rule="evenodd" d="M18.1573 17.864C21.2763 14.745 21.2763 9.66935 18.1573 6.5503C15.0382 3.43125 9.96264 3.43125 6.84359 6.5503L5.42938 5.13609C9.32836 1.2371 15.6725 1.2371 19.5715 5.13609C23.4705 9.03507 23.4705 15.3792 19.5715 19.2782C15.6725 23.1772 9.32836 23.1772 5.42938 19.2782L6.84359 17.864C9.96264 20.9831 15.0375 20.9838 18.1573 17.864ZM2.00035 11.5C2.00035 11.2239 2.2242 11 2.50035 11H5.00035L5.00035 10C5.00035 9.58798 5.47073 9.35279 5.80035 9.60001L9.00035 12C9.17125 12.1032 6.98685 13.637 5.77613 14.4703C5.44613 14.6975 5.00035 14.4601 5.00035 14.0595V13L2.50035 13C2.22421 13 2.00035 12.7761 2.00035 12.5L2.00035 11.5ZM9.67202 9.37873C11.2319 7.81885 13.7697 7.81956 15.3289 9.37873C16.888 10.9379 16.8887 13.4757 15.3289 15.0356C13.769 16.5955 11.2312 16.5948 9.67202 15.0356L8.2578 16.4498C10.5976 18.7896 14.4033 18.7896 16.7431 16.4498C19.0829 14.11 19.0829 10.3043 16.7431 7.96451C14.4033 5.6247 10.5976 5.6247 8.2578 7.96451L9.67202 9.37873Z" fill="#20A7C9"></path></svg>',
          },
          {
            name: 'Clear Emitted Filter(s)',
            disabled: crossFilterValue === undefined,
            action: () => dispatch(clearDataMask(formData.slice_id)),
            icon: '<span class="ag-icon ag-icon-cross" unselectable="on" role="presentation"></span>',
          },
          'separator',
          'export',
        ];
      }
      return result;
    },
    [
      crossFilterValue,
      dispatch,
      emitFilter,
      filters,
      formData.slice_id,
      handleChange,
    ],
  );

  const frameworkComponents = {
    countryValueRenderer: CountryValueRenderer,
    ipv4ValueRenderer: Ipv4ValueRenderer,
    ipv6ValueRenderer: Ipv6ValueRenderer,
    domainValueRenderer: DomainValueRenderer,
    jsonValueRenderer: JsonValueRenderer,
    customTooltip: CustomTooltip,
  };

  const onGridReady = (params: any) => {
    if (column_state) {
      params.columnApi.applyColumnState({
        state: column_state,
        applyOrder: true,
      });
    }
  };

  const onSelectionChanged = (params: any) => {
    const gridApi = params.api;
    const selectedRows = gridApi.getSelectedRows();
    gridApi.document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].athlete : '';
  };

  const onRangeSelectionChanged = (params: any) => {
    if (params.finished === false) {
      return;
    }

    const gridApi = params.api;
    const cellRanges = gridApi.getCellRanges();

    const updatedFilters = {};
    cellRanges.forEach((range: any) => {
      range.columns.forEach((column: any) => {
        const col = getEmitTarget(column.colDef?.field);
        updatedFilters[col] = updatedFilters[col] || [];
        const startRow = Math.min(
          range.startRow.rowIndex,
          range.endRow.rowIndex,
        );
        const endRow = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
          const value = gridApi.getValue(
            column,
            gridApi.getModel().getRow(rowIndex),
          );
          if (!updatedFilters[col].includes(value)) {
            updatedFilters[col].push(value);
          }
        }
      });
    });

    setFilters(updatedFilters);
  };

  function getEmitTarget(col: string) {
    return formData.column_config?.[col]?.emitTarget || col;
  }

  function autoSizeFirst100Columns(params: any) {
    // Autosizes only the first 100 Columns in Ag-Grid
    const allColumnIds = params.columnApi
      .getAllColumns()
      .map((col: any) => col.getColId());
    params.columnApi.autoSizeColumns(allColumnIds.slice(0, 100), false);
  }

  const updatePageSize = (newSize: number) => {
    gridRef.current?.api?.paginationSetPageSize(newSize);
    setPageSize(newSize <= 0 ? 0 : newSize);
  };

  useEffect(() => {
    updatePageSize(page_length);
  }, [page_length]);

  function setSearch(e: ChangeEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    e.preventDefault();
    setSearchValue(target.value);
  }

  useEffect(() => {
    if (!include_search) {
      setSearchValue('');
    }
  }, [include_search]);

  const onColumnMoved = useCallback(e => {
    setControlValue('column_state', e.columnApi.getColumnState());
  }, []);

  const gridOptions = {
    suppressColumnVirtualisation: true,
    animateRows: true,
    // Disables a Key performance feature for Ag-Grid to enable autosizing of multiple columns
    // if not disabled, only the first 10-15 columns will autosize
    // This change will make initial load up of Ag-Grid slower than before
  };

  return (
    <div
      style={{ width, height, display: 'flex', flexFlow: 'column' }}
      className="ag-theme-balham"
    >
      <div
        className="form-inline"
        style={{ flex: '0 1 auto', paddingBottom: '0.5em' }}
      >
        <div className="row">
          <div className="col-sm-6">
            {page_length > 0 && (
              <span className="dt-select-page-size form-inline">
                Show{' '}
                <select
                  className="form-control input-sm"
                  value={pageSize}
                  onBlur={() => {}}
                  onChange={e => {
                    updatePageSize(
                      Number((e.target as HTMLSelectElement).value),
                    );
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map(option => {
                    const [size, text] = Array.isArray(option)
                      ? option
                      : [option, option];
                    return (
                      <option key={size} value={size}>
                        {text}
                      </option>
                    );
                  })}
                </select>{' '}
                entries
              </span>
            )}
          </div>
          <div className="col-sm-6">
            {include_search ? (
              <span className="float-right">
                Search{' '}
                <input
                  className="form-control input-sm"
                  placeholder={`${rowData.length} records...`}
                  value={searchValue}
                  onChange={setSearch}
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ flex: '1 1 auto' }}>
        <AgGridReact
          ref={gridRef}
          modules={AllModules}
          columnDefs={columnDefs}
          defaultColDef={DEFAULT_COLUMN_DEF}
          frameworkComponents={frameworkComponents}
          enableRangeSelection={true}
          allowContextMenuWithControlKey={true}
          gridOptions={gridOptions}
          onGridColumnsChanged={autoSizeFirst100Columns}
          getContextMenuItems={getContextMenuItems}
          onGridReady={onGridReady}
          onRangeSelectionChanged={onRangeSelectionChanged}
          onSelectionChanged={onSelectionChanged}
          rowData={rowData}
          paginationPageSize={pageSize}
          pagination={pageSize > 0}
          cacheQuickFilter={true}
          quickFilterText={searchValue}
          rowGroupPanelShow={enable_grouping ? 'always' : 'never'}
          onColumnMoved={onColumnMoved}
        />
      </div>
    </div>
  );
}
