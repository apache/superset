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
  DTTM_ALIAS,
  getColumnLabel,
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { NULL_STRING } from '../constants';
import { formatSeriesName } from '../utils/series';
import {
  formatNaiveDateTime,
  getTemporalBucketDrillByFilter,
  getTimeBucketRange,
  parseTemporalValue,
} from '../utils/xAxisDrillByFilter';

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
 * Resolves virtual timestamp alias to active datasource granularity column.
 */
export function resolveColumn(
  col: QueryFormColumn,
  granularitySqla?: string,
): QueryFormColumn;
export function resolveColumn(
  col?: QueryFormColumn,
  granularitySqla?: string,
): QueryFormColumn | undefined;
export function resolveColumn(
  col?: QueryFormColumn,
  granularitySqla?: string,
): QueryFormColumn | undefined {
  if (!col) {
    return col;
  }
  if (getColumnLabel(col) === DTTM_ALIAS && granularitySqla) {
    return granularitySqla;
  }
  return col;
}

/**
 * Determines whether a column is temporal using DTTM_ALIAS, type mapping, or granularitySqla.
 */
export function isTemporalColumn(
  col?: QueryFormColumn,
  coltypeMapping?: Record<string, GenericDataType>,
  granularitySqla?: string,
): boolean {
  if (!col) {
    return false;
  }
  const label = getColumnLabel(col);
  if (label === DTTM_ALIAS) {
    return true;
  }
  if (coltypeMapping?.[label] === GenericDataType.Temporal) {
    return true;
  }
  if (
    granularitySqla &&
    (label === granularitySqla ||
      coltypeMapping?.[granularitySqla] === GenericDataType.Temporal)
  ) {
    return true;
  }
  return false;
}

/**
 * Formats a dimension value for display on the cross-filter chip or drill filter.
 */
export function formatHeatmapValue(
  value?: DataRecordValue,
  col?: QueryFormColumn | QueryFormColumn[],
  coltypeMapping?: Record<string, GenericDataType>,
  timeGrain?: TimeGranularity,
  granularitySqla?: string,
): string {
  if (value == null) {
    return NULL_STRING;
  }
  if (value === '') {
    return EMPTY_STRING;
  }
  const column = Array.isArray(col) ? col[0] : col;
  const rawColtype = column
    ? coltypeMapping?.[getColumnLabel(column)]
    : undefined;
  const isTemporal =
    isTemporalColumn(column, coltypeMapping, granularitySqla) ||
    rawColtype === GenericDataType.Temporal;
  const coltype = isTemporal ? GenericDataType.Temporal : rawColtype;
  return formatSeriesName(value, {
    timeFormatter: isTemporal
      ? getTimeFormatter(undefined, timeGrain)
      : getTimeFormatter(),
    coltype,
  });
}

export type HeatmapCrossFilterDataMaskResult = {
  dataMask: {
    extraFormData: {
      filters: QueryObjectFilterClause[];
      time_range?: string;
    };
    filterState: {
      label: string | null;
      value: string | null;
      selectedValues: string[] | null;
    };
  };
  isCurrentValueSelected: boolean;
};

