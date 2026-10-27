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
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { NULL_STRING } from '../constants';
import { formatSeriesName } from '../utils/series';
import { getTemporalXAxisDrillByFilter } from '../utils/xAxisDrillByFilter';

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

type FilterContext = {
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
  timeGrain?: TimeGranularity;
};

type CategoryDimension = {
  col: QueryFormColumn;
  value: DataRecordValue;
  /** The X axis is the column a time grain buckets. Breakdowns stay exact. */
  bucket: boolean;
};

function isTemporalColumn(
  col: QueryFormColumn,
  coltypeMapping?: Record<string, number>,
): boolean {
  return coltypeMapping?.[getColumnLabel(col)] === GenericDataType.Temporal;
}

/**
 * Range covering the clicked bucket. Absent when the column is not temporal,
 * no grain is set, or the grain has no frontend bucket bounds.
 */
function temporalBucketFilter(
  col: QueryFormColumn,
  value: DataRecordValue,
  formattedVal: string,
  { coltypeMapping, timeGrain }: FilterContext,
): BinaryQueryObjectFilterClause | undefined {
  if (!timeGrain || !isTemporalColumn(col, coltypeMapping)) {
    return undefined;
  }
  const filter = getTemporalXAxisDrillByFilter(
    col,
    value,
    timeGrain,
    formattedVal,
  );
  return filter?.op === 'TEMPORAL_RANGE' ? filter : undefined;
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
  grain?: TimeGranularity,
): QueryObjectFilterClause {
  if (value == null) {
    return { col, op: 'IS NULL', formattedVal };
  }
  return {
    col,
    op: '==',
    val: toJsonSafeFilterValue(value),
    formattedVal,
    // Equality is applied to the truncated column, so a bucket start matches
    // every row in the bucket. TEMPORAL_RANGE would be replaced by the query
    // time range.
    ...(grain ? { grain } : {}),
  };
}

function categoryDimensions(category: WaterfallCategory): CategoryDimension[] {
  const dimensions: CategoryDimension[] = [
    { col: category.xColumn, value: category.xValue, bucket: true },
  ];
  if (!category.xOnly && category.breakdownColumn) {
    dimensions.push({
      col: category.breakdownColumn,
      value: category.breakdownValue ?? null,
      bucket: false,
    });
  }
  return dimensions;
}

function categoryLabel(
  category: WaterfallCategory,
  coltypeMapping?: Record<string, number>,
  timeFormat?: string,
): string {
  return categoryDimensions(category)
    .map(({ col, value }) =>
      formatDimensionValue(col, value, coltypeMapping, timeFormat),
    )
    .join(', ');
}

function crossFilterClause(
  dimension: CategoryDimension,
  context: FilterContext,
): QueryObjectFilterClause {
  const formattedVal = formatDimensionValue(
    dimension.col,
    dimension.value,
    context.coltypeMapping,
    context.timeFormat,
  );
  if (dimension.bucket) {
    const range = temporalBucketFilter(
      dimension.col,
      dimension.value,
      formattedVal,
      context,
    );
    if (range) {
      return range;
    }
  }
  return dimensionFilter(dimension.col, dimension.value);
}

function detailClause(
  dimension: CategoryDimension,
  context: FilterContext,
): QueryObjectFilterClause {
  const formattedVal = formatDimensionValue(
    dimension.col,
    dimension.value,
    context.coltypeMapping,
    context.timeFormat,
  );
  const grain =
    dimension.bucket &&
    dimension.value != null &&
    context.timeGrain &&
    isTemporalColumn(dimension.col, context.coltypeMapping)
      ? context.timeGrain
      : undefined;
  return drillFilter(dimension.col, dimension.value, formattedVal, grain);
}

export function getWaterfallCrossFilterDataMask({
  category,
  selectedKeys,
  coltypeMapping,
  timeFormat,
  timeGrain,
}: {
  category: WaterfallCategory;
  selectedKeys: string[];
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
  timeGrain?: TimeGranularity;
}) {
  const key = getWaterfallCrossFilterKey(category);
  const isCurrentValueSelected = Boolean(key && selectedKeys.includes(key));
  const active = Boolean(key) && !isCurrentValueSelected;
  const context: FilterContext = { coltypeMapping, timeFormat, timeGrain };
  const label = active
    ? categoryLabel(category, coltypeMapping, timeFormat)
    : null;
  const filters: QueryObjectFilterClause[] = active
    ? categoryDimensions(category).map(dimension =>
        crossFilterClause(dimension, context),
      )
    : [];
  const temporalRange = filters.find(
    (filter): filter is BinaryQueryObjectFilterClause =>
      filter.op === 'TEMPORAL_RANGE',
  );

  return {
    dataMask: {
      extraFormData: {
        filters,
        // The backend copies the query time range onto every TEMPORAL_RANGE
        // filter, so the clicked bucket has to be that time range too.
        ...(temporalRange ? { time_range: String(temporalRange.val) } : {}),
      },
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
  timeGrain,
}: {
  category: WaterfallCategory;
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
  timeGrain?: TimeGranularity;
}): QueryObjectFilterClause[] {
  if (category.isGrandTotal) {
    return [];
  }
  const context: FilterContext = { coltypeMapping, timeFormat, timeGrain };
  return categoryDimensions(category).map(dimension =>
    detailClause(dimension, context),
  );
}

/**
 * Drill by on the X axis. A known grain covers the bucket with TEMPORAL_RANGE,
 * the same clause a time-axis chart uses. Grains without bucket bounds fall
 * back to grained equality.
 */
export function getWaterfallDrillByXAxisFilter({
  category,
  coltypeMapping,
  timeFormat,
  timeGrain,
}: {
  category: WaterfallCategory;
  coltypeMapping?: Record<string, number>;
  timeFormat?: string;
  timeGrain?: TimeGranularity;
}): QueryObjectFilterClause | undefined {
  if (category.isGrandTotal) {
    return undefined;
  }
  const context: FilterContext = { coltypeMapping, timeFormat, timeGrain };
  const [dimension] = categoryDimensions(category);
  const formattedVal = formatDimensionValue(
    dimension.col,
    dimension.value,
    coltypeMapping,
    timeFormat,
  );
  return (
    temporalBucketFilter(
      dimension.col,
      dimension.value,
      formattedVal,
      context,
    ) ?? detailClause(dimension, context)
  );
}
