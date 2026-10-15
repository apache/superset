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
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import rison from 'rison';

const RESOURCES = ['dashboard', 'chart', 'dataset'] as const;
const QUERY_KEYS = [
  'filters',
  'pageIndex',
  'sortColumn',
  'sortOrder',
  'viewMode',
] as const;

export interface ListViewPersistenceConfig {
  userId: number;
  resource: (typeof RESOURCES)[number];
}

type SavedViews = Partial<
  Record<ListViewPersistenceConfig['resource'], string>
>;

/** Pick only list settings; unrelated URL parameters belong to their links. */
function listQuery(search: string) {
  const source = new URLSearchParams(search);
  const query = new URLSearchParams();
  QUERY_KEYS.forEach(key => {
    const value = source.get(key);
    if (value !== null) query.set(key, value);
  });
  return query;
}

/** Ignore damaged or obsolete saved state instead of breaking a list page. */
function readViews(userId: number): SavedViews {
  try {
    const stored: unknown = JSON.parse(
      sessionStorage.getItem(`listview__state:${userId}`) || '{}',
    );
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
      return {};
    const views: SavedViews = {};
    RESOURCES.forEach(resource => {
      const value = (stored as Record<string, unknown>)[resource];
      if (typeof value !== 'string') return;
      const query = listQuery(value);
      const page = query.get('pageIndex');
      if (
        page !== null &&
        (!/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)))
      )
        return;
      const mode = query.get('viewMode');
      if (mode !== null && mode !== 'card' && mode !== 'table') return;
      const order = query.get('sortOrder');
      if (order !== null && order !== 'asc' && order !== 'desc') return;
      if (query.has('filters')) {
        try {
          const filters: unknown = rison.decode(query.get('filters') || '()');
          if (!filters || typeof filters !== 'object' || Array.isArray(filters))
            return;
        } catch {
          return;
        }
      }
      views[resource] = query.toString();
    });
    return views;
  } catch {
    return {};
  }
}

/** Storage is optional, including when browser privacy settings disable it. */
function writeViews(userId: number, views: SavedViews) {
  try {
    sessionStorage.setItem(`listview__state:${userId}`, JSON.stringify(views));
  } catch {
    // List navigation still works without persistence.
  }
}

/** Check all three saved lists so Clear all also works on an unfiltered list. */
function hasFilters(views: SavedViews) {
  return Object.values(views).some(search => {
    try {
      const value = new URLSearchParams(search).get('filters');
      const filters: unknown = value ? rison.decode(value) : undefined;
      return Boolean(
        filters &&
        typeof filters === 'object' &&
        !Array.isArray(filters) &&
        Object.keys(filters).length,
      );
    } catch {
      return false;
    }
  });
}

/** Restore the URL before mounting the table, keeping URL state authoritative. */
export default function useListViewPersistence({
  userId,
  resource,
}: ListViewPersistenceConfig) {
  const history = useHistory();
  const location = useLocation();
  const [restoreSearch] = useState(() => {
    const query = new URLSearchParams(location.search);
    // Any explicit list setting makes the whole URL authoritative. In
    // particular, a shared link must not inherit someone else's saved filters.
    if (QUERY_KEYS.some(key => query.has(key))) return undefined;
    const saved = readViews(userId)[resource];
    if (!saved) return undefined;
    new URLSearchParams(saved).forEach((value, key) => query.set(key, value));
    return `?${query.toString()}`;
  });
  const [restoring, setRestoring] = useState(restoreSearch !== undefined);
  const [hasSavedFilters, setHasSavedFilters] = useState(() =>
    hasFilters(readViews(userId)),
  );

  useLayoutEffect(() => {
    if (restoring) {
      history.replace({ ...location, search: restoreSearch });
      setRestoring(false);
    }
  }, [history, location, restoreSearch, restoring]);

  useEffect(() => {
    if (restoring) return;
    const views = readViews(userId);
    views[resource] = listQuery(location.search).toString();
    writeViews(userId, views);
    setHasSavedFilters(hasFilters(views));
  }, [location.search, resource, restoring, userId]);

  const clearSavedFilters = useCallback(() => {
    const views = readViews(userId);
    RESOURCES.forEach(name => {
      const saved = views[name];
      if (saved === undefined) return;
      const query = new URLSearchParams(saved);
      query.delete('filters');
      query.set('pageIndex', '0');
      views[name] = query.toString();
    });
    writeViews(userId, views);
    setHasSavedFilters(false);
  }, [userId]);

  return { restoring, hasSavedFilters, clearSavedFilters };
}
