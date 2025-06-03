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

import { ValueFormatterParams } from 'ag-grid-community';
import CustomHeader from './components/CustomHeader';

export interface InputColumn {
  key: string;
  label: string;
  dataType: number;
  isNumeric: boolean;
  isMetric: boolean;
  isPercentMetric: boolean;
  config: Record<string, any>;
  formatter?: Function;
}

interface InputData {
  [key: string]: any;
}

export const transformData = (
  columns: InputColumn[],
  data: InputData[],
  serverPagination: boolean,
) => {
  const colDefs = columns.map(col => ({
    field: col.key,
    headerName: col.label,
    sortable: !serverPagination || !col?.isPercentMetric,
    ...(serverPagination && {
      headerComponent: CustomHeader,
    }),
    filter: true,
    ...(serverPagination && {
      comparator: () => 0,
    }),
    ...(col.isPercentMetric && {
      valueFormatter: (params: ValueFormatterParams) => {
        if (!col?.formatter) return params?.value;
        const formattedVal = col?.formatter(params?.value);
        return formattedVal;
      },
    }),
    // Add number specific properties for numeric columns
    ...(col.isNumeric && {
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      cellDataType: 'number',
    }),
  }));

  // Default column definition
  const defaultColDef = {
    flex: 1,
    filter: true,
    enableRowGroup: true,
    enableValue: true,
    sortable: true,
    resizable: true,
    minWidth: 100,
  };

  return {
    rowData: data,
    colDefs,
    defaultColDef,
  };
};
