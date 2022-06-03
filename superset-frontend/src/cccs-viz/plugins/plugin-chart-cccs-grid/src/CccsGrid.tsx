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
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
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
  selectedValues,
  tooltipShowDelay,
  rowSelection,
  emitFilter,
  include_search,
  filters: initialFilters = {},
}: CccsGridTransformedProps) {
  LicenseManager.setLicenseKey(agGridLicenseKey);

  const [filters, setFilters] = useState(initialFilters);

  const [prevRow, setPrevRow] = useState(-1);
  const [prevColumn, setPrevColumn] = useState('');
  const [searchValue, setSearchValue] = useState('');

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
            action: () => handleChange(filters),
            icon: '<img src="./images/emit_filters.png" />',
          },
          'separator',
          'export',
        ];
      }
      return result;
    },
    [emitFilter, filters, handleChange],
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
    console.log('onGridReady called');
  };

  const onSelectionChanged = (params: any) => {
    const gridApi = params.api;
    const selectedRows = gridApi.getSelectedRows();
    gridApi.document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].athlete : '';
  };

  function isSingleCellSelection(cellRanges: any): boolean {
    if (cellRanges.length !== 1) {
      return false;
    }
    const range = cellRanges[0];
    return (
      range.startRow.rowIndex === range.endRow.rowIndex &&
      range.columns.length === 1
    );
  }

  function isSameSingleSelection(range: any): boolean {
    const singleRow = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
    return prevRow === singleRow && prevColumn === range.columns[0].colId;
  }

  function cacheSingleSelection(range: any) {
    const singleRow = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
    setPrevRow(singleRow);
    setPrevColumn(range.columns[0].colId);
  }

  function clearSingleSelection() {
    setPrevRow(-1);
    setPrevColumn(NULL_STRING);
  }

  const onRangeSelectionChanged = (params: any) => {
    if (params.finished === false) {
      return;
    }

    const gridApi = params.api;
    let cellRanges = gridApi.getCellRanges();
    if (isSingleCellSelection(cellRanges)) {
      // Did user re-select the same single cell
      if (isSameSingleSelection(cellRanges[0])) {
        // clear selection in ag-grid
        gridApi.clearRangeSelection();
        // new cell ranges should be empty now
        cellRanges = gridApi.getCellRanges();
        // Clear previous selection
        clearSingleSelection();
      } else {
        // remember the single cell selection
        cacheSingleSelection(cellRanges[0]);
      }
    }

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

  const gridOptions = {
    suppressColumnVirtualisation: true,
    animateRows: true,
    // Disables a Key performance feature for Ag-Grid to enable autosizing of multiple columns
    // if not disabled, only the first 10-15 columns will autosize
    // This change will make initial load up of Ag-Grid slower than before
  };

  return (
    <div style={{ width, height }} className="ag-theme-balham">
      {include_search ? (
        <div className="form-inline" style={{ paddingBottom: '0.5em' }}>
          <div className="row">
            <div className="col-sm-6" />
            <div className="col-sm-6">
              <span className="float-right">
                Search{' '}
                <input
                  className="form-control input-sm"
                  placeholder={`${rowData.length} records...`}
                  value={searchValue}
                  onChange={setSearch}
                />
              </span>
            </div>
          </div>
        </div>
      ) : null}
      <AgGridReact
        modules={AllModules}
        columnDefs={columnDefs}
        defaultColDef={DEFAULT_COLUMN_DEF}
        frameworkComponents={frameworkComponents}
        enableRangeSelection
        allowContextMenuWithControlKey
        gridOptions={gridOptions}
        onGridColumnsChanged={autoSizeFirst100Columns}
        getContextMenuItems={getContextMenuItems}
        onGridReady={onGridReady}
        onRangeSelectionChanged={onRangeSelectionChanged}
        onSelectionChanged={onSelectionChanged}
        rowData={rowData}
        cacheQuickFilter
        quickFilterText={searchValue}
        rowGroupPanelShow="always"
      />
    </div>
  );
}
