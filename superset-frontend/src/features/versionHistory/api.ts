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
import { JsonObject, SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import { DASHBOARD_GET_COLUMNS } from 'src/hooks/apiResources/dashboards';
import { CHART_TYPE, MARKDOWN_TYPE } from 'src/dashboard/util/componentTypes';
import type { ExploreResponsePayload } from 'src/explore/types';
import type {
  HydrateChartData,
  HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import type { Dashboard } from 'src/types/Dashboard';
import type {
  ActivityEntityKind,
  ActivityInclude,
  ActivityResponse,
  ChartVersionSnapshot,
  DashboardVersionSnapshot,
  VersionedEntityType,
  VersionSnapshot,
} from './types';

const API_RESOURCE: Record<VersionedEntityType, string> = {
  chart: 'chart',
  dashboard: 'dashboard',
};

export interface FetchActivityOptions {
  include?: ActivityInclude;
  page?: number;
  pageSize?: number;
  /**
   * Case-insensitive free-text search over the full history (not just the
   * loaded pages) — the server filters before paginating, so `count`
   * reflects matches. Debounced upstream.
   */
  q?: string;
}

export async function fetchActivity(
  entityType: VersionedEntityType,
  uuid: string,
  { include = 'all', page = 0, pageSize = 25, q }: FetchActivityOptions = {},
): Promise<ActivityResponse> {
  const params = new URLSearchParams({
    include,
    page: String(page),
    page_size: String(pageSize),
  });
  const trimmedQ = q?.trim();
  if (trimmedQ) {
    params.set('q', trimmedQ);
  }
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${encodeURIComponent(uuid)}/activity/?${params.toString()}`,
  });
  return json as ActivityResponse;
}

export async function fetchVersionSnapshot(
  entityType: 'chart',
  uuid: string,
  versionUuid: string,
): Promise<ChartVersionSnapshot>;
export async function fetchVersionSnapshot(
  entityType: 'dashboard',
  uuid: string,
  versionUuid: string,
): Promise<DashboardVersionSnapshot>;
export async function fetchVersionSnapshot(
  entityType: VersionedEntityType,
  uuid: string,
  versionUuid: string,
): Promise<VersionSnapshot>;
export async function fetchVersionSnapshot(
  entityType: VersionedEntityType,
  uuid: string,
  versionUuid: string,
): Promise<VersionSnapshot> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${encodeURIComponent(uuid)}/versions/${encodeURIComponent(versionUuid)}/`,
  });
  return (json as { result: VersionSnapshot }).result;
}

export async function restoreVersion(
  entityType: VersionedEntityType,
  uuid: string,
  versionUuid: string,
): Promise<{ message: string }> {
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${encodeURIComponent(uuid)}/versions/${encodeURIComponent(versionUuid)}/restore`,
  });
  return json as { message: string };
}

/** Creates a new chart from a version snapshot; returns the new chart id. */
export async function createChartFromSnapshot(
  snapshot: ChartVersionSnapshot,
  name: string,
): Promise<number> {
  // The chart POST requires all three; the version table allows null for each
  // (a delete version carries nulls throughout). Fail here with something the
  // caller can turn into a toast rather than sending a payload the API will
  // reject with a validation error the user cannot act on.
  if (
    snapshot.viz_type == null ||
    snapshot.datasource_id == null ||
    snapshot.datasource_type == null
  ) {
    throw new Error(
      'This version does not record a visualization type and dataset, so a new chart cannot be built from it',
    );
  }
  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/chart/',
    jsonPayload: {
      slice_name: name,
      viz_type: snapshot.viz_type,
      datasource_id: snapshot.datasource_id,
      datasource_type: snapshot.datasource_type,
      ...(snapshot.params != null && { params: snapshot.params }),
      ...(snapshot.query_context != null && {
        query_context: snapshot.query_context,
      }),
      ...(snapshot.description != null && {
        description: snapshot.description,
      }),
      ...(snapshot.cache_timeout != null && {
        cache_timeout: snapshot.cache_timeout,
      }),
    },
  });
  return (json as { id: number }).id;
}

/** The theme shape `dashboardInfo` holds, keyed by id in the snapshot. */
export type DashboardTheme = NonNullable<Dashboard['theme']>;

/**
 * Resolves a snapshot's `theme_id` to the theme object hydration expects.
 * The version table stores the foreign key, not the theme, so a snapshot
 * taken under a different theme than the live dashboard needs one lookup.
 */
export async function fetchDashboardTheme(
  themeId: number,
): Promise<DashboardTheme> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/theme/${themeId}`,
  });
  const { id, result } = json as {
    id: number;
    result: Omit<DashboardTheme, 'id'>;
  };
  return { ...result, id };
}

