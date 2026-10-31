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
  DataRecordValue,
  getColumnLabel,
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { formatSeriesName } from '../utils/series';

/** Matches `optionLabel` in `src/utils/common.ts`. */
const EMPTY_STRING = '<empty string>';

export type HistogramBin = {
  start: number;
  end: number;
  /** Numpy's last bin includes its right edge. Earlier bins do not. */
  isLast: boolean;
  label: string;
};

const BIN_SEPARATOR = ' - ';

/**
 * Bin columns are named `"<start> - <end>"` by the histogram post-processing.
 * The first separator is the delimiter, so a negative edge stays intact.
 */
export function parseBinKey(
  key: string,
): { start: number; end: number } | undefined {
  const separator = key.indexOf(BIN_SEPARATOR);
  if (separator <= 0) {
    return undefined;
  }
  const start = Number(key.slice(0, separator));
  const end = Number(key.slice(separator + BIN_SEPARATOR.length));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined;
  }
  return { start, end };
}

function toKeyPart(value: DataRecordValue): string | number | boolean | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * `bigint` throws in `JSON.stringify`, and the data mask is serialized into
 * dashboard state and the chart-data request.
 */
function toJsonSafeFilterValue(
  value: Exclude<DataRecordValue, null>,
): Exclude<DataRecordValue, null | bigint> {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function getHistogramCrossFilterKey(
  bin: Pick<HistogramBin, 'start' | 'end'>,
  groupbyValues: DataRecordValue[],
): string {
  return JSON.stringify([
    bin.start,
    bin.end,
    ...groupbyValues.map(value => toKeyPart(value)),
  ]);
}

export function getSelectedHistogramKeys(selectedValues: unknown): string[] {
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

function formatGroupbyValue(
  col: QueryFormColumn,
  value: DataRecordValue,
  coltypeMapping?: Record<string, number>,
): string {
  if (value === '') {
    return EMPTY_STRING;
  }
  return formatSeriesName(value, {
    timeFormatter: getTimeFormatter(),
    coltype: coltypeMapping?.[getColumnLabel(col)] as
      | GenericDataType
      | undefined,
  });
}

function binFilters(
  column: QueryFormColumn,
  bin: HistogramBin,
  cumulative: boolean,
): QueryObjectFilterClause[] {
  // A cumulative bar is the running total up to this bin's right edge, so
  // the filter has no lower bound. Earlier bins stay half-open on the right.
  const upper: QueryObjectFilterClause = {
    col: column,
    op: bin.isLast ? '<=' : '<',
    val: bin.end,
  };
  if (cumulative) {
    return [upper];
  }
  return [{ col: column, op: '>=', val: bin.start }, upper];
}

function groupbyFilters(
  groupby: QueryFormColumn[],
  groupbyValues: DataRecordValue[],
): QueryObjectFilterClause[] {
  return groupby.map((col, index) => {
    const value = groupbyValues[index];
    if (value == null) {
      return { col, op: 'IS NULL' as const };
    }
    return { col, op: 'IN' as const, val: [toJsonSafeFilterValue(value)] };
  });
}

function rangeLabel(bin: HistogramBin, cumulative: boolean): string {
  // The chip has to name the filter that was sent. A cumulative bar covers
  // every value up to its right edge, not the one bin printed on the axis.
  if (cumulative) {
    return `${bin.isLast ? '<=' : '<'} ${bin.end}`;
  }
  return bin.label;
}

function crossFilterLabel(
  bin: HistogramBin,
  groupby: QueryFormColumn[],
  groupbyValues: DataRecordValue[],
  coltypeMapping: Record<string, number> | undefined,
  cumulative: boolean,
): string {
  const groupLabels = groupby.map((col, index) =>
    formatGroupbyValue(col, groupbyValues[index], coltypeMapping),
  );
  const range = rangeLabel(bin, cumulative);
  return groupLabels.length ? `${range}, ${groupLabels.join(', ')}` : range;
}

export function getHistogramCrossFilterDataMask({
  column,
  groupby,
  bin,
  groupbyValues,
  selectedKeys,
  coltypeMapping,
  cumulative = false,
}: {
  column: QueryFormColumn;
  groupby: QueryFormColumn[];
  bin: HistogramBin;
  groupbyValues: DataRecordValue[];
  selectedKeys: string[];
  coltypeMapping?: Record<string, number>;
  cumulative?: boolean;
}) {
  const key = getHistogramCrossFilterKey(bin, groupbyValues);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const filters: QueryObjectFilterClause[] = isCurrentValueSelected
    ? []
    : [
        ...binFilters(column, bin, cumulative),
        ...groupbyFilters(groupby, groupbyValues),
      ];
  const label = isCurrentValueSelected
    ? null
    : crossFilterLabel(bin, groupby, groupbyValues, coltypeMapping, cumulative);

  return {
    dataMask: {
      extraFormData: {
        filters,
      },
      filterState: {
        label,
        value: label,
        selectedValues: isCurrentValueSelected ? null : [key],
      },
    },
    isCurrentValueSelected,
  };
}