export function getHeatmapCrossFilterDataMask({
  xColumn,
  yColumn,
  xValue,
  yValue,
  selectedKeys,
  coltypeMapping,
  timeGrain,
  timeGrainSqla,
  granularitySqla,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue: DataRecordValue;
  yValue: DataRecordValue;
  selectedKeys: string[];
  coltypeMapping?: Record<string, GenericDataType>;
  timeGrain?: TimeGranularity;
  timeGrainSqla?: TimeGranularity;
  granularitySqla?: string;
}): HeatmapCrossFilterDataMaskResult {
  const rawXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const rawYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;
  const resolvedXColumn = resolveColumn(rawXColumn, granularitySqla);
  const resolvedYColumn = resolveColumn(rawYColumn, granularitySqla);
  const effectiveTimeGrain = timeGrain ?? timeGrainSqla;

  const key = heatmapCellKey(xValue, yValue);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const nextKeys = isCurrentValueSelected ? [] : [key];
  const xFormatted = formatHeatmapValue(
    xValue,
    resolvedXColumn,
    coltypeMapping,
    effectiveTimeGrain,
    granularitySqla,
  );
  const yFormatted = formatHeatmapValue(
    yValue,
    resolvedYColumn,
    coltypeMapping,
    effectiveTimeGrain,
    granularitySqla,
  );
  const label = `${xFormatted} (${yFormatted})`;

  if (nextKeys.length === 0) {
    const extraFormData: {
      filters: QueryObjectFilterClause[];
      time_range?: string;
    } = {
      filters: [],
    };
    return {
      dataMask: {
        extraFormData,
        filterState: {
          label: null,
          value: null,
          selectedValues: null,
        },
      },
      isCurrentValueSelected,
    };
  }

  function buildCrossFilterClause(
    col: QueryFormColumn,
    value: DataRecordValue,
  ): { filter: QueryObjectFilterClause; timeRange?: string } {
    if (value == null) {
      return {
        filter: { col, op: 'IS NULL' },
      };
    }
    const isTemporal = isTemporalColumn(col, coltypeMapping, granularitySqla);
    if (isTemporal && effectiveTimeGrain) {
      const bucketLabel = parseTemporalValue(value);
      const range = bucketLabel
        ? getTimeBucketRange(bucketLabel, effectiveTimeGrain)
        : undefined;
      if (range) {
        const val = `${formatNaiveDateTime(range.since)} : ${formatNaiveDateTime(range.until)}`;
        return {
          filter: { col, op: 'TEMPORAL_RANGE', val },
          timeRange: val,
        };
      }
    }
    return {
      filter: {
        col,
        op: 'IN',
        val: [toJsonSafeFilterValue(value)],
      },
    };
  }

  const filters: QueryObjectFilterClause[] = [];
  let timeRange: string | undefined;

  const isSameColumn =
    resolvedXColumn &&
    resolvedYColumn &&
    getColumnLabel(resolvedXColumn) === getColumnLabel(resolvedYColumn);
  const isSameValue = xValue === yValue || (xValue == null && yValue == null);

  if (isSameColumn && isSameValue) {
    if (resolvedXColumn) {
      const clause = buildCrossFilterClause(resolvedXColumn, xValue);
      filters.push(clause.filter);
      if (clause.timeRange) {
        timeRange = clause.timeRange;
      }
    }
  } else {
    if (resolvedXColumn) {
      const clauseX = buildCrossFilterClause(resolvedXColumn, xValue);
      filters.push(clauseX.filter);
      if (clauseX.timeRange) {
        timeRange = clauseX.timeRange;
      }
    }
    if (resolvedYColumn) {
      const clauseY = buildCrossFilterClause(resolvedYColumn, yValue);
      filters.push(clauseY.filter);
      if (clauseY.timeRange) {
        timeRange = timeRange ?? clauseY.timeRange;
      }
    }
  }

  const extraFormData: {
    filters: QueryObjectFilterClause[];
    time_range?: string;
  } = {
    filters,
    ...(timeRange && { time_range: timeRange }),
  };

  return {
    dataMask: {
      extraFormData,
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
  effectiveTimeGrain?: TimeGranularity,
  granularitySqla?: string,
): QueryObjectFilterClause {
  const resolvedCol = resolveColumn(col, granularitySqla) ?? col;
  const formattedVal = formatHeatmapValue(
    value,
    resolvedCol,
    coltypeMapping,
    effectiveTimeGrain,
    granularitySqla,
  );
  if (value == null) {
    return {
      col: resolvedCol,
      op: 'IS NULL',
      formattedVal,
    };
  }
  const isTemporal = isTemporalColumn(
    resolvedCol,
    coltypeMapping,
    granularitySqla,
  );
  if (isTemporal) {
    const temporalFilter = getTemporalBucketDrillByFilter(
      resolvedCol,
      value,
      effectiveTimeGrain,
      formattedVal,
    );
    if (temporalFilter) {
      return temporalFilter;
    }
  }
  return {
    col: resolvedCol,
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
  timeGrain,
  timeGrainSqla,
  granularitySqla,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue?: DataRecordValue;
  yValue?: DataRecordValue;
  coltypeMapping?: Record<string, GenericDataType>;
  timeGrain?: TimeGranularity;
  timeGrainSqla?: TimeGranularity;
  granularitySqla?: string;
}): QueryObjectFilterClause[] {
  const rawXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const rawYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;
  const resolvedXColumn = resolveColumn(rawXColumn, granularitySqla);
  const resolvedYColumn = resolveColumn(rawYColumn, granularitySqla);
  const effectiveTimeGrain = timeGrain ?? timeGrainSqla;

  const filters: QueryObjectFilterClause[] = [];
  const isSameColumn =
    resolvedXColumn &&
    resolvedYColumn &&
    getColumnLabel(resolvedXColumn) === getColumnLabel(resolvedYColumn);
  const isSameValue = xValue === yValue || (xValue == null && yValue == null);

  if (isSameColumn && isSameValue) {
    if (resolvedXColumn) {
      filters.push(
        buildHeatmapDrillFilterClause(
          resolvedXColumn,
          xValue,
          coltypeMapping,
          effectiveTimeGrain,
          granularitySqla,
        ),
      );
    }
  } else {
    if (resolvedXColumn) {
      filters.push(
        buildHeatmapDrillFilterClause(
          resolvedXColumn,
          xValue,
          coltypeMapping,
          effectiveTimeGrain,
          granularitySqla,
        ),
      );
    }
    if (resolvedYColumn) {
      filters.push(
        buildHeatmapDrillFilterClause(
          resolvedYColumn,
          yValue,
          coltypeMapping,
          effectiveTimeGrain,
          granularitySqla,
        ),
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
  timeGrain,
  timeGrainSqla,
  granularitySqla,
}: {
  xColumn?: QueryFormColumn | QueryFormColumn[];
  yColumn?: QueryFormColumn | QueryFormColumn[];
  xValue?: DataRecordValue;
  yValue?: DataRecordValue;
  coltypeMapping?: Record<string, GenericDataType>;
  timeGrain?: TimeGranularity;
  timeGrainSqla?: TimeGranularity;
  granularitySqla?: string;
}): {
  filters: QueryObjectFilterClause[];
  xAxisFilters: QueryObjectFilterClause[];
  groupbyFieldName: string;
} {
  const rawXColumn = Array.isArray(xColumn) ? xColumn[0] : xColumn;
  const rawYColumn = Array.isArray(yColumn) ? yColumn[0] : yColumn;
  const resolvedXColumn = resolveColumn(rawXColumn, granularitySqla);
  const resolvedYColumn = resolveColumn(rawYColumn, granularitySqla);
  const effectiveTimeGrain = timeGrain ?? timeGrainSqla;

  const filters: QueryObjectFilterClause[] = [];
  if (resolvedYColumn) {
    filters.push(
      buildHeatmapDrillFilterClause(
        resolvedYColumn,
        yValue,
        coltypeMapping,
        effectiveTimeGrain,
        granularitySqla,
      ),
    );
  }

  const xAxisFilters: QueryObjectFilterClause[] = [];
  if (resolvedXColumn) {
    xAxisFilters.push(
      buildHeatmapDrillFilterClause(
        resolvedXColumn,
        xValue,
        coltypeMapping,
        effectiveTimeGrain,
        granularitySqla,
      ),
    );
  }

  return {
    filters,
    xAxisFilters,
    groupbyFieldName: 'groupby',
  };
}
