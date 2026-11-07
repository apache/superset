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
import type { DashboardLayout } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { pickEffectiveThemeId } from './useEffectiveThemeId';

/**
 * Helper to build a minimally-shaped `DashboardLayout` for these tests.
 * The real reducer carries many more fields per node; only `parents` and
 * `meta` are read by the resolver.
 */
const buildLayout = (
  nodes: Record<
    string,
    {
      parents?: string[];
      themeId?: number | null;
      extraMeta?: Record<string, unknown>;
    }
  >,
): DashboardLayout =>
  Object.fromEntries(
    Object.entries(nodes).map(([id, { parents, themeId, extraMeta }]) => [
      id,
      {
        id,
        type: 'CHART',
        children: [],
        parents,
        meta: {
          ...extraMeta,
          ...(themeId !== undefined ? { themeId } : {}),
        },
      },
    ]),
  ) as unknown as DashboardLayout;

test('returns null for missing layoutId', () => {
  expect(pickEffectiveThemeId(undefined, buildLayout({}))).toBeNull();
  expect(pickEffectiveThemeId('CHART-1', buildLayout({}))).toBeNull();
});

test("returns the node's own themeId when set", () => {
  const layout = buildLayout({
    'CHART-1': {
      parents: [DASHBOARD_ROOT_ID, 'ROW-1'],
      themeId: 42,
    },
    'ROW-1': { parents: [DASHBOARD_ROOT_ID], themeId: 7 },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBe(42);
});

test("inherits the closest ancestor's themeId when own is unset", () => {
  const layout = buildLayout({
    'CHART-1': { parents: [DASHBOARD_ROOT_ID, 'TAB-1', 'ROW-1'] },
    'ROW-1': { parents: [DASHBOARD_ROOT_ID, 'TAB-1'], themeId: 7 },
    'TAB-1': { parents: [DASHBOARD_ROOT_ID], themeId: 99 },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBe(7);
});

test('skips ancestors whose themeId is null and continues walking', () => {
  // A literal `null` on a node means "I don't override" — keep walking.
  const layout = buildLayout({
    'CHART-1': { parents: [DASHBOARD_ROOT_ID, 'TAB-1', 'ROW-1'] },
    'ROW-1': { parents: [DASHBOARD_ROOT_ID, 'TAB-1'], themeId: null },
    'TAB-1': { parents: [DASHBOARD_ROOT_ID], themeId: 99 },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBe(99);
});

test('returns null when no ancestor sets a themeId', () => {
  const layout = buildLayout({
    'CHART-1': { parents: [DASHBOARD_ROOT_ID, 'ROW-1'] },
    'ROW-1': { parents: [DASHBOARD_ROOT_ID] },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBeNull();
});

test('stops at DASHBOARD_ROOT_ID — root-level theme is the dashboard CRUD theme, handled separately', () => {
  const layout = buildLayout({
    'CHART-1': { parents: [DASHBOARD_ROOT_ID] },
    [DASHBOARD_ROOT_ID]: { parents: [], themeId: 999 },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBeNull();
});

test('does not loop on a malformed parents chain', () => {
  // Self-referential parent shouldn't hang the resolver.
  const layout = buildLayout({
    'CHART-1': { parents: ['CHART-1'] },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBeNull();
});

test('ignores other meta keys', () => {
  const layout = buildLayout({
    'CHART-1': {
      parents: [DASHBOARD_ROOT_ID],
      extraMeta: { sliceName: 'Foo', width: 4, background: 'gray' },
    },
  });
  expect(pickEffectiveThemeId('CHART-1', layout)).toBeNull();
});
