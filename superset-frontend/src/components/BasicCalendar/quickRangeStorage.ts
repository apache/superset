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
import type { DataMaskStateWithId, Filter } from '@superset-ui/core';
import { FilterPlugins } from 'src/constants';
import { isQuickRange } from './presets';
import type { DatePickerMode } from './utils';

export function quickRangeStorageKey(
  userId: number | undefined,
  dashboardId: number | undefined,
  filterId: string | undefined,
  mode: DatePickerMode,
): string | undefined {
  return userId !== undefined && dashboardId !== undefined && filterId
    ? `superset.simple-range.v1:${userId}:${dashboardId}:${filterId}:${mode}`
    : undefined;
}

/** Restore only relative presets, never resolved absolute timestamps. */
export function readQuickRange(
  key: string | undefined,
  mode: DatePickerMode,
): string | undefined {
  if (!key) return undefined;
  try {
    const value = localStorage.getItem(key);
    return value && isQuickRange(value, mode) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Persist a confirmed preset; manual dates and clearing remove the preference. */
export function rememberQuickRange(
  key: string | undefined,
  value: string | undefined,
  mode: DatePickerMode,
): void {
  if (!key) return;
  try {
    if (value && value !== 'No filter' && isQuickRange(value, mode))
      localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Restricted storage must not prevent filtering.
  }
}

/** Restore before dashboard hydration, before it creates an automatic filter URL. */
export function restoreQuickRangeDataMasks(
  filters: readonly Partial<Filter>[],
  userId: number | undefined,
  dashboardId: number,
  hasExplicitSelection: boolean,
): DataMaskStateWithId {
  if (hasExplicitSelection) return {};
  const masks: DataMaskStateWithId = {};
  filters.forEach(filter => {
    const mode =
      filter.filterType === FilterPlugins.SimpleDateRange
        ? 'date'
        : filter.filterType === FilterPlugins.SimpleDateTimeRange
          ? 'datetime'
          : undefined;
    if (!mode || !filter.id) return;
    const value = readQuickRange(
      quickRangeStorageKey(userId, dashboardId, filter.id, mode),
      mode,
    );
    if (value)
      masks[filter.id] = {
        id: filter.id,
        extraFormData: { time_range: value },
        filterState: { value },
        ownState: {},
      };
  });
  return masks;
}
