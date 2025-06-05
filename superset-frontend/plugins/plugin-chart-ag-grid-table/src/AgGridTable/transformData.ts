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

import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import CustomHeader from './components/CustomHeader';
import CellBarRenderer from './components/CellbarRenderer';

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

type ValueRange = [number, number];

/**
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
  value,
  colorPositiveNegative = false,
}: {
  value: number;
  colorPositiveNegative: boolean;
}) {
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  return `rgba(${r},0,0,0.2)`;
}

function getValueRange(
  key: string,
  alignPositiveNegative: boolean,
  data: InputData[],
) {
  if (typeof data?.[0]?.[key] === 'number') {
    const nums = data.map(row => row[key]) as number[];
    return (
      alignPositiveNegative ? [0, d3Max(nums.map(Math.abs))] : d3Extent(nums)
    ) as ValueRange;
  }
  return null;
}

export const transformData = (
  columns: InputColumn[],
  data: InputData[],
  serverPagination: boolean,
  isRawRecords: boolean,
  defaultAlignPN: boolean,
  showCellBars: boolean,
  emitCrossFilters?: boolean,
) => {
  const colDefs: ColDef[] = columns.map(col => {
    const { config, isMetric, isPercentMetric } = col;
    const alignPositiveNegative =
      config.alignPositiveNegative === undefined
        ? defaultAlignPN
        : config.alignPositiveNegative;
    const valueRange =
      (config.showCellBars === undefined
        ? showCellBars
        : config.showCellBars) &&
      (isMetric || isRawRecords || isPercentMetric) &&
      getValueRange(col.key, alignPositiveNegative, data);

    return {
      field: col.key,
      headerName: col.label,
      ...(col?.config?.columnWidth && {
        minWidth: col?.config?.columnWidth,
      }),
      customMeta: {
        isMetric: col?.isMetric,
      },
      cellRenderer: ({ value }: { value: number }) => {
        const formattedValue = col?.formatter ? col?.formatter(value) : value;
        if (!valueRange) return formattedValue;
        const CellWidth = cellWidth({
          value: value as number,
          valueRange,
          alignPositiveNegative,
        });
        const CellOffset = cellOffset({
          value: value as number,
          valueRange,
          alignPositiveNegative,
        });
        const background = cellBackground({
          value: value as number,
          colorPositiveNegative: false,
        });

        return CellBarRenderer({
          value: formattedValue,
          percentage: CellWidth,
          offset: CellOffset,
          background,
        });
      },
      cellStyle: {
        textAlign:
          col?.config?.horizontalAlign || (col?.isNumeric ? 'right' : 'left'),
      },
      cellClass: params => {
        const isActiveFilterValue = params?.context?.isActiveFilterValue;
        let className = '';
        if (emitCrossFilters) {
          if (!col?.isMetric) {
            className += ' dt-is-filter';
          }
          if (isActiveFilterValue?.(col?.key, params?.value)) {
            className += ' dt-is-active-filter';
          }
          if (col?.config?.truncateLongCells) {
            className += ' dt-truncate-cell';
          }
        }
        return className;
      },
      sortable: !serverPagination || !col?.isPercentMetric,
      ...(serverPagination && {
        headerComponent: CustomHeader,
      }),
      filter: true,
      ...(serverPagination && {
        comparator: () => 0,
      }),
      valueFormatter: (params: ValueFormatterParams) => {
        if (!col?.formatter) return params?.value;
        const formattedVal = col?.formatter(params?.value);
        return formattedVal;
      },
      // Add number specific properties for numeric columns
      ...(col.isNumeric && {
        type: 'rightAligned',
        filter: 'agNumberColumnFilter',
        cellDataType: 'number',
      }),
    };
  });

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
