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
import React, { useCallback, useState } from 'react';
//import { styled } from '@superset-ui/core';
import { CccsGridProps } from './types';


import CountryValueRenderer from './CountryValueRenderer';
import Ipv4ValueRenderer from './Ipv4ValueRenderer';
import Ipv6ValueRenderer from './Ipv6ValueRenderer';
import DomainValueRenderer from './DomainValueRenderer';
import CustomTooltip from './CustomTooltip';



//// jcc

//'use strict';

import { AgGridReact } from '@ag-grid-community/react';
import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';

import { AllModules } from "@ag-grid-enterprise/all-modules";

const DEFAULT_COLUMN_DEF = {
  flex: 1,
  minWidth: 100,
  editable: true,
  sortable: true,
  filter: true,
  resizable: true,
  tooltipField: '',
  tooltipComponent: 'customTooltip',
};


export default function CccsGrid({
  width,
  height,
  columnDefs,
  rowData,
  formData,
  setDataMask,
  selectedValues,
  tooltipShowDelay,
  rowSelection,
  emitFilter = false,
  filters: initialFilters = {},
}: CccsGridProps) {

  const [filters, setFilters] = useState(initialFilters);
  const handleChange = useCallback(filters => {
    if (!emitFilter) {
      return;
    }

    const groupBy = Object.keys(filters);
    const groupByValues = Object.values(filters);
    setDataMask({
      extraFormData: {
        filters: groupBy.length === 0 ? [] : groupBy.map(col => {
          const val = filters == null ? void 0 : filters[col];
          if (val === null || val === undefined) return {
            col,
            op: 'IS NULL'
          };
          return {
            col,
            op: 'IN',
            val: val
          };
        })
      },
      filterState: {
        value: groupByValues.length ? groupByValues : null
      }
    });
  }, [emitFilter, setDataMask]); // only take relevant page size options

  const isActiveFilterValue = useCallback(function isActiveFilterValue(key, val) {
    var _filters$key;

    return !!filters && ((_filters$key = filters[key]) == null ? void 0 : _filters$key.includes(val));
  }, [filters]);
  const toggleFilter = useCallback(function toggleFilter(key, val) {
    const updatedFilters = {
      ...(filters || {})
    };

    if (filters && isActiveFilterValue(key, val)) {
      updatedFilters[key] = filters[key].filter((x: any) => x !== val);
    } else {
      updatedFilters[key] = [...((filters == null ? void 0 : filters[key]) || []), val];
    }

    if (Array.isArray(updatedFilters[key]) && updatedFilters[key].length === 0) {
      delete updatedFilters[key];
    }

    setFilters(updatedFilters);
    handleChange(updatedFilters);
  }, [filters, handleChange, isActiveFilterValue]);

















  // getContextMenuItems = (params) => {
  //   var result = [
  //     {
  //       name: 'GWWK of IP: 23.56.24.67',
  //       action: function () {
  //         window.open('http://10.162.232.22:8000/gwwk.html', '_self');
  //       },
  //       cssClasses: ['redFont', 'bold'],
  //     },
  //     {
  //       name: 'Launch GWWK for domain: subsurface.com',
  //       action: function () {
  //         window.open('http://10.162.232.22:8000/gwwk.html', '_blank');
  //       },
  //       cssClasses: ['redFont', 'bold'],
  //     },
  //   ];
  //   return result;
  // };



  const frameworkComponents = {
    countryValueRenderer: CountryValueRenderer,
    ipv4ValueRenderer: Ipv4ValueRenderer,
    ipv6ValueRenderer: Ipv6ValueRenderer,
    domainValueRenderer: DomainValueRenderer,
    customTooltip: CustomTooltip,
  };

  const onGridReady = (params: any) => {
    console.log('onGridReady called');
    params.api.forceUpdate();
  };

  const onSelectionChanged = (params: any) => {
    const gridApi = params.api;
    var selectedRows = gridApi.getSelectedRows();
    gridApi.document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].athlete : '';
  };

  let prevStartRow = undefined;
  let prevEndRow = undefined;
  let prevColumn = undefined;

  const onRangeSelectionChanged = (params: any) => {
    if(params.finished == false){
      return;
    }

    const gridApi = params.api;
    const cellRanges = gridApi.getCellRanges();
    //gridApi.clearRangeSelection()
    console.log(`started ${params.started}`)
    console.log(`finished ${params.finished}`)
    console.log(`ranges ${cellRanges.length}`)
    
    cellRanges.forEach((range: any) => {
      // get starting and ending row, remember rowEnd could be before rowStart
      const startRow = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
      const endRow = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);
      prevStartRow = startRow;
      prevEndRow = endRow;

      for (var rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        range.columns.forEach((column: any) => {
          const cellRenderer = column.colDef?.cellRenderer;
          console.log(`rowIndex: ${rowIndex} col: ${column.colDef?.field}`)
          prevColumn = column.colDef?.field
          if (cellRenderer == 'ipv4ValueRenderer') {
            const rowModel = gridApi.getModel();
            const rowNode = rowModel.getRow(rowIndex);
            const value = gridApi.getValue(column, rowNode);
            const col = getEmmitingTarget(column.colDef?.field)
            toggleFilter(col, value);
          }
        });
      }
    });
  }

  function getEmmitingTarget(col: string) {
    return formData.columnConfig?.[col]?.emittingTarget || col;
  }

  return (
    <div style={{ width, height }} className="ag-theme-balham" >
      <AgGridReact
        modules={AllModules}
        columnDefs={columnDefs}
        defaultColDef={DEFAULT_COLUMN_DEF}
        frameworkComponents={frameworkComponents}
        enableRangeSelection={true}
        allowContextMenuWithControlKey={true}
        //getContextMenuItems={getContextMenuItems}
        onGridReady={onGridReady}
        onRangeSelectionChanged={onRangeSelectionChanged}
        onSelectionChanged={onSelectionChanged}
        rowData={rowData}
      />
    </div>
  );
}
