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
import { DASHBOARD_GET_COLUMNS } from 'src/hooks/apiResources/dashboards';
import type { ExploreResponsePayload } from 'src/explore/types';
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
}

export async function fetchActivity(
  entityType: VersionedEntityType,
  uuid: string,
  { include = 'all', page = 0, pageSize = 25 }: FetchActivityOptions = {},
): Promise<ActivityResponse> {
  const params = new URLSearchParams({
    include,
    page: String(page),
    page_size: String(pageSize),
  });
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${uuid}/activity/?${params.toString()}`,
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
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${uuid}/versions/${versionUuid}/`,
  });
  return (json as { result: VersionSnapshot }).result;
}

export async function restoreVersion(
  entityType: VersionedEntityType,
  uuid: string,
  versionUuid: string,
): Promise<{ message: string }> {
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/${API_RESOURCE[entityType]}/${uuid}/versions/${versionUuid}/restore`,
  });
  return json as { message: string };
}

/** Creates a new chart from a version snapshot; returns the new chart id. */
export async function createChartFromSnapshot(
  snapshot: ChartVersionSnapshot,
  name: string,
): Promise<number> {
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

/**
 * Creates a new dashboard from a version snapshot; returns the new
 * dashboard id. Charts are shared with the source dashboard (same
 * semantics as "Save as" without duplicating slices).
 */
export async function createDashboardFromSnapshot(
  snapshot: DashboardVersionSnapshot,
  name: string,
): Promise<number> {
  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/dashboard/',
    jsonPayload: {
      dashboard_title: name,
      ...(snapshot.css != null && { css: snapshot.css }),
      ...(snapshot.json_metadata != null && {
        json_metadata: snapshot.json_metadata,
      }),
      ...(snapshot.position_json != null && {
        position_json: snapshot.position_json,
      }),
    },
  });
  return (json as { id: number }).id;
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

export interface DashboardHydrationData {
  dashboard: JsonObject;
  charts: JsonObject[];
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
      owners: dashboard.owners || [],
    },
    charts: (chartsResponse.json as { result: JsonObject[] }).result,
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
