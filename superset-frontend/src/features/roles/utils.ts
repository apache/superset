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

import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import rison from 'rison';
import { SelectOption } from './types';

export const createRole = async (name: string) =>
  SupersetClient.post({
    endpoint: '/api/v1/security/roles/',
    jsonPayload: { name },
  });

export const updateRolePermissions = async (
  roleId: number,
  permissionIds: number[],
) =>
  SupersetClient.post({
    endpoint: `/api/v1/security/roles/${roleId}/permissions`,
    jsonPayload: { permission_view_menu_ids: permissionIds },
  });

export const updateRoleUsers = async (roleId: number, userIds: number[]) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}/users`,
    jsonPayload: { user_ids: userIds },
  });

export const updateRoleGroups = async (roleId: number, groupIds: number[]) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}/groups`,
    jsonPayload: { group_ids: groupIds },
  });

export const updateRoleName = async (roleId: number, name: string) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}`,
    jsonPayload: { name },
  });

export const formatPermissionLabel = (
  permissionName: string,
  viewMenuName: string,
) => `${permissionName.replace(/_/g, ' ')} ${viewMenuName.replace(/_/g, ' ')}`;

type PermissionResult = {
  id: number;
  permission: { name: string };
  view_menu: { name: string };
};

const mapPermissionResults = (results: PermissionResult[]) =>
  results.map(item => ({
    value: item.id,
    label: formatPermissionLabel(item.permission.name, item.view_menu.name),
  }));

const PAGE_SIZE = 1000;
const CONCURRENCY_LIMIT = 3;
const MAX_CACHE_ENTRIES = 20;
const permissionSearchCache = new Map<string, SelectOption[]>();

export const clearPermissionSearchCache = () => {
  permissionSearchCache.clear();
};

const fetchPermissionPageRaw = async (queryParams: Record<string, unknown>) => {
  const response = await SupersetClient.get({
    endpoint: `/api/v1/security/permissions-resources/?q=${rison.encode(queryParams)}`,
  });
  return {
    data: mapPermissionResults(response.json?.result || []),
    totalCount: response.json?.count ?? 0,
  };
};

const fetchAllPermissionPages = async (
  filters: Record<string, unknown>[],
): Promise<SelectOption[]> => {
  const page0 = await fetchPermissionPageRaw({
    page: 0,
    page_size: PAGE_SIZE,
    filters,
  });
  if (page0.data.length === 0 || page0.data.length >= page0.totalCount) {
    return page0.data;
  }

  // Use actual returned size — backend may cap below PAGE_SIZE
  const actualPageSize = page0.data.length;
  const totalPages = Math.ceil(page0.totalCount / actualPageSize);
  const allResults = [...page0.data];

  // Fetch remaining pages in batches of CONCURRENCY_LIMIT
  for (let batch = 1; batch < totalPages; batch += CONCURRENCY_LIMIT) {
    const batchEnd = Math.min(batch + CONCURRENCY_LIMIT, totalPages);
    const batchResults = await Promise.all(
      Array.from({ length: batchEnd - batch }, (_, i) =>
        fetchPermissionPageRaw({
          page: batch + i,
          page_size: PAGE_SIZE,
          filters,
        }),
      ),
    );
    for (const r of batchResults) {
      allResults.push(...r.data);
      if (r.data.length === 0) return allResults;
    }
    if (allResults.length >= page0.totalCount) break;
  }

  return allResults;
};

export const fetchPermissionOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
  addDangerToast: (msg: string) => void,
) => {
  if (!filterValue) {
    try {
      return await fetchPermissionPageRaw({
        page,
        page_size: pageSize,
        order_column: 'id',
        order_direction: 'asc',
      });
    } catch {
      addDangerToast(t('There was an error while fetching permissions'));
      return { data: [], totalCount: 0 };
    }
  }

  try {
    const cacheKey = filterValue.trim().toLowerCase();
    let cached = permissionSearchCache.get(cacheKey);
    if (!cached) {
      const [byViewMenu, byPermission] = await Promise.all([
        fetchAllPermissionPages([
          { col: 'view_menu.name', opr: 'ct', value: filterValue },
        ]),
        fetchAllPermissionPages([
          { col: 'permission.name', opr: 'ct', value: filterValue },
        ]),
      ]);

      const seen = new Set<number>();
      cached = [...byViewMenu, ...byPermission].filter(item => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
      if (permissionSearchCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = permissionSearchCache.keys().next().value;
        if (oldestKey !== undefined) {
          permissionSearchCache.delete(oldestKey);
        }
      }
      permissionSearchCache.set(cacheKey, cached);
    }

    const start = page * pageSize;
    return {
      data: cached.slice(start, start + pageSize),
      totalCount: cached.length,
    };
  } catch {
    addDangerToast(t('There was an error while fetching permissions'));
    return { data: [], totalCount: 0 };
  }
};

export const fetchGroupOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
  addDangerToast: (msg: string) => void,
) => {
  const query = rison.encode({
    page,
    page_size: pageSize,
    order_column: 'name',
    order_direction: 'asc',
    ...(filterValue
      ? { filters: [{ col: 'name', opr: 'ct', value: filterValue }] }
      : {}),
  });

  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/security/groups/?q=${query}`,
    });

    const results = response.json?.result || [];
    return {
      data: results.map((group: { id: number; name: string }) => ({
        value: group.id,
        label: group.name,
      })),
      totalCount: response.json?.count ?? 0,
    };
  } catch {
    addDangerToast(t('There was an error while fetching groups'));
    return { data: [], totalCount: 0 };
  }
};
