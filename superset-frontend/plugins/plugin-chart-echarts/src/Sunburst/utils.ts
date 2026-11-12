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
import {
  BinaryQueryObjectFilterClause,
  DataRecordValue,
  getColumnLabel,
  isPhysicalColumn,
  QueryFormColumn,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { EchartsSunburstFormData } from './types';
import {
  formatNaiveDateTime,
  getTemporalXAxisDrillByFilter,
  parseTemporalValue,
} from '../utils/xAxisDrillByFilter';

import { getSunburstTimeGrain } from './timeGrain';

/**
 * Whether a segment is the selected segment or one of its ancestors. Keys are
 * compared level by level, so a year label never matches digits inside an
 * epoch key.
 */
export function isSunburstPathSelected(
  selectedValue: unknown,
  key: string,
): boolean {
  const selected = String(selectedValue);
  return selected === key || selected.startsWith(`${key},`);
}

/** Keep temporal selection identity independent of the display format. */
export function getSunburstSelectionKey(
  records: DataRecordValue[],
  labels: string[],
  columns: QueryFormColumn[],
  coltypeMapping: Record<string, GenericDataType> = {},
): string {
  return records
    .map((value, index) =>
      coltypeMapping[getColumnLabel(columns[index])] ===
      GenericDataType.Temporal
        ? String(value instanceof Date ? value.getTime() : value)
        : labels[index],
    )
    .join(',');
}

/**
 * Exact temporal value for filters the backend receives as written. A physical
 * column gets epoch milliseconds, which the backend turns into an engine-native
 * timestamp literal. An adhoc SQL expression has no native type to convert to,
 * so it gets the naive ISO datetime instead of an integer.
 */
function getSunburstTemporalValue(
  column: QueryFormColumn,
  value: DataRecordValue,
): DataRecordValue {
  const date = parseTemporalValue(value);
  if (!date) {
    return value;
  }
  return isPhysicalColumn(column) ? date.getTime() : formatNaiveDateTime(date);
}

/** Build cross-filters from raw hierarchy records, preserving bucket bounds. */
export function getSunburstFilter(
  column: QueryFormColumn,
  value: DataRecordValue,
  formData: EchartsSunburstFormData,
  coltype: GenericDataType | undefined,
  formattedVal?: string,
): BinaryQueryObjectFilterClause {
  if (coltype !== GenericDataType.Temporal) {
    return { col: column, op: '==', val: value, formattedVal };
  }
  const grain = getSunburstTimeGrain(formData, column);
  const temporalFilter = getTemporalXAxisDrillByFilter(
    column,
    value,
    grain,
    formattedVal,
  );
  if (!temporalFilter) {
    return { col: column, op: '==', val: value, formattedVal };
  }
  if (temporalFilter.op === 'TEMPORAL_RANGE') {
    return temporalFilter;
  }
  // Grains without frontend bucket arithmetic match on the grained column.
  return {
    col: column,
    op: '==',
    val: getSunburstTemporalValue(column, value),
    formattedVal,
    ...(grain && value != null && { grain }),
  };
}

/**
 * Drill to detail sends its filters to the backend unchanged, so it compares
 * bucket labels on the grained column. Unlike TEMPORAL_RANGE, equality
 * survives the query time_range override.
 */
export function getSunburstDetailFilter(
  column: QueryFormColumn,
  value: DataRecordValue,
  formData: EchartsSunburstFormData,
  coltype: GenericDataType | undefined,
  formattedVal?: string,
): BinaryQueryObjectFilterClause {
  if (coltype !== GenericDataType.Temporal) {
    return { col: column, op: '==', val: value, formattedVal };
  }
  const grain = getSunburstTimeGrain(formData, column);
  return {
    col: column,
    op: '==',
    val: getSunburstTemporalValue(column, value),
    formattedVal,
    ...(grain && value != null && { grain }),
  };
}

/**
 * Drill by preserves grain through the adhoc-filter adapter. Grained equality
 * keeps the bucket independent of query Time Range and Time Column overrides.
 * Ungrained temporal expressions use the naive ISO datetime.
 */
export function getSunburstDrillByFilter(
  column: QueryFormColumn,
  value: DataRecordValue,
  formData: EchartsSunburstFormData,
  coltype: GenericDataType | undefined,
  formattedVal?: string,
): BinaryQueryObjectFilterClause {
  const grain = getSunburstTimeGrain(formData, column);
  if (coltype === GenericDataType.Temporal && grain) {
    return getSunburstDetailFilter(
      column,
      value,
      formData,
      coltype,
      formattedVal,
    );
  }
  const temporalFilter =
    coltype === GenericDataType.Temporal
      ? getTemporalXAxisDrillByFilter(column, value, undefined, formattedVal)
      : undefined;
  return temporalFilter ?? { col: column, op: '==', val: value, formattedVal };
}
