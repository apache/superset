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
import { NULL_STRING } from '../constants';
import { formatSeriesName } from '../utils/series';

/** Matches `optionLabel` in `src/utils/common.ts`. */
const EMPTY_STRING = '<empty string>';

export type WaterfallCategory = {
  /** The trailing total of a chart without a breakdown. Not a data category. */
  isGrandTotal: boolean;
  /** Filter the X axis only. Period totals and charts without a breakdown. */
  xOnly: boolean;
  xColumn: QueryFormColumn;
  xValue: DataRecordValue;
  breakdownColumn?: QueryFormColumn;
  breakdownValue?: DataRecordValue;
};

/**
 * Selection-key part. `bigint` is wrapped so it does not share a key with the
 * decimal string of the same digits (`42n` vs `'42'`). `JSON.stringify` cannot
 * encode a bare `bigint`.
 */
function toKeyPart(
  value: DataRecordValue,
): string | number | boolean | null | { bigint: string } {
  if (value == null) {
    return null;
  }
  if (typeof value === 'bigint') {
    return { bigint: value.toString() };
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

export function getWaterfallCrossFilterKey(
  category: WaterfallCategory,
): string | null {
  if (category.isGrandTotal) {
    return null;
  }
  const xPart = toKeyPart(category.xValue);
  if (category.xOnly || !category.breakdownColumn) {
    return JSON.stringify([xPart]);
  }
  return JSON.stringify([xPart, toKeyPart(category.breakdownValue ?? null)]);
}

export function getSelectedWaterfallKeys(selectedValues: unknown): string[] {
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

export function isWaterfallBarDimmed(
  category: WaterfallCategory,
  selectedKeys: string[],
): boolean {
  if (selectedKeys.length === 0) {
    return false;
  }
  if (category.isGrandTotal) {
    return true;
  }
  const exactKey = getWaterfallCrossFilterKey(category);
  if (exactKey && selectedKeys.includes(exactKey)) {
    return false;
  }
  // An X-only selection (a period total) keeps every bar of that X value.
  const xOnlyKey = JSON.stringify([toKeyPart(category.xValue)]);
  return !selectedKeys.includes(xOnlyKey);
}

function formatDimensionValue(
  col: QueryFormColumn,
  value: DataRecordValue,
  coltypeMapping?: Record<string, number>,
  timeFormat?: string,
): string {
  if (value == null) {
    return NULL_STRING;
  }
  if (value === '') {
    return EMPTY_STRING;
  }
  return formatSeriesName(value, {
    timeFormatter: getTimeFormatter(timeFormat),
    coltype: coltypeMapping?.[getColumnLabel(col)] as
      | GenericDataType
      | undefined,
  });
}

function dimensionFilter(
  col: QueryFormColumn,
  value: DataRecordValue,
): QueryObjectFilterClause {
  if (value == null) {
    return { col, op: 'IS NULL' };
  }
  return { col, op: 'IN', val: [toJsonSafeFilterValue(value)] };
}

function drillFilter(
  col: QueryFormColumn,
  value: DataRecordValue,
  formattedVal: string,
): QueryObjectFilterClause {
  if (value == null) {
    return { col, op: 'IS NULL', formattedVal };
  }
  return {
    col,
    op: '==',
    val: toJsonSafeFilterValue(value),
    formattedVal,
  };
}

function categoryColumns(category: WaterfallCategory): Array<{
  col: QueryFormColumn;
  value: DataRecordValue;
}> {
  const columns = [{ col: category.xColumn, value: category.xValue }];
  if (!category.xOnly && category.breakdownColumn) {
    columns.push({
      col: category.breakdownColumn,
      value: category.breakdownValue ?? null,
    });
  }
  return columns;
}

function categoryLabel(
  category: WaterfallCategory,
  coltypeMapping?: Record<string, number>,
  timeFormat?: string,
): string {
  return categoryColumns(category)
    .map(({ col, value }) =>
      formatDimensionValue(col, value, coltypeMapping, timeFormat),
    )
    .join(', ');
}

export function getWaterfallCrossFilterDataMask({
  category,
  selectedKeys,
  coltypeMapping,
  timeFormat,
}: {
  category: WaterfallCategory;
  selectedKeys: string[];
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
}) {
  const key = getWaterfallCrossFilterKey(category);
  const isCurrentValueSelected = Boolean(key && selectedKeys.includes(key));
  const active = Boolean(key) && !isCurrentValueSelected;
  const label = active
    ? categoryLabel(category, coltypeMapping, timeFormat)
    : null;
  const filters: QueryObjectFilterClause[] = active
    ? categoryColumns(category).map(({ col, value }) =>
        dimensionFilter(col, value),
      )
    : [];

  return {
    dataMask: {
      extraFormData: { filters },
      filterState: {
        label,
        value: label,
        selectedValues: active && key ? [key] : null,
      },
    },
    isCurrentValueSelected,
  };
}

export function getWaterfallDrillFilters({
  category,
  coltypeMapping,
  timeFormat,
}: {
  category: WaterfallCategory;
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
}): QueryObjectFilterClause[] {
  if (category.isGrandTotal) {
    return [];
  }
  return categoryColumns(category).map(({ col, value }) =>
    drillFilter(
      col,
      value,
      formatDimensionValue(col, value, coltypeMapping, timeFormat),
    ),
  );
}
