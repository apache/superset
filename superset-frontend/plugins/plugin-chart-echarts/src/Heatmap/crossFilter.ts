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
import { GenericDataType } from '@apache-superset/core/common';
import {
  DataRecordValue,
  getColumnLabel,
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { NULL_STRING } from '../constants';
import { formatSeriesName } from '../utils/series';

export const EMPTY_STRING = '<empty string>';

/**
 * Identity of one dimension value. JSON keeps `null`, `''`, `42`,
 * `"42"`, and `42n` apart, so they stay separate cells and separate clicks.
 */
export function heatmapValueId(value?: DataRecordValue): string {
  if (value == null) {
    return JSON.stringify(null);
  }
  if (typeof value === 'bigint') {
    return JSON.stringify({ bigint: value.toString() });
  }
  if (value instanceof Date) {
    return JSON.stringify({ date: value.toISOString() });
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

/**
 * Stable composite key identifying a heatmap cell, stored in
 * `filterState.selectedValues`.
 */
export function heatmapCellKey(
  xValue?: DataRecordValue,
  yValue?: DataRecordValue,
): string {
  return JSON.stringify([
    'cell',
    heatmapValueId(xValue),
    heatmapValueId(yValue),
  ]);
}

/**
 * Defensively extracts selected heatmap cell keys from filterState.selectedValues.
 */
export function getSelectedHeatmapKeys(selectedValues: unknown): string[] {
  if (!selectedValues) {
    return [];
  }
  if (Array.isArray(selectedValues)) {
    return selectedValues.map(value => String(value));
  }
  if (typeof selectedValues === 'object') {
    return Object.values(selectedValues as Record<string, unknown>).map(value =>
      String(value),
    );
  }
  return [];
}

/**
 * BigInt throws in JSON.stringify; convert to string for extraFormData.
 */
export function toJsonSafeFilterValue(
  value: Exclude<DataRecordValue, null>,
): Exclude<DataRecordValue, null | bigint> {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Formats a dimension value for display on the cross-filter chip.
 */
export function formatHeatmapValue(
  value?: DataRecordValue,
  col?: QueryFormColumn | QueryFormColumn[],
  coltypeMapping?: Record<string, GenericDataType>,
): string {
  if (value == null) {
    return NULL_STRING;
  }
  if (value === '') {
    return EMPTY_STRING;
  }
  const column = Array.isArray(col) ? col[0] : col;
  return formatSeriesName(value, {
    timeFormatter: getTimeFormatter(),
    coltype: column ? coltypeMapping?.[getColumnLabel(column)] : undefined,
  });
}

function dimensionFilter(
  col: QueryFormColumn,
  value: DataRecordValue,
): QueryObjectFilterClause {
  if (value == null) {
    return { col, op: 'IS NULL' };
  }
  return {
    col,
    op: 'IN',
    val: [toJsonSafeFilterValue(value)],
  };
}

export function getHeatmapCrossFilterDataMask({
  xColumn,
  yColumn,
  xValue,
  yValue,
  selectedKeys,
  coltypeMapping,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue: DataRecordValue;
  yValue: DataRecordValue;
  selectedKeys: string[];
  coltypeMapping?: Record<string, GenericDataType>;
}) {
  const resolvedXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const resolvedYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;
  const key = heatmapCellKey(xValue, yValue);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const nextKeys = isCurrentValueSelected ? [] : [key];
  const xFormatted = formatHeatmapValue(
    xValue,
    resolvedXColumn,
    coltypeMapping,
  );
  const yFormatted = formatHeatmapValue(
    yValue,
    resolvedYColumn,
    coltypeMapping,
  );
  const label = `${xFormatted} (${yFormatted})`;

  if (nextKeys.length === 0) {
    return {
      dataMask: {
        extraFormData: {
          filters: [],
        },
        filterState: {
          label: null,
          value: null,
          selectedValues: null,
        },
      },
      isCurrentValueSelected,
    };
  }

  const filters: QueryObjectFilterClause[] = [];
  const isSameColumn =
    resolvedXColumn &&
    resolvedYColumn &&
    getColumnLabel(resolvedXColumn) === getColumnLabel(resolvedYColumn);
  const isSameValue = xValue === yValue || (xValue == null && yValue == null);

  if (isSameColumn && isSameValue) {
    filters.push(dimensionFilter(resolvedXColumn, xValue));
  } else {
    if (resolvedXColumn) {
      filters.push(dimensionFilter(resolvedXColumn, xValue));
    }
    if (resolvedYColumn) {
      filters.push(dimensionFilter(resolvedYColumn, yValue));
    }
  }

  return {
    dataMask: {
      extraFormData: {
        filters,
      },
      filterState: {
        label,
        value: label,
        selectedValues: nextKeys,
      },
    },
    isCurrentValueSelected,
  };
}

function buildHeatmapDrillFilterClause(
  col: QueryFormColumn,
  value?: DataRecordValue,
  coltypeMapping?: Record<string, GenericDataType>,
): QueryObjectFilterClause {
  const formattedVal = formatHeatmapValue(value, col, coltypeMapping);
  if (value == null) {
    return {
      col,
      op: 'IS NULL',
      formattedVal,
    };
  }
  return {
    col,
    op: '==',
    val: toJsonSafeFilterValue(value),
    formattedVal,
  };
}

export function getHeatmapDrillFilters({
  xColumn,
  yColumn,
  xValue,
  yValue,
  coltypeMapping,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue?: DataRecordValue;
  yValue?: DataRecordValue;
  coltypeMapping?: Record<string, GenericDataType>;
}): QueryObjectFilterClause[] {
  const resolvedXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const resolvedYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;

  const filters: QueryObjectFilterClause[] = [];
  const isSameColumn =
    resolvedXColumn &&
    resolvedYColumn &&
    getColumnLabel(resolvedXColumn) === getColumnLabel(resolvedYColumn);
  const isSameValue = xValue === yValue || (xValue == null && yValue == null);

  if (isSameColumn && isSameValue) {
    filters.push(
      buildHeatmapDrillFilterClause(resolvedXColumn, xValue, coltypeMapping),
    );
  } else {
    if (resolvedXColumn) {
      filters.push(
        buildHeatmapDrillFilterClause(resolvedXColumn, xValue, coltypeMapping),
      );
    }
    if (resolvedYColumn) {
      filters.push(
        buildHeatmapDrillFilterClause(resolvedYColumn, yValue, coltypeMapping),
      );
    }
  }

  return filters;
}

export function getHeatmapDrillByFilters({
  xColumn,
  yColumn,
  xValue,
  yValue,
  coltypeMapping,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue?: DataRecordValue;
  yValue?: DataRecordValue;
  coltypeMapping?: Record<string, GenericDataType>;
}): {
  filters: QueryObjectFilterClause[];
  xAxisFilters: QueryObjectFilterClause[];
  groupbyFieldName: string;
} {
  const resolvedXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const resolvedYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;

  const filters: QueryObjectFilterClause[] = [];
  if (resolvedYColumn) {
    filters.push(
      buildHeatmapDrillFilterClause(resolvedYColumn, yValue, coltypeMapping),
    );
  }

  const xAxisFilters: QueryObjectFilterClause[] = [];
  if (resolvedXColumn) {
    xAxisFilters.push(
      buildHeatmapDrillFilterClause(resolvedXColumn, xValue, coltypeMapping),
    );
  }

  return {
    filters,
    xAxisFilters,
    groupbyFieldName: 'groupby',
  };
}
