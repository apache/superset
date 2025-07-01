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
import { DiffItemType, DiffType, FilterItemType } from 'src/types/DiffType';
import { safeStringify } from 'src/utils/safeStringify';
import { ControlMap, RowType } from '../types';

export const alterForComparison = (value?: unknown): unknown => {
  // Treat `null`, `undefined`, and empty strings as equivalent
  if (value === undefined || value === null || value === '') return null;

  // Treat empty arrays and objects as equivalent to null
  if (Array.isArray(value) && value.length === 0) return null;

  if (typeof value === 'object' && Object.keys(value).length === 0) return null;

  return value;
};

export const formatValueHandler = (
  value: DiffItemType,
  key = '',
  controlsMap: ControlMap,
): string | number => {
  if (value === undefined) return 'N/A';

  if (value === null) return 'null';

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (controlsMap[key]?.type === 'AdhocFilterControl' && Array.isArray(value)) {
    if (!value.length) return '[]';

    return value
      .map((v: FilterItemType): string => {
        const filterVal: string | string[] | undefined =
          v.comparator && v.comparator.constructor === Array
            ? `[${v.comparator.join(', ')}]`
            : v.comparator;
        return `${v.subject} ${v.operator} ${filterVal}`;
      })
      .join(', ');
  }

  if (controlsMap[key]?.type === 'BoundsControl' && Array.isArray(value))
    return `Min: ${value[0]}, Max: ${value[1]}`;

  if (controlsMap[key]?.type === 'CollectionControl' && Array.isArray(value))
    return value
      .map((v: FilterItemType): string => safeStringify(v))
      .join(', ');

  if (
    controlsMap[key]?.type === 'MetricsControl' &&
    value.constructor === Array
  ) {
    const formattedValue: (string | FilterItemType)[] = value.map(
      (v: FilterItemType): string | FilterItemType => v?.label ?? v,
    );
    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }

  if (Array.isArray(value)) {
    const formattedValue = value.map((v: any) => {
      if (
        typeof v === 'object' &&
        v !== null &&
        'label' in v &&
        typeof v.label === 'string'
      )
        return v.label;

      return String(v);
    });

    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }

  if (typeof value === 'string' || typeof value === 'number') return value;

  return safeStringify(value);
};

export const getRowsFromDiffs = (
  diffs: { [key: string]: DiffType },
  controlsMap: ControlMap,
): RowType[] =>
  Object.entries(diffs).map(([key, diff]: [string, DiffType]) => ({
    control: controlsMap[key]?.label || key,
    before: formatValueHandler(diff.before, key, controlsMap),
    after: formatValueHandler(diff.after, key, controlsMap),
  }));
