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
  EMPTY_STRING,
  getColumnLabel,
  getConstantLabel,
  getTimeFormatter,
  NULL_STRING,
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { formatSeriesName } from '../utils/series';

/** Scatter point payload: [x, y, size, entity, series]. */
export type BubbleDatum = [
  DataRecordValue,
  DataRecordValue,
  DataRecordValue,
  DataRecordValue,
  DataRecordValue,
];

export const ENTITY_INDEX = 3;
export const SERIES_INDEX = 4;

/**
 * Human-readable text for a dimension value, used for series names, tooltips
 * and the cross-filter chip. `null` and `''` stay distinguishable because they
 * produce different filters (`IS NULL` vs `IN ['']`).
 */
export function formatBubbleValue(value: DataRecordValue): string {
  if (value == null) {
    return getConstantLabel(NULL_STRING);
  }
  const text = String(value);
  return text === '' ? getConstantLabel(EMPTY_STRING) : text;
}

export function isBubbleDatum(value: unknown): value is BubbleDatum {
  return Array.isArray(value) && value.length > SERIES_INDEX;
}

function toKeyPart(
  value: DataRecordValue | undefined,
): string | number | boolean | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Stable identifier of a bubble, stored in `filterState.selectedValues`.
 * A JSON array keeps entity and series unambiguous (including `null` vs `''`
 * and `1` vs `'1'`) and survives serialization into dashboard state.
 */
export function getBubbleCrossFilterKey(
  entityValue: DataRecordValue,
  seriesValue: DataRecordValue | undefined,
  hasSeries: boolean,
): string {
  const parts = hasSeries
    ? [toKeyPart(entityValue), toKeyPart(seriesValue)]
    : [toKeyPart(entityValue)];
  return JSON.stringify(parts);
}

type CrossFilterLabelFormat = {
  coltypeMapping?: Record<string, number>;
  timeFormatter?: ReturnType<typeof getTimeFormatter>;
};

/**
 * Chip text for one dimension. An empty string is labeled before
 * `formatSeriesName`, which would leave it blank. Temporal values use the
 * same time formatter as the drill filters. Numbers are left unformatted:
 * the smart number formatter would abbreviate an id or a year.
 */
function formatCrossFilterPart(
  col: QueryFormColumn,
  value: DataRecordValue,
  format: CrossFilterLabelFormat,
): string {
  if (value === '') {
    return getConstantLabel(EMPTY_STRING);
  }
  return formatSeriesName(value, {
    timeFormatter: format.timeFormatter,
    coltype: format.coltypeMapping?.[getColumnLabel(col)],
  });
}

export function getBubbleCrossFilterLabel(
  entity: QueryFormColumn,
  entityValue: DataRecordValue,
  series: QueryFormColumn | undefined,
  seriesValue: DataRecordValue | undefined,
  format: CrossFilterLabelFormat,
): string {
  const entityPart = formatCrossFilterPart(entity, entityValue, format);
  if (!series) {
    return entityPart;
  }
  return `${entityPart}, ${formatCrossFilterPart(series, seriesValue ?? null, format)}`;
}

export function getSelectedBubbleKeys(selectedValues: unknown): string[] {
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
 * `bigint` throws in `JSON.stringify`, and the data mask is serialized into
 * dashboard state and the chart-data request.
 */
export function toJsonSafeFilterValue(
  value: Exclude<DataRecordValue, null>,
): Exclude<DataRecordValue, null | bigint> {
  return typeof value === 'bigint' ? value.toString() : value;
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

export function getBubbleCrossFilterDataMask({
  entity,
  series,
  datum,
  selectedKeys,
  coltypeMapping,
  dateFormat,
}: {
  entity: QueryFormColumn;
  series?: QueryFormColumn;
  datum: BubbleDatum;
  selectedKeys: string[];
  coltypeMapping?: Record<string, number>;
  dateFormat?: string;
}) {
  const hasSeries = Boolean(series);
  const entityValue = datum[ENTITY_INDEX];
  const seriesValue = datum[SERIES_INDEX];
  const key = getBubbleCrossFilterKey(entityValue, seriesValue, hasSeries);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const nextKeys = isCurrentValueSelected ? [] : [key];
  const label = getBubbleCrossFilterLabel(
    entity,
    entityValue,
    hasSeries ? series : undefined,
    seriesValue,
    {
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    },
  );
  const filters: QueryObjectFilterClause[] =
    nextKeys.length === 0
      ? []
      : [
          dimensionFilter(entity, entityValue),
          ...(hasSeries && series
            ? [dimensionFilter(series, seriesValue)]
            : []),
        ];

  return {
    dataMask: {
      extraFormData: {
        filters,
      },
      filterState: {
        // `label` is the chip text. `selectedValues` keeps the join key so a
        // second click can clear the same bubble.
        label: nextKeys.length ? label : null,
        value: nextKeys.length ? label : null,
        selectedValues: nextKeys.length ? nextKeys : null,
      },
    },
    isCurrentValueSelected,
  };
}