/**
 * Activity records identify related entities by uuid only; resolve the
 * numeric id (needed for page urls) at click time via the list API.
 */
export async function resolveEntityId(
  kind: ActivityEntityKind,
  uuid: string,
): Promise<number | null> {
  const resource: Record<ActivityEntityKind, string> = {
    chart: 'chart',
    dashboard: 'dashboard',
    dataset: 'dataset',
  };
  const q = rison.encode({
    columns: ['id'],
    filters: [{ col: 'uuid', opr: 'eq', value: uuid }],
    page_size: 1,
  });
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${resource[kind]}/?q=${q}`,
  });
  const { result } = json as { result: Array<{ id: number }> };
  return result.length > 0 ? result[0].id : null;
}

/** The chart id a layout slot references, or null for non-chart slots. */
export const layoutChartId = (item: JsonObject): number | null => {
  const meta = item?.meta as JsonObject | undefined;
  return item?.type === CHART_TYPE && typeof meta?.chartId === 'number'
    ? (meta.chartId as number)
    : null;
};

/**
 * Swaps layout slots whose chart is unreachable (deleted, or not visible
 * to the current user) for a markdown placeholder, preserving the slot's
 * footprint so the rest of the layout is unaffected.
 */
export function swapUnreachableChartSlots(
  positionData: JsonObject,
  unreachableIds: Set<number>,
): JsonObject {
  if (unreachableIds.size === 0) {
    return positionData;
  }
  const layout: JsonObject = { ...positionData };
  Object.entries(layout).forEach(([key, item]) => {
    const chartId = layoutChartId(item as JsonObject);
    if (chartId !== null && unreachableIds.has(chartId)) {
      const meta = (item as JsonObject).meta as JsonObject;
      layout[key] = {
        ...(item as JsonObject),
        type: MARKDOWN_TYPE,
        meta: {
          width: meta?.width,
          height: meta?.height,
          code: t('This chart no longer exists.'),
        },
      };
    }
  });
  return layout;
}

// FAB list endpoints clamp page_size server-side; batches must stay under
// that cap or reachable charts past it would silently be reported missing.
const REACHABLE_CHART_BATCH_SIZE = 100;

/** The subset of the given chart ids that the list API can resolve. */
async function fetchReachableChartIds(
  chartIds: number[],
): Promise<Set<number>> {
  const batches: number[][] = [];
  for (let i = 0; i < chartIds.length; i += REACHABLE_CHART_BATCH_SIZE) {
    batches.push(chartIds.slice(i, i + REACHABLE_CHART_BATCH_SIZE));
  }
  const results = await Promise.all(
    batches.map(async batch => {
      const q = rison.encode({
        columns: ['id'],
        filters: [{ col: 'id', opr: 'in', value: batch }],
        page_size: batch.length,
      });
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${q}`,
      });
      const { result } = json as { result: Array<{ id: number }> };
      return result.map(({ id }) => id);
    }),
  );
  return new Set(results.flat());
}

/**
 * Forks a dashboard version into a new dashboard via the copy endpoint;
 * returns the new dashboard id. The copy endpoint derives the new
 * dashboard's chart associations from the `positions` key of
 * `json_metadata`, so the fork references (shares, not duplicates)
 * exactly the charts present in the snapshot's layout. Slots whose chart
 * no longer resolves are swapped for the same markdown placeholder the
 * preview renders — the copy endpoint would silently skip their chart
 * associations, leaving dead slots in the forked layout.
 */
