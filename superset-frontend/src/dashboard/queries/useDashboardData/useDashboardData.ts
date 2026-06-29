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

import rison from 'rison';
import { useQuery } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import type { Dashboard } from 'src/dashboard/types';
import { dashboardKeys } from '../keys';

const DASHBOARD_GET_COLUMNS = [
  'id',
  'slug',
  'url',
  'dashboard_title',
  'published',
  'css',
  'theme',
  'json_metadata',
  'position_json',
  'certified_by',
  'certification_details',
  'changed_by_name',
  'changed_by',
  'changed_on',
  'created_by',
  'charts',
  'owners',
  'roles',
  'tags',
  'changed_on_delta_humanized',
  'created_on_delta_humanized',
  'is_managed_externally',
  'uuid',
];

export function useDashboardQuery(
  idOrSlug: string | number,
  options?: {
    staleTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
  },
) {
  return useQuery({
    queryKey: dashboardKeys.detail(idOrSlug),
    queryFn: async () => {
      const q = rison.encode({ columns: DASHBOARD_GET_COLUMNS });
      const response = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${idOrSlug}?q=${q}`,
      });
      const dashboard: Dashboard = response.json.result;
      return {
        ...dashboard,
        metadata:
          (dashboard.json_metadata && JSON.parse(dashboard.json_metadata)) ||
          {},
        position_data:
          dashboard.position_json && JSON.parse(dashboard.position_json),
        owners: dashboard.owners || [],
      };
    },
    enabled: options?.enabled,
    // Only set when provided; an explicit `undefined` would override the
    // global defaults (e.g. staleTime undefined -> 0, refetch every focus).
    ...(options?.staleTime !== undefined && { staleTime: options.staleTime }),
    ...(options?.refetchOnWindowFocus !== undefined && {
      refetchOnWindowFocus: options.refetchOnWindowFocus,
    }),
  });
}
