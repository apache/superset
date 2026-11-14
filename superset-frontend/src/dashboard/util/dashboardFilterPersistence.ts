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

/**
 * Remembers each signed-in user's last applied native filter selections per
 * dashboard in localStorage, so reopening a dashboard through normal
 * navigation (dashboard list, menu, bookmark) restores them.
 *
 * Only native filter entries are stored, each with a fingerprint of the
 * filter settings that shape its query. An entry is restored only while its
 * filter still exists with the same fingerprint, so a retargeted or
 * reconfigured filter never receives a stale selection.
 *
 * This module has no dependency on dashboard components, so it can be used
 * from the app preamble and the navigation menu without pulling the dashboard
 * bundle in.
 */
import type { DataMask, DataMaskStateWithId } from '@superset-ui/core';

export const DASHBOARD_FILTERS_STORAGE_PREFIX = 'dashboard__native_filters__';

const STORAGE_VERSION = 1;

// Filter settings that determine the query a selection produces. Display-only
// settings (name, description, scope, default value) are left out so editing
// them doesn't discard a viewer's selection.
const FINGERPRINT_FIELDS = [
  'filterType',
  'targets',
  'controlValues',
  'adhoc_filters',
  'granularity_sqla',
  'granularity',
  'time_grain_sqla',
  'time_range',
  'time_grains',
  'sortMetric',
] as const;

const NATIVE_FILTER_TYPE = 'NATIVE_FILTER';

/** A native filter config entry as found in dashboard metadata or Redux. */
export type FilterConfigEntry = {
  id?: string;
  type?: string;
  [key: string]: unknown;
};

type SavedDashboardFilters = {
  version: typeof STORAGE_VERSION;
  dataMask: DataMaskStateWithId;
  fingerprints: Record<string, string>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON with object keys sorted, so equal settings always serialize alike. */
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

export const getFilterFingerprint = (filter: FilterConfigEntry): string =>
  stableStringify(
    Object.fromEntries(
      FINGERPRINT_FIELDS.map(field => [field, filter[field] ?? null]),
    ),
  );

export const getDashboardFiltersStorageKey = (
  userId: number,
  dashboardId: number,
) => `${DASHBOARD_FILTERS_STORAGE_PREFIX}${userId}__${dashboardId}`;

/** Native filters by id, skipping dividers, customizations and null rows. */
const indexNativeFilters = (
  filters: Iterable<FilterConfigEntry | null | undefined>,
) => {
  const index = new Map<string, FilterConfigEntry>();
  for (const filter of filters) {
    if (
      filter?.id &&
      (filter.type ?? NATIVE_FILTER_TYPE) === NATIVE_FILTER_TYPE
    ) {
      index.set(filter.id, filter);
    }
  }
  return index;
};

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Returns the user's saved selections for the dashboard's current native
 * filters, or null when there is nothing valid to restore.
 */
export function loadSavedDashboardFilters({
  dashboardId,
  userId,
  filterConfig,
}: {
  dashboardId: number;
  userId: number;
  filterConfig: Iterable<FilterConfigEntry | null | undefined>;
}): DataMaskStateWithId | null {
  const raw = readStorage(getDashboardFiltersStorageKey(userId, dashboardId));
  if (!raw) return null;

  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isPlainObject(saved) ||
    saved.version !== STORAGE_VERSION ||
    !isPlainObject(saved.dataMask) ||
    !isPlainObject(saved.fingerprints)
  ) {
    return null;
  }

  const { dataMask, fingerprints } = saved;
  const filters = indexNativeFilters(filterConfig);
  const restored: DataMaskStateWithId = {};
  Object.entries(dataMask).forEach(([filterId, mask]) => {
    const filter = filters.get(filterId);
    if (
      filter &&
      isPlainObject(mask) &&
      fingerprints[filterId] === getFilterFingerprint(filter)
    ) {
      restored[filterId] = { ...(mask as DataMask), id: filterId };
    }
  });
  return Object.keys(restored).length > 0 ? restored : null;
}

/**
 * Saves the selections of the dashboard's native filters. An empty selection
 * set is never written, so a data mask that was cleared while navigating
 * between dashboards can't overwrite the user's saved selections.
 */
export function saveDashboardFilters({
  dashboardId,
  userId,
  dataMask,
  filters,
}: {
  dashboardId: number;
  userId: number;
  dataMask: DataMaskStateWithId;
  filters: Iterable<FilterConfigEntry | null | undefined>;
}): void {
  const savedMask: DataMaskStateWithId = {};
  const fingerprints: Record<string, string> = {};
  indexNativeFilters(filters).forEach((filter, filterId) => {
    const mask = dataMask[filterId];
    if (mask) {
      savedMask[filterId] = mask;
      fingerprints[filterId] = getFilterFingerprint(filter);
    }
  });
  if (Object.keys(savedMask).length === 0) return;

  const value: SavedDashboardFilters = {
    version: STORAGE_VERSION,
    dataMask: savedMask,
    fingerprints,
  };
  const key = getDashboardFiltersStorageKey(userId, dashboardId);
  try {
    const serialized = JSON.stringify(value);
    // localStorage writes are synchronous; skip them when nothing changed.
    if (window.localStorage.getItem(key) !== serialized) {
      window.localStorage.setItem(key, serialized);
    }
  } catch {
    // Storage may be full or disabled; remembering filters is best-effort.
  }
}

/**
 * Removes saved dashboard filters, keeping only those of `keepUserId` when
 * given. Used on logout and at startup, so selections never outlive the
 * session of the user who made them on a shared browser.
 */
export function clearSavedDashboardFilters(keepUserId?: number | null): void {
  try {
    const { localStorage } = window;
    const keepPrefix =
      keepUserId != null
        ? `${DASHBOARD_FILTERS_STORAGE_PREFIX}${keepUserId}__`
        : null;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (
        key?.startsWith(DASHBOARD_FILTERS_STORAGE_PREFIX) &&
        !(keepPrefix && key.startsWith(keepPrefix))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Storage may be disabled; there is nothing to clear then.
  }
}
