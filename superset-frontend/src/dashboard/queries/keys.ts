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

export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (idOrSlug: string | number) =>
    [...dashboardKeys.all, 'detail', String(idOrSlug)] as const,
  // Shared prefix so gcTime can be set once instead of per dashboard id.
  hydrationPayloadAll: ['dashboard', 'hydration-payload'] as const,
  // Initial hydration payload; useDiscardChanges re-seeds state from it without a reload.
  hydrationPayload: (idOrSlug: string | number) =>
    [...dashboardKeys.hydrationPayloadAll, String(idOrSlug)] as const,
  favoriteStatus: (idOrSlug: string | number) =>
    [...dashboardKeys.all, 'favorite-status', String(idOrSlug)] as const,
} as const;

export interface SlicesListParams {
  userId?: number;
  filterValue?: string;
  sortColumn?: string;
}

/** Query keys for the user's saved charts, used by the "add chart" panel. */
export const sliceKeys = {
  all: ['slices'] as const,
  list: (params: SlicesListParams) =>
    [...sliceKeys.all, 'list', params] as const,
} as const;

/** Query keys for dataset metadata reads (filter config column/metric lookups). */
export const datasetKeys = {
  all: ['dataset'] as const,
  metadata: (idOrSlug: string | number, columns?: string[]) =>
    [
      ...datasetKeys.all,
      'metadata',
      String(idOrSlug),
      columns ?? null,
    ] as const,
  list: (query: string, resource: 'dataset' | 'datasource' = 'dataset') =>
    [...datasetKeys.all, 'list', resource, query] as const,
} as const;

/** Query keys for semantic-view structure lookups (dimensions / metrics). */
export const semanticViewKeys = {
  all: ['semanticView'] as const,
  structure: (id: string | number) =>
    [...semanticViewKeys.all, 'structure', String(id)] as const,
} as const;

/** Query key for the dashboard properties theme picker. */
export const themeKeys = {
  all: ['theme'] as const,
  list: (query: string) => [...themeKeys.all, 'list', query] as const,
} as const;

/** Query keys for dashboard related-object lookups (owners / roles selects). */
export const relatedKeys = {
  all: ['dashboardRelated'] as const,
  list: (accessType: string, query: string) =>
    [...relatedKeys.all, accessType, query] as const,
} as const;
