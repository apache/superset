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
import { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import { useCallback, useMemo } from 'react';
import { DataRecordValue } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import {
  BasicColorFormatterType,
  CellRendererProps,
  InputColumn,
  ValueRange,
} from '../types';
import getCellClass from './getCellClass';
import filterValueGetter from './filterValueGetter';
import dateFilterComparator from './dateFilterComparator';
import DateWithFormatter from './DateWithFormatter';
import { getAggFunc } from './getAggFunc';
import { TextCellRenderer } from '../renderers/TextCellRenderer';
import { NumericCellRenderer } from '../renderers/NumericCellRenderer';
import CustomHeader from '../AgGridTable/components/CustomHeader';
import { NOOP_FILTER_COMPARATOR } from '../consts';
import { valueFormatter, valueGetter } from './formatValue';
import getCellStyle from './getCellStyle';

interface InputData {
  [key: string]: DataRecordValue;
}

type UseColDefsProps = {
  columns: InputColumn[];
  data: InputData[];
  serverPagination: boolean;
  isRawRecords: boolean;
  defaultAlignPN: boolean;
  showCellBars: boolean;
  colorPositiveNegative: boolean;
  columnColorFormatters: ColorFormatters;
  allowRearrangeColumns?: boolean;
  basicColorFormatters?: { [Key: string]: BasicColorFormatterType }[];
  isUsingTimeComparison?: boolean;
  emitCrossFilters?: boolean;
  alignPositiveNegative: boolean;
  slice_id: number;
};

function getValueRange(
  key: string,
  alignPositiveNegative: boolean,
  data: InputData[],
) {
  const nums = data
    .map(row => {
      const raw = row[key];
      return raw instanceof Number ? raw.valueOf() : raw;
    })
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    ) as number[];
  if (nums.length > 0) {
    const maxAbs = d3Max(nums.map(Math.abs));
    if (alignPositiveNegative) {
      return [0, maxAbs ?? 0] as ValueRange;
    }
    const extent = d3Extent(nums) as ValueRange | undefined;
    return extent ?? [0, 0];
  }
  return null;
}

const getCellDataType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'number';
    case GenericDataType.Temporal:
      return 'date';
    case GenericDataType.Boolean:
      return 'boolean';
    default:
      return 'text';
  }
};

const getFilterType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'agNumberColumnFilter';
    case GenericDataType.String:
      return 'agTextColumnFilter';
    case GenericDataType.Temporal:
      return 'agDateColumnFilter';
    default:
      return true;
  }
};

/**
 * Filter value getter for temporal columns.
 * Returns null for DateWithFormatter objects with null input,
 * enabling AG Grid's blank filter to correctly identify null dates.
 */
const dateFilterValueGetter = (params: {
  data: Record<string, unknown>;
  colDef: { field?: string };
}) => {
  const value = params.data?.[params.colDef.field as string];
  // Return null for DateWithFormatter with null input so AG Grid blank filter works
  if (value instanceof DateWithFormatter && value.input === null) {
    return null;
  }
  return value;
};

/**
 * Custom date filter options for server-side pagination.
 * Each option has a predicate that always returns true, allowing all rows to pass
 * client-side filtering since the actual filtering is handled by the server.
 */
const SERVER_SIDE_DATE_FILTER_OPTIONS = [
  {
    displayKey: 'serverEquals',
    displayName: 'Equals',
    predicate: () => true,
    numberOfInputs: 1,
  },
  {
    displayKey: 'serverNotEqual',
    displayName: 'Not Equal',
    predicate: () => true,
    numberOfInputs: 1,
  },
  {
    displayKey: 'serverBefore',
    displayName: 'Before',
    predicate: () => true,
    numberOfInputs: 1,
  },
  {
    displayKey: 'serverAfter',
    displayName: 'After',
    predicate: () => true,
    numberOfInputs: 1,
  },
  {
    displayKey: 'serverInRange',
    displayName: 'In Range',
    predicate: () => true,
    numberOfInputs: 2,
  },
  {
    displayKey: 'serverBlank',
    displayName: 'Blank',
    predicate: () => true,
    numberOfInputs: 0,
  },
  {
    displayKey: 'serverNotBlank',
    displayName: 'Not blank',
    predicate: () => true,
    numberOfInputs: 0,
  },
];

function getHeaderLabel(col: InputColumn) {
  let headerLabel: string | undefined;

  const hasOriginalLabel = !!col?.originalLabel;
  const isMain = col?.key?.includes('Main');
  const hasDisplayTypeIcon = col?.config?.displayTypeIcon !== false;
  const hasCustomColumnName = !!col?.config?.customColumnName;

  if (hasOriginalLabel && hasCustomColumnName) {
    if ('displayTypeIcon' in col.config) {
      headerLabel =
        hasDisplayTypeIcon && !isMain
          ? `${col.label} ${col.config.customColumnName}`
          : col.config.customColumnName;
    } else {
      headerLabel = col.config.customColumnName;
    }
  } else if (hasOriginalLabel && isMain) {
    headerLabel = col.originalLabel;
  } else if (hasOriginalLabel && !hasDisplayTypeIcon) {
    headerLabel = '';
  } else {
    headerLabel = col?.label;
  }
  return headerLabel || '';
}

