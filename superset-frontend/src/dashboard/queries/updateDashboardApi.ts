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
import type { QueryClient } from '@tanstack/react-query';
import { makeApi } from '@superset-ui/core';
import { DashboardInfo } from 'src/dashboard/types';
import {
  useDashboardInfoStore,
  useDashboardStateStore,
} from 'src/dashboard/stores';
import { rebaselineHydrationDashboardInfo } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
import { dashboardKeys } from './keys';

export interface UpdateDashboardResponse {
  result: Partial<DashboardInfo>;
  last_modified_time: number;
}

/** PUT /api/v1/dashboard/{id} for partial dashboard (metadata) updates. */
export const createUpdateDashboardApi = (id: number) =>
  makeApi<Partial<DashboardInfo>, UpdateDashboardResponse>({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });

/** True while `id` is still the dashboard the user is viewing. */
export const isCurrentDashboard = (id: number): boolean =>
  useDashboardInfoStore.getState().dashboardInfo?.id === id;

/**
 * Shared post-save contract for metadata mutations: push fresh metadata into the
 * store, optionally sync the overwrite-protection timestamp, rebaseline the
 * discard snapshot, and invalidate the detail query.
 */
export function applyMetadataSaveResult(
  queryClient: QueryClient,
  id: number,
  response: UpdateDashboardResponse,
  { markSaved = false }: { markSaved?: boolean } = {},
): void {
  if (response.result.json_metadata) {
    useDashboardInfoStore.getState().setDashboardInfo({
      metadata: JSON.parse(response.result.json_metadata),
    });
  }
  if (markSaved && response.last_modified_time) {
    useDashboardStateStore.getState().markSaved(response.last_modified_time);
  }
  rebaselineHydrationDashboardInfo(id);
  queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(id) });
}
