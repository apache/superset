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
import { t } from '@apache-superset/core';
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

const MAX_PERMISSION_SEARCH_SIZE = 5000;
const permissionSearchCache = new Map<string, SelectOption[]>();

export const clearPermissionSearchCache = () => {
  permissionSearchCache.clear();
};

const fetchPermissionPageRaw = async (
  queryParams: Record<string, unknown>,
) => {
  const response = await SupersetClient.get({
    endpoint: `/api/v1/security/permissions-resources/?q=${rison.encode(queryParams)}`,
  });
  return {
    data: mapPermissionResults(response.json?.result || []),
    totalCount: response.json?.count ?? 0,
  };
};

export const fetchPermissionOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
  addDangerToast: (msg: string) => void,
) => {
  if (!filterValue) {
    permissionSearchCache.clear();
    try {
      return await fetchPermissionPageRaw({ page, page_size: pageSize });
    } catch {
      addDangerToast(t('There was an error while fetching permissions'));
      return { data: [], totalCount: 0 };
    }
  }

  try {
    let cached = permissionSearchCache.get(filterValue);
    if (!cached) {
      const searchQuery = { page: 0, page_size: MAX_PERMISSION_SEARCH_SIZE };
      const [byViewMenu, byPermission] = await Promise.all([
        fetchPermissionPageRaw({
          ...searchQuery,
          filters: [
            { col: 'view_menu.name', opr: 'ct', value: filterValue },
          ],
        }),
        fetchPermissionPageRaw({
          ...searchQuery,
          filters: [
            { col: 'permission.name', opr: 'ct', value: filterValue },
          ],
        }),
      ]);

      const seen = new Set<number>();
      cached = [...byViewMenu.data, ...byPermission.data].filter(item => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
      permissionSearchCache.set(filterValue, cached);
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