export const useColDefs = ({
  columns,
  data,
  serverPagination,
  isRawRecords,
  defaultAlignPN,
  showCellBars,
  colorPositiveNegative,
  columnColorFormatters,
  allowRearrangeColumns,
  basicColorFormatters,
  isUsingTimeComparison,
  emitCrossFilters,
  alignPositiveNegative,
  slice_id,
}: UseColDefsProps) => {
  const getCommonColProps = useCallback(
    (
      col: InputColumn,
    ): ColDef & {
      isMain: boolean;
    } => {
      const {
        config,
        isMetric,
        isPercentMetric,
        isNumeric,
        key: originalKey,
        dataType,
        originalLabel,
      } = col;

      const alignPN =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;

      const isMain = originalKey?.includes('Main');
      const colId = isMain
        ? originalKey.replace('Main', '').trim()
        : originalKey;
      const isTextColumn =
        dataType === GenericDataType.String ||
        dataType === GenericDataType.Temporal;

      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        showCellBars &&
        (config.showCellBars ?? true) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(originalKey, alignPN || alignPositiveNegative, data);

      const filter = getFilterType(col);

      return {
        field: colId,
        headerName: getHeaderLabel(col),
        valueFormatter: p => valueFormatter(p, col),
        valueGetter: p => valueGetter(p, col),
        cellStyle: p =>
          getCellStyle({
            ...p,
            hasColumnColorFormatters,
            columnColorFormatters,
            hasBasicColorFormatters,
            basicColorFormatters,
            col,
          }),
        cellClass: p =>
          getCellClass({
            ...p,
            col,
            emitCrossFilters,
          }),
        minWidth: config?.columnWidth ?? 100,
        filter,
        ...(isPercentMetric && {
          filterValueGetter,
        }),
        ...(dataType === GenericDataType.Temporal && {
          // Use dateFilterValueGetter so AG Grid correctly identifies null dates for blank filter
          filterValueGetter: dateFilterValueGetter,
          filterParams: serverPagination
            ? {
                filterOptions: SERVER_SIDE_DATE_FILTER_OPTIONS,
                comparator: NOOP_FILTER_COMPARATOR,
              }
            : {
                comparator: dateFilterComparator,
              },
        }),
        cellDataType: getCellDataType(col),
        defaultAggFunc: getAggFunc(col),
        initialAggFunc: getAggFunc(col),
        ...(!(isMetric || isPercentMetric) && {
          allowedAggFuncs: [
            'sum',
            'min',
            'max',
            'count',
            'avg',
            'first',
            'last',
          ],
        }),
        cellRenderer: (p: CellRendererProps) =>
          isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p),
        cellRendererParams: {
          allowRenderHtml: true,
          columns,
          hasBasicColorFormatters,
          col,
          basicColorFormatters,
          valueRange,
          alignPositiveNegative: alignPN || alignPositiveNegative,
          colorPositiveNegative,
        },
        context: {
          isMetric,
          isPercentMetric,
          isNumeric,
        },
        lockPinned: !allowRearrangeColumns,
        sortable: !serverPagination || !isPercentMetric,
        ...(serverPagination && {
          headerComponent: CustomHeader,
          comparator: () => 0,
          headerComponentParams: {
            slice_id,
          },
        }),
        isMain,
        ...(!isMain &&
          originalLabel && {
            columnGroupShow: 'open',
          }),
        ...(originalLabel && {
          timeComparisonKey: originalLabel,
        }),
        wrapText: !config?.truncateLongCells,
        autoHeight: !config?.truncateLongCells,
      };
    },
    [
      columns,
      data,
      defaultAlignPN,
      columnColorFormatters,
      basicColorFormatters,
      showCellBars,
      colorPositiveNegative,
      isUsingTimeComparison,
      isRawRecords,
      emitCrossFilters,
      allowRearrangeColumns,
      serverPagination,
      alignPositiveNegative,
    ],
  );

  const stringifiedCols = JSON.stringify(columns);

  const colDefs = useMemo(() => {
    const groupIndexMap = new Map<string, number>();

    return columns.reduce<ColDef[]>((acc, col) => {
      const colDef = getCommonColProps(col);

      if (col?.originalLabel) {
        if (groupIndexMap.has(col.originalLabel)) {
          const groupIdx = groupIndexMap.get(col.originalLabel)!;
          (acc[groupIdx] as { children: ColDef[] }).children.push(colDef);
        } else {
          const group = {
            headerName: col.originalLabel,
            marryChildren: true,
            openByDefault: true,
            children: [colDef],
          };
          groupIndexMap.set(col.originalLabel, acc.length);
          acc.push(group);
        }
      } else {
        acc.push(colDef);
      }

      return acc;
    }, []);
  }, [stringifiedCols, getCommonColProps]);

  return colDefs;
};
