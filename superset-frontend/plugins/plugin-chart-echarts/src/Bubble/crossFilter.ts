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
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { NULL_STRING } from '../constants';

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

/** Display text for an empty-string dimension value. */
export const EMPTY_STRING = '""';

/**
 * Human-readable text for a dimension value, used for series names, tooltips
 * and the cross-filter chip. `null` and `''` stay distinguishable because they
 * produce different filters (`IS NULL` vs `IN ['']`).
 */
export function formatBubbleValue(value: DataRecordValue): string {
  if (value == null) {
    return NULL_STRING;
  }
  const text = String(value);
  return text === '' ? EMPTY_STRING : text;
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

export function getBubbleCrossFilterLabel(
  entityValue: DataRecordValue,
  seriesValue: DataRecordValue | undefined,
  hasSeries: boolean,
): string {
  const entityPart = formatBubbleValue(entityValue);
  if (!hasSeries) {
    return entityPart;
  }
  return `${entityPart}, ${formatBubbleValue(seriesValue ?? null)}`;
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
    val: [value],
  };
}

export function getBubbleCrossFilterDataMask({
  entity,
  series,
  datum,
  selectedKeys,
}: {
  entity: QueryFormColumn;
  series?: QueryFormColumn;
  datum: BubbleDatum;
  selectedKeys: string[];
}) {
  const hasSeries = Boolean(series);
  const entityValue = datum[ENTITY_INDEX];
  const seriesValue = datum[SERIES_INDEX];
  const key = getBubbleCrossFilterKey(entityValue, seriesValue, hasSeries);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const nextKeys = isCurrentValueSelected ? [] : [key];
  const label = getBubbleCrossFilterLabel(entityValue, seriesValue, hasSeries);
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
