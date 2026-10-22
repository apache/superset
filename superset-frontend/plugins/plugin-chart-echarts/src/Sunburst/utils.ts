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
  TimeGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { EchartsSunburstFormData } from './types';
import { getTemporalXAxisDrillByFilter } from '../utils/xAxisDrillByFilter';

/** Return the effective grain only for a grained physical hierarchy level. */
export function getSunburstTimeGrain(
  formData: EchartsSunburstFormData,
  column: QueryFormColumn,
): TimeGranularity | undefined {
  return isPhysicalColumn(column) &&
    (formData.temporalColumnsLookup?.[column] ||
      formData.granularitySqla === column)
    ? (formData.extraFormData?.time_grain_sqla ?? formData.timeGrainSqla)
    : undefined;
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
        ? String(value)
        : labels[index],
    )
    .join(',');
}

/** Build filters from raw hierarchy records, preserving temporal bucket bounds. */
export function getSunburstFilter(
  column: QueryFormColumn,
  value: DataRecordValue,
  formData: EchartsSunburstFormData,
  coltype: GenericDataType | undefined,
  formattedVal?: string,
): BinaryQueryObjectFilterClause {
  const temporalFilter =
    coltype === GenericDataType.Temporal
      ? getTemporalXAxisDrillByFilter(
          column,
          value,
          getSunburstTimeGrain(formData, column),
          formattedVal,
        )
      : undefined;
  return temporalFilter ?? { col: column, op: '==', val: value, formattedVal };
}
