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
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';
import {
  DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY,
  clampSidebarWidth,
  defaultSidebarPrefs,
  loadSidebarPrefs,
  normalizeSidebarPrefs,
  readSidebarPrefsCache,
  reconcileDashboardOrder,
  saveSidebarPrefs,
  sidebarPrefsUserKey,
  writeSidebarPrefsCache,
} from './sidebarPrefs';
import type { WorkspaceDashboard } from './utils';
import { dashboardIdOrSlug } from './utils';
import { DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH } from './constants';

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: {
      get: jest.fn(),
      put: jest.fn(),
    },
    isFeatureEnabled: () => false,
  };
});

const dashboards: WorkspaceDashboard[] = [
  { id: 1, url: '/dashboard/1/', dashboard_title: 'One' } as WorkspaceDashboard,
  { id: 2, url: '/dashboard/2/', dashboard_title: 'Two' } as WorkspaceDashboard,
  { id: 3, url: '/dashboard/3/', dashboard_title: 'Three' } as WorkspaceDashboard,
];

beforeEach(() => {
  setItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {});
  jest.clearAllMocks();
});

test('reconcile appends new dashboards and drops missing ids', () => {
  const order = ['2', '1'];
  const sorted = reconcileDashboardOrder(dashboards, order);
  expect(sorted.map(d => String(d.id))).toEqual(['2', '1', '3']);
});

test('clampSidebarWidth enforces bounds', () => {
  expect(clampSidebarWidth(100)).toBe(240);
  expect(clampSidebarWidth(999)).toBe(560);
});

test('cache entries are isolated per user id', () => {
  writeSidebarPrefsCache('user-a', {
    order: ['1'],
    width: 400,
    collapsed: true,
  });
  writeSidebarPrefsCache('user-b', defaultSidebarPrefs());

  expect(readSidebarPrefsCache('user-a').width).toBe(400);
  expect(readSidebarPrefsCache('user-b').width).toBe(
    DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
  );
});

test('loadSidebarPrefs uses server value and refreshes cache', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      key: DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY,
      value: { order: ['2'], width: 300, collapsed: true },
    },
  });

  const result = await loadSidebarPrefs('7');
  expect(result.source).toBe('server');
  expect(result.prefs.width).toBe(300);
  expect(readSidebarPrefsCache('7').order).toEqual(['2']);
  expect(SupersetClient.get).toHaveBeenCalledWith({
    endpoint: `/api/v1/user_ui_prefs/${DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY}`,
  });
});

test('loadSidebarPrefs falls back to cache when GET fails', async () => {
  writeSidebarPrefsCache('7', {
    order: ['1'],
    width: 450,
    collapsed: false,
  });
  (SupersetClient.get as jest.Mock).mockRejectedValue(new Error('offline'));

  const result = await loadSidebarPrefs('7');
  expect(result.source).toBe('cache');
  expect(result.prefs.width).toBe(450);
});

test('loadSidebarPrefs treats null server value as defaults', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: { key: DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY, value: null },
  });

  const result = await loadSidebarPrefs('1');
  expect(result.prefs).toEqual(defaultSidebarPrefs());
});

test('saveSidebarPrefs PUTs to API and updates cache on success', async () => {
  (SupersetClient.put as jest.Mock).mockResolvedValue({});
  const prefs = { order: ['1'], width: 320, collapsed: false };

  const ok = await saveSidebarPrefs('1', prefs);
  expect(ok).toBe(true);
  expect(SupersetClient.put).toHaveBeenCalledWith({
    endpoint: `/api/v1/user_ui_prefs/${DASHBOARD_WORKSPACE_SIDEBAR_PREFS_API_KEY}`,
    jsonPayload: { value: prefs },
  });
  expect(readSidebarPrefsCache('1')).toEqual(prefs);
});

test('saveSidebarPrefs writes cache only when PUT fails', async () => {
  (SupersetClient.put as jest.Mock).mockRejectedValue(new Error('offline'));
  const prefs = { order: [], width: 500, collapsed: true };

  const ok = await saveSidebarPrefs('2', prefs);
  expect(ok).toBe(false);
  expect(readSidebarPrefsCache('2')).toEqual(prefs);
});

test('normalizeSidebarPrefs rejects invalid shapes safely', () => {
  expect(normalizeSidebarPrefs(null).width).toBe(
    DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
  );
  expect(
    normalizeSidebarPrefs({ order: null, width: 'x', collapsed: 1 }).collapsed,
  ).toBe(true);
});

test('sidebarPrefsUserKey uses userId or anonymous', () => {
  expect(sidebarPrefsUserKey({ userId: 42 } as never)).toBe('42');
  expect(sidebarPrefsUserKey(undefined)).toBe('anonymous');
});

test('cleared storage returns defaults without throwing', () => {
  writeSidebarPrefsCache('1', {
    order: ['1'],
    width: 500,
    collapsed: false,
  });
  setItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {});
  expect(readSidebarPrefsCache('1')).toEqual(defaultSidebarPrefs());
  expect(getItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {})).toEqual(
    {},
  );
});

test('reconcile keeps API order when order empty', () => {
  const sorted = reconcileDashboardOrder(dashboards, []);
  expect(sorted.map(d => dashboardIdOrSlug(d))).toEqual(
    dashboards.map(d => dashboardIdOrSlug(d)),
  );
});
