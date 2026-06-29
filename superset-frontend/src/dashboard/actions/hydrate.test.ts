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
import { useDashboardStateStore } from 'src/dashboard/stores';
import { HYDRATE_DASHBOARD, hydrateDashboard } from './hydrate';
import {
  DASHBOARD_ROOT_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../util/componentTypes';
import { DASHBOARD_ROOT_ID } from '../util/constants';

/**
 * Regression guard for the follow-up to PR #39417 / PR #41832: the default
 * active-tab path must be seeded into `dashboardState.activeTabs` at hydration
 * time, so every first-render consumer (filter bar, share menus, permalink
 * utilities, screenshot download) reads the dashboard's real default tab path
 * instead of an empty array.
 *
 * Before this change, hydrate seeded `activeTabs: activeTabs ||
 * dashboardState?.activeTabs || []` (hydrate.ts). With no permalink, no stored
 * state and no directPathToChild, that resolved to `[]`, and the live `Tabs`
 * component only populated the value from a post-mount effect. These tests
 * assert the seeded default path and fail without the hydration-time seeding.
 */

const layoutItem = (
  id: string,
  type: string,
  children: string[],
  parents: string[],
) => ({ id, type, children, parents, meta: {} });

const buildDashboard = (
  positionData: Record<string, unknown>,
  title = 'Test dashboard',
) => ({
  id: 1,
  dashboard_title: title,
  css: '',
  published: true,
  changed_on: '2024-01-01T00:00:00.000Z',
  owners: [],
  metadata: {},
  position_data: positionData,
});

const hydrate = (
  positionData: Record<string, unknown>,
  overrides: {
    activeTabs?: string[] | null;
    dashboardState?: Record<string, unknown>;
  } = {},
) => {
  // Stored activeTabs / directPathToChild now live in the Zustand dashboard-state
  // store (read by hydrateDashboard), not Redux getState — seed them there.
  if (overrides.dashboardState) {
    useDashboardStateStore.setState(overrides.dashboardState);
  }
  const dispatch = jest.fn((action: unknown) => action);
  const getState = () =>
    ({
      user: { roles: {}, userId: 1 },
      common: { conf: {} },
    }) as any;
  const action = (
    hydrateDashboard({
      history: { replace: jest.fn() },
      dashboard: buildDashboard(positionData),
      charts: [],
      dataMask: {},
      activeTabs: overrides.activeTabs ?? null,
      chartStates: null,
    } as any) as any
  )(dispatch, getState);
  // hydrateDashboard seeds the resolved path into the Zustand store, not the
  // dispatched Redux action payload.
  return { action, activeTabs: useDashboardStateStore.getState().activeTabs };
};

test('seeds the default (first) tab path for a flat ROOT → TABS → TAB layout', () => {
  const positionData = {
    [DASHBOARD_ROOT_ID]: layoutItem(
      DASHBOARD_ROOT_ID,
      DASHBOARD_ROOT_TYPE,
      ['TABS-1'],
      [],
    ),
    'TABS-1': layoutItem(
      'TABS-1',
      TABS_TYPE,
      ['TAB-1', 'TAB-2'],
      [DASHBOARD_ROOT_ID],
    ),
    'TAB-1': layoutItem('TAB-1', TAB_TYPE, [], [DASHBOARD_ROOT_ID, 'TABS-1']),
    'TAB-2': layoutItem('TAB-2', TAB_TYPE, [], [DASHBOARD_ROOT_ID, 'TABS-1']),
  };

  const { action, activeTabs } = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(activeTabs).toEqual(['TAB-1']);
});

test('seeds the recursive default path for nested TABS containers', () => {
  const positionData = {
    [DASHBOARD_ROOT_ID]: layoutItem(
      DASHBOARD_ROOT_ID,
      DASHBOARD_ROOT_TYPE,
      ['TABS-1'],
      [],
    ),
    'TABS-1': layoutItem(
      'TABS-1',
      TABS_TYPE,
      ['TAB-1', 'TAB-2'],
      [DASHBOARD_ROOT_ID],
    ),
    'TAB-1': layoutItem(
      'TAB-1',
      TAB_TYPE,
      ['TABS-2'],
      [DASHBOARD_ROOT_ID, 'TABS-1'],
    ),
    'TAB-2': layoutItem('TAB-2', TAB_TYPE, [], [DASHBOARD_ROOT_ID, 'TABS-1']),
    'TABS-2': layoutItem(
      'TABS-2',
      TABS_TYPE,
      ['TAB-1-1', 'TAB-1-2'],
      [DASHBOARD_ROOT_ID, 'TABS-1', 'TAB-1'],
    ),
    'TAB-1-1': layoutItem(
      'TAB-1-1',
      TAB_TYPE,
      [],
      [DASHBOARD_ROOT_ID, 'TABS-1', 'TAB-1', 'TABS-2'],
    ),
    'TAB-1-2': layoutItem(
      'TAB-1-2',
      TAB_TYPE,
      [],
      [DASHBOARD_ROOT_ID, 'TABS-1', 'TAB-1', 'TABS-2'],
    ),
  };

  const { action, activeTabs } = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(activeTabs).toEqual(['TAB-1', 'TAB-1-1']);
});

test('seeds the default tab path for an embedded top-level-TABS layout (hideTab scenario)', () => {
  // hideTab is a `uiConfig` property (read at DashboardBuilder.tsx, outside
  // hydrated state), not a layout/position_data property, so it cannot and
  // need not appear in this fixture. The seed derives purely from layout
  // shape and is correct whether or not the top-level tab bar renders — this
  // is an ordinary top-level-TABS layout mirroring state.test.ts's
  // `embeddedLayout`, re-anchoring the #39417 embedded-filter-bar regression
  // guard at the layer (hydration) that now owns the seeded value.
  const positionData = {
    [DASHBOARD_ROOT_ID]: layoutItem(
      DASHBOARD_ROOT_ID,
      DASHBOARD_ROOT_TYPE,
      ['TABS-1'],
      [],
    ),
    'TABS-1': layoutItem(
      'TABS-1',
      TABS_TYPE,
      ['TAB-Company', 'TAB-Desktop'],
      [DASHBOARD_ROOT_ID],
    ),
    'TAB-Company': layoutItem(
      'TAB-Company',
      TAB_TYPE,
      [],
      [DASHBOARD_ROOT_ID, 'TABS-1'],
    ),
    'TAB-Desktop': layoutItem(
      'TAB-Desktop',
      TAB_TYPE,
      [],
      [DASHBOARD_ROOT_ID, 'TABS-1'],
    ),
  };

  const { action, activeTabs } = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(activeTabs).toEqual(['TAB-Company']);
});

// Precedence: the layout default only applies
// to a genuinely fresh load. A permalink `activeTabs`, a non-empty stored
// redux value, or a non-empty `directPathToChild` (deep link) must each
// suppress it.
const flatTabsPositionData = {
  [DASHBOARD_ROOT_ID]: layoutItem(
    DASHBOARD_ROOT_ID,
    DASHBOARD_ROOT_TYPE,
    ['TABS-1'],
    [],
  ),
  'TABS-1': layoutItem(
    'TABS-1',
    TABS_TYPE,
    ['TAB-1', 'TAB-2'],
    [DASHBOARD_ROOT_ID],
  ),
  'TAB-1': layoutItem('TAB-1', TAB_TYPE, [], [DASHBOARD_ROOT_ID, 'TABS-1']),
  'TAB-2': layoutItem('TAB-2', TAB_TYPE, [], [DASHBOARD_ROOT_ID, 'TABS-1']),
};

test('a permalink activeTabs param suppresses the layout default', () => {
  const { activeTabs } = hydrate(flatTabsPositionData, {
    activeTabs: ['TAB-2'],
  });

  expect(activeTabs).toEqual(['TAB-2']);
});

test('a non-empty stored redux activeTabs value suppresses the layout default', () => {
  const { activeTabs } = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: ['TAB-2'] },
  });

  expect(activeTabs).toEqual(['TAB-2']);
});

