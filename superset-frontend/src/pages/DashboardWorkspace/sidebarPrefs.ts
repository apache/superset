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
import {
  getItem,
  LocalStorageKeys,
  setItem,
  type DashboardWorkspaceSidebarPrefsValue,
} from 'src/utils/localStorageHelpers';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
  DASHBOARD_WORKSPACE_SIDEBAR_MAX_WIDTH,
  DASHBOARD_WORKSPACE_SIDEBAR_MIN_WIDTH,
} from './constants';
import { dashboardIdOrSlug, type WorkspaceDashboard } from './utils';

export const DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY =
  'dashboard_workspace_sidebar';

export type SidebarPrefs = DashboardWorkspaceSidebarPrefsValue;

export function sidebarPrefsUserKey(
  user?: UserWithPermissionsAndRoles,
): string {
  if (user?.userId != null) {
    return String(user.userId);
  }
  return 'anonymous';
}

export function clampSidebarWidth(width: number): number {
  return Math.min(
    DASHBOARD_WORKSPACE_SIDEBAR_MAX_WIDTH,
    Math.max(DASHBOARD_WORKSPACE_SIDEBAR_MIN_WIDTH, width),
  );
}

export function defaultSidebarPrefs(): SidebarPrefs {
  return {
    order: [],
    width: DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
    collapsed: false,
  };
}

export function normalizeSidebarPrefs(raw: unknown): SidebarPrefs {
  const defaults = defaultSidebarPrefs();
  if (raw === null || raw === undefined) {
    return defaults;
  }
  if (typeof raw !== 'object') {
    return defaults;
  }
  const record = raw as Partial<SidebarPrefs>;
  return {
    order: Array.isArray(record.order)
      ? record.order.filter((id): id is string => typeof id === 'string')
      : defaults.order,
    width: clampSidebarWidth(
      typeof record.width === 'number' ? record.width : defaults.width,
    ),
    collapsed: Boolean(record.collapsed),
  };
}

export function readSidebarPrefsCache(userKey: string): SidebarPrefs {
  const all = getItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {});
  return normalizeSidebarPrefs(all[userKey]);
}

export function writeSidebarPrefsCache(
  userKey: string,
  prefs: SidebarPrefs,
): void {
  const all = getItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {});
  setItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {
    ...all,
    [userKey]: prefs,
  });
}

export type SidebarPrefsLoadResult =
  | { source: 'server'; prefs: SidebarPrefs }
  | { source: 'cache'; prefs: SidebarPrefs };

export async function loadSidebarPrefs(
  userKey: string,
): Promise<SidebarPrefsLoadResult> {
  try {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/user_ui_prefs/${DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY}`,
    });
    const prefs = normalizeSidebarPrefs(json?.value);
    writeSidebarPrefsCache(userKey, prefs);
    return { source: 'server', prefs };
  } catch {
    return { source: 'cache', prefs: readSidebarPrefsCache(userKey) };
  }
}

export async function saveSidebarPrefs(
  userKey: string,
  prefs: SidebarPrefs,
): Promise<boolean> {
  try {
    await SupersetClient.put({
      endpoint: `/api/v1/user_ui_prefs/${DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY}`,
      jsonPayload: { value: prefs },
    });
    writeSidebarPrefsCache(userKey, prefs);
    return true;
  } catch {
    writeSidebarPrefsCache(userKey, prefs);
    return false;
  }
}

export function reconcileDashboardOrder(
  dashboards: WorkspaceDashboard[],
  order: string[],
): WorkspaceDashboard[] {
  const keyFor = (d: WorkspaceDashboard) => dashboardIdOrSlug(d);
  const byKey = new Map(dashboards.map(d => [keyFor(d), d]));
  const result: WorkspaceDashboard[] = [];
  const seen = new Set<string>();

  order.forEach(id => {
    const dashboard = byKey.get(id);
    if (dashboard) {
      result.push(dashboard);
      seen.add(id);
    }
  });

  dashboards.forEach(dashboard => {
    const key = keyFor(dashboard);
    if (!seen.has(key)) {
      result.push(dashboard);
    }
  });

  return result;
}

export function orderKeysFromDashboards(
  dashboards: WorkspaceDashboard[],
): string[] {
  return dashboards.map(d => dashboardIdOrSlug(d));
}
