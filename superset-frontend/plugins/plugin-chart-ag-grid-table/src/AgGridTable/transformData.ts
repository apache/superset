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
import { DataRecord, GenericDataType } from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import CustomHeader from './components/CustomHeader';
import CellBarRenderer, {
  CellRenderer,
  TotalsRenderer,
} from './components/CellbarRenderer';

export interface InputColumn {
  key: string;
  label: string;
  dataType: number;
  isNumeric: boolean;
  isMetric: boolean;
  isPercentMetric: boolean;
  config: Record<string, any>;
  formatter?: Function;
  originalLabel?: string;
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

function renameMainKeys(data: Record<string, any>[]): Record<string, any>[] {
  return data.map(row => {
    const newRow: Record<string, any> = {};
    for (const key in row) {
      if (key.startsWith('Main ')) {
        const newKey = key.replace('Main ', '');
        newRow[newKey] = row[key];
      } else {
        newRow[key] = row[key];
      }
    }
    return newRow;
  });
}

function cleanTotals(totals: DataRecord) {
  const cleaned: DataRecord = {};

  for (const [key, value] of Object.entries(totals)) {
    if (key.includes('index')) {
      continue;
    }
    if (key.includes('Main')) {
      const newKey = key.replace('Main ', '');
      cleaned[newKey] = value;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
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
  if (!colorPositiveNegative) {
    return 'rgba(0,0,0,0.2)'; // transparent or neutral
  }

  const r = value < 0 ? 150 : 0;
  const g = value >= 0 ? 150 : 0;
  return `rgba(${r},${g},0,0.2)`;
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

function calculateMinWidth(headerName: string): number {
  const charCount = headerName.length === 1 ? 4 : headerName.length;
  const baseWidth = charCount * 8 + 32;
  return Math.max(baseWidth, 100);
}

export const transformData = (
  columns: InputColumn[],
  data: InputData[],
  serverPagination: boolean,
  isRawRecords: boolean,
  defaultAlignPN: boolean,
  showCellBars: boolean,
  colorPositiveNegative: boolean,
  totals: DataRecord | undefined,
  columnColorFormatters: ColorFormatters,
  allowRearrangeColumns?: boolean,
  emitCrossFilters?: boolean,
) => {
  const cleanedTotals = cleanTotals(totals || {});
  const colDefs: ColDef[] = columns.map(col => {
    const { config, isMetric, isPercentMetric, isNumeric } = col;
    const alignPositiveNegative =
      config.alignPositiveNegative === undefined
        ? defaultAlignPN
        : config.alignPositiveNegative;

    const hasColumnColorFormatters =
      isNumeric &&
      Array.isArray(columnColorFormatters) &&
      columnColorFormatters.length > 0;

    const valueRange =
      !hasColumnColorFormatters &&
      showCellBars &&
      (config.showCellBars || config.showCellBars === undefined) &&
      (isMetric || isRawRecords || isPercentMetric) &&
      getValueRange(col.key, alignPositiveNegative, data);

    const colId = col?.key.includes('Main')
      ? col?.key.replace('Main', '').trim()
      : col?.key;

    const headerLabel =
      col?.originalLabel && col?.key.includes('Main')
        ? col?.originalLabel
        : col.label;

    return {
      field: colId,
      headerName: headerLabel,
      ...(isPercentMetric && {
        filterValueGetter: params => {
          const raw = params.data[params.colDef.field as string];
          const formatter = params.colDef.valueFormatter as Function;
          if (!raw || !formatter) return null;
          const formatted = formatter({
            value: raw,
          });

          const numeric = parseFloat(String(formatted).replace('%', '').trim());
          return Number.isNaN(numeric) ? null : numeric;
        },
      }),
      ...(col?.dataType === GenericDataType.Temporal && {
        filterParams: {
          comparator: (filterDate: Date, cellValue: Date) => {
            const cellDate = new Date(cellValue);
            if (Number.isNaN(cellDate?.getTime())) return -1;

            const cellDay = cellDate.getDate();
            const cellMonth = cellDate.getMonth();
            const cellYear = cellDate.getFullYear();

            const filterDay = filterDate.getDate();
            const filterMonth = filterDate.getMonth();
            const filterYear = filterDate.getFullYear();

            if (cellYear < filterYear) return -1;
            if (cellYear > filterYear) return 1;
            if (cellMonth < filterMonth) return -1;
            if (cellMonth > filterMonth) return 1;
            if (cellDay < filterDay) return -1;
            if (cellDay > filterDay) return 1;

            return 0;
          },
        },
      }),

      minWidth: Math.max(
        calculateMinWidth(headerLabel),
        col?.config?.columnWidth || 0,
      ),
      customMeta: {
        isMetric: col?.isMetric,
        isPercentMetric: col?.isPercentMetric,
      },
      cellRenderer: (props: {
        value: number;
        valueFormatted: string;
        node: any;
        colDef: any;
      }) => {
        const { value, valueFormatted, node, colDef } = props;

        if (
          node?.rowPinned === 'bottom' &&
          value === undefined &&
          colDef?.field === columns[0].key
        ) {
          return TotalsRenderer({
            isSummaryText: true,
          });
        }

        if (node?.rowPinned === 'bottom') {
          return TotalsRenderer({
            value: valueFormatted,
          });
        }

        // Regular cell rendering logic
        if (!value) return null;
        let backgroundColor;
        if (hasColumnColorFormatters) {
          columnColorFormatters!
            .filter(formatter => formatter.column === colId)
            .forEach(formatter => {
              const formatterResult =
                value || value === 0
                  ? formatter.getColorFromValue(value as number)
                  : false;
              if (formatterResult) {
                backgroundColor = formatterResult;
              }
            });
        }
        const formattedValue = col?.formatter ? col?.formatter(value) : value;
        if (!valueRange)
          return CellRenderer({
            value: formattedValue,
            backgroundColor: backgroundColor || '',
          });
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
          colorPositiveNegative,
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
      lockPinned: !allowRearrangeColumns,
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
      ...(col?.originalLabel && {
        timeComparisonKey: col?.originalLabel,
        ...(col?.key &&
          col?.key.includes('Main') && {
            isMain: true,
          }),
      }),
      // Add number specific properties for numeric columns
      ...(col.isNumeric && {
        type: 'rightAligned',
        filter: 'agNumberColumnFilter',
        cellDataType: 'number',
      }),
      aggFunc: 'sum',
      cellRendererParams: {
        isTotalRow: true,
      },
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
    rowData: renameMainKeys(data),
    colDefs,
    defaultColDef,
    cleanedTotals,
  };
};