export async function createDashboardFromSnapshot(
  sourceUuid: string,
  snapshot: DashboardVersionSnapshot,
  name: string,
): Promise<number> {
  const sourceId = await resolveEntityId('dashboard', sourceUuid);
  if (sourceId === null) {
    throw new Error(`No dashboard found for uuid ${sourceUuid}`);
  }
  const metadata: JsonObject = snapshot.json_metadata
    ? JSON.parse(snapshot.json_metadata)
    : {};
  // Always send `positions`, even empty. The copy endpoint rebuilds the new
  // dashboard's layout and chart associations from this key; omitting it
  // leaves the copy with the *source's current* charts, so forking a version
  // that had no layout would produce today's dashboard under a historical
  // name.
  metadata.positions = {};
  if (snapshot.position_json) {
    let positions: JsonObject = JSON.parse(snapshot.position_json);
    const chartIds = new Set<number>();
    Object.values(positions).forEach(item => {
      const chartId = layoutChartId(item as JsonObject);
      if (chartId !== null) {
        chartIds.add(chartId);
      }
    });
    if (chartIds.size > 0) {
      const reachable = await fetchReachableChartIds([...chartIds]);
      const unreachable = new Set(
        [...chartIds].filter(id => !reachable.has(id)),
      );
      positions = swapUnreachableChartSlots(positions, unreachable);
    }
    metadata.positions = positions;
  }
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/dashboard/${encodeURIComponent(sourceId)}/copy/`,
    jsonPayload: {
      dashboard_title: name,
      css: snapshot.css ?? '',
      json_metadata: JSON.stringify(metadata),
    },
  });
  return (json as { result: { id: number } }).result.id;
}

/**
 * Fetches the same explore payload the chart page uses to hydrate, so a
 * restored chart can be reloaded in place without a full page refresh.
 */
export async function fetchExploreRehydrationData(
  sliceId: number,
): Promise<ExploreResponsePayload['result']> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/explore/?slice_id=${sliceId}`,
  });
  return (json as ExploreResponsePayload).result;
}

/**
 * Fetches datasource metadata (same shape the explore page hydrates with)
 * for the datasource a chart version snapshot references, which may no
 * longer match the live chart's datasource.
 */
export async function fetchDatasourceMetadata(
  datasourceId: number,
  datasourceType: string,
): Promise<ExploreResponsePayload['result']['dataset']> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/explore/?datasource_id=${datasourceId}&datasource_type=${encodeURIComponent(datasourceType)}`,
  });
  return (json as ExploreResponsePayload).result.dataset;
}

export interface DashboardHydrationData {
  dashboard: HydrateDashboardData;
  charts: HydrateChartData[];
}

/**
 * Fetches the same dashboard + charts payload the dashboard page uses to
 * hydrate, so a version preview can re-hydrate (and later un-hydrate)
 * without unmounting the page.
 */
export async function fetchDashboardHydrationData(
  id: number,
): Promise<DashboardHydrationData> {
  const q = rison.encode({ columns: DASHBOARD_GET_COLUMNS });
  const [dashboardResponse, chartsResponse] = await Promise.all([
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${id}?q=${q}` }),
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${id}/charts` }),
  ]);
  const dashboard = (dashboardResponse.json as { result: JsonObject }).result;
  return {
    dashboard: {
      ...dashboard,
      metadata: dashboard.json_metadata
        ? JSON.parse(dashboard.json_metadata as string)
        : {},
      position_data: dashboard.position_json
        ? JSON.parse(dashboard.position_json as string)
        : null,
    } as unknown as HydrateDashboardData,
    charts: (chartsResponse.json as { result: HydrateChartData[] }).result,
  };
}

/**
 * The explore redux state only carries the chart's numeric id; resolve
 * its uuid lazily when the version history panel first opens.
 */
export async function fetchChartUuid(sliceId: number): Promise<string> {
  const q = rison.encode({ columns: ['uuid'] });
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/chart/${sliceId}?q=${q}`,
  });
  return (json as { result: { uuid: string } }).result.uuid;
}