test('a non-empty directPathToChild (deep link) suppresses the layout default', () => {
  const { activeTabs } = hydrate(flatTabsPositionData, {
    dashboardState: { directPathToChild: ['TAB-2'] },
  });

  expect(activeTabs).toEqual([]);
});

test('an empty stored redux activeTabs value still falls through to the layout default', () => {
  // Pins the `.length` guard: a stored `activeTabs: []` is truthy but must
  // not be treated as "already populated" — otherwise it would win over the
  // layout default and regress to the pre-fix `[]`.
  const { activeTabs } = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: [] },
  });

  expect(activeTabs).toEqual(['TAB-1']);
});

test('a non-empty stored redux value wins over a non-empty directPathToChild', () => {
  // Pins the `||` operand order: stored value is checked before the
  // directPathToChild-gated default branch.
  const { activeTabs } = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: ['TAB-2'], directPathToChild: ['TAB-1'] },
  });

  expect(activeTabs).toEqual(['TAB-2']);
});

test('a permalink activeTabs: [] (empty but present) wins and seeds []', () => {
  // INTENTIONAL legacy-link behavior: unlike the stored-redux operand, the
  // permalink param is not `?.length`-normalized, so a permalink that
  // deliberately encoded "no active tabs" still wins over the layout
  // default. This degrades to the pre-fix one-paint-late correction (the
  // live Tabs component resolves the default after mount) rather than
  // seeding the layout default — no regression, since that was already
  // today's behavior for such links.
  const { activeTabs } = hydrate(flatTabsPositionData, { activeTabs: [] });

  expect(activeTabs).toEqual([]);
});

test('seeds lastModifiedTime as numeric 0, not the changed_on string', () => {
  // A non-numeric seed makes the Header's Math.max(lastModifiedTime, ...) NaN.
  hydrate(flatTabsPositionData);
  const { lastModifiedTime } = useDashboardStateStore.getState();
  expect(lastModifiedTime).toBe(0);
  expect(Number.isNaN(Math.max(lastModifiedTime, 1700000000))).toBe(false);
});
