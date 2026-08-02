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
 * Resolves the name of the entity a page is showing, so the chat can say
 * "Back to World Bank's Data" instead of "Back to Dashboard".
 *
 * document.title holds the value from the last full page load, so it names
 * the wrong entity after client-side navigation. Names come from the REST
 * API instead, under the user's own permissions, degrading to no name on
 * any failure.
 */
import type { ResourceContext } from '../types';

/** Endpoint and result field per resource kind */
const SOURCES: Record<
  ResourceContext['kind'],
  { path: string; field: string }
> = {
  dashboard: { path: 'dashboard', field: 'dashboard_title' },
  chart: { path: 'chart', field: 'slice_name' },
  dataset: { path: 'dataset', field: 'table_name' },
};

// Names are stable for a session, so a revisited page costs no second request
const cache = new Map<string, string | null>();

export function clearResourceNameCache(): void {
  cache.clear();
}

function cacheKey(resource: ResourceContext): string {
  return `${resource.kind}:${resource.id_or_slug}`;
}

/**
 * Returns an already resolved name, otherwise null. Synchronous callers such
 * as page context building omit the name until the fetch lands.
 */
export function getCachedResourceName(
  resource: ResourceContext,
): string | null {
  return cache.get(cacheKey(resource)) ?? null;
}

export async function fetchResourceName(
  resource: ResourceContext,
): Promise<string | null> {
  const source = SOURCES[resource.kind];
  const key = cacheKey(resource);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let name: string | null = null;
  try {
    // Request a single column to stay cheaper than the page's own loading
    const response = await fetch(
      `/api/v1/${source.path}/${encodeURIComponent(resource.id_or_slug)}` +
        `?q=(columns:!(${source.field}))`,
      { credentials: 'same-origin', headers: { Accept: 'application/json' } },
    );
    if (response.ok) {
      const body: unknown = await response.json();
      const result =
        body && typeof body === 'object'
          ? (body as Record<string, unknown>).result
          : null;
      const value =
        result && typeof result === 'object'
          ? (result as Record<string, unknown>)[source.field]
          : null;
      if (typeof value === 'string' && value.trim()) {
        name = value.trim();
      }
    }
  } catch {
    // Offline, blocked, or no permission: caller falls back to the page label
    name = null;
  }
  cache.set(key, name);
  return name;
}
