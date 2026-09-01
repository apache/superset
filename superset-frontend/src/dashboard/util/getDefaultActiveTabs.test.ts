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
import getDefaultActiveTabs from './getDefaultActiveTabs';
import { DASHBOARD_ROOT_ID } from './constants';
import type { DashboardLayout } from '../types';

const layoutItem = (
  id: string,
  type: string,
  children: string[] = [],
): DashboardLayout[string] =>
  ({ id, type, children, meta: {} }) as DashboardLayout[string];

test('returns the first tab path for a flat ROOT → TABS → TAB layout', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', ['TAB-1', 'TAB-2']),
    'TAB-1': layoutItem('TAB-1', 'TAB'),
    'TAB-2': layoutItem('TAB-2', 'TAB'),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual(['TAB-1']);
});

test('recurses into nested TABS containers', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', ['TAB-1', 'TAB-2']),
    'TAB-1': layoutItem('TAB-1', 'TAB', ['TABS-2']),
    'TAB-2': layoutItem('TAB-2', 'TAB'),
    'TABS-2': layoutItem('TABS-2', 'TABS', ['TAB-1-1', 'TAB-1-2']),
    'TAB-1-1': layoutItem('TAB-1-1', 'TAB'),
    'TAB-1-2': layoutItem('TAB-1-2', 'TAB'),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual(['TAB-1', 'TAB-1-1']);
});

test('returns an empty path for a dashboard with no tabs', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['GRID_ID']),
    GRID_ID: layoutItem('GRID_ID', 'GRID', ['CHART-1']),
    'CHART-1': layoutItem('CHART-1', 'CHART'),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual([]);
});

test('returns an empty path when TABS is nested under GRID rather than the first ROOT child', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['GRID_ID']),
    GRID_ID: layoutItem('GRID_ID', 'GRID', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', ['TAB-1']),
    'TAB-1': layoutItem('TAB-1', 'TAB'),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual([]);
});

test('returns an empty path for a layout with no ROOT entry', () => {
  const layout = {} as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual([]);
});

test('returns an empty path when the top-level TABS container has no children', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', []),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual([]);
});

test('returns the outer-only path when a nested TABS container has no children', () => {
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', ['TAB-1']),
    'TAB-1': layoutItem('TAB-1', 'TAB', ['TABS-2']),
    'TABS-2': layoutItem('TABS-2', 'TABS', []),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual(['TAB-1']);
});

test('terminates on a cyclic layout, emitting each id at most once', () => {
  // TAB-1 → TABS-2 → TAB-1 (cycle back to the same tab)
  const layout = {
    [DASHBOARD_ROOT_ID]: layoutItem(DASHBOARD_ROOT_ID, 'ROOT', ['TABS-1']),
    'TABS-1': layoutItem('TABS-1', 'TABS', ['TAB-1']),
    'TAB-1': layoutItem('TAB-1', 'TAB', ['TABS-2']),
    'TABS-2': layoutItem('TABS-2', 'TABS', ['TAB-1']),
  } as unknown as DashboardLayout;

  expect(getDefaultActiveTabs(layout)).toEqual(['TAB-1']);
});
