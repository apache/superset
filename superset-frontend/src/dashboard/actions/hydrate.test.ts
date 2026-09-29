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
import { HYDRATE_DASHBOARD, hydrateDashboard } from './hydrate';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../util/componentTypes';
import { DASHBOARD_GRID_ID, DASHBOARD_ROOT_ID } from '../util/constants';
import { FilterBarOrientation } from '../types';

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
  metadata: Record<string, unknown> = {},
) => ({
  id: 1,
  dashboard_title: title,
  css: '',
  published: true,
  changed_on: '2024-01-01T00:00:00.000Z',
  owners: [],
  metadata,
  position_data: positionData,
});

/** A user with dashboard-editor privileges, for editMode/permission tests. */
const editorUser = {
  userId: 1,
  username: 'editor',
  permissions: {},
  roles: { Admin: [['can_write', 'Dashboard']] },
};

const hydrate = (
  positionData: Record<string, unknown>,
  overrides: {
    activeTabs?: string[] | null;
    dashboardState?: Record<string, unknown>;
    user?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    charts?: unknown[];
  } = {},
) => {
  const dispatch = jest.fn((action: unknown) => action);
  const getState = () =>
    ({
      user: overrides.user ?? { roles: {}, userId: 1 },
      common: { conf: {} },
      dashboardState: overrides.dashboardState ?? {},
    }) as any;
  const action = (
    hydrateDashboard({
      history: { replace: jest.fn() },
      dashboard: buildDashboard(positionData, undefined, overrides.metadata),
      charts: overrides.charts ?? [],
      dataMask: {},
      activeTabs: overrides.activeTabs ?? null,
      chartStates: null,
    } as any) as any
  )(dispatch, getState);
  return action;
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

  const action = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-1']);
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

  const action = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-1', 'TAB-1-1']);
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

  const action = hydrate(positionData);

  expect(action.type).toBe(HYDRATE_DASHBOARD);
  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-Company']);
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
  const action = hydrate(flatTabsPositionData, { activeTabs: ['TAB-2'] });

  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-2']);
});

test('a non-empty stored redux activeTabs value suppresses the layout default', () => {
  const action = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: ['TAB-2'] },
  });

  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-2']);
});

test('a non-empty directPathToChild (deep link) suppresses the layout default', () => {
  const action = hydrate(flatTabsPositionData, {
    dashboardState: { directPathToChild: ['TAB-2'] },
  });

  expect(action.data.dashboardState.activeTabs).toEqual([]);
});

test('an empty stored redux activeTabs value still falls through to the layout default', () => {
  // Pins the `.length` guard: a stored `activeTabs: []` is truthy but must
  // not be treated as "already populated" — otherwise it would win over the
  // layout default and regress to the pre-fix `[]`.
  const action = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: [] },
  });

  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-1']);
});

test('a non-empty stored redux value wins over a non-empty directPathToChild', () => {
  // Pins the `||` operand order: stored value is checked before the
  // directPathToChild-gated default branch.
  const action = hydrate(flatTabsPositionData, {
    dashboardState: { activeTabs: ['TAB-2'], directPathToChild: ['TAB-1'] },
  });

  expect(action.data.dashboardState.activeTabs).toEqual(['TAB-2']);
});

test('a permalink activeTabs: [] (empty but present) wins and seeds []', () => {
  // INTENTIONAL legacy-link behavior: unlike the stored-redux operand, the
  // permalink param is not `?.length`-normalized, so a permalink that
  // deliberately encoded "no active tabs" still wins over the layout
  // default. This degrades to the pre-fix one-paint-late correction (the
  // live Tabs component resolves the default after mount) rather than
  // seeding the layout default — no regression, since that was already
  // today's behavior for such links.
  const action = hydrate(flatTabsPositionData, { activeTabs: [] });

  expect(action.data.dashboardState.activeTabs).toEqual([]);
});

test('keeps a trapped chart missing from the charts payload in the layout', () => {
  // e.g. an archived chart with SOFT_DELETE: the charts endpoint omits it, so
  // hydration cannot re-add it and only its layout entry keeps its membership
  const positionData = {
    [DASHBOARD_ROOT_ID]: layoutItem(
      DASHBOARD_ROOT_ID,
      DASHBOARD_ROOT_TYPE,
      [DASHBOARD_GRID_ID],
      [],
    ),
    [DASHBOARD_GRID_ID]: layoutItem(
      DASHBOARD_GRID_ID,
      DASHBOARD_GRID_TYPE,
      [],
      [DASHBOARD_ROOT_ID],
    ),
    'COLUMN-orphan': layoutItem(
      'COLUMN-orphan',
      COLUMN_TYPE,
      ['CHART-archived', 'ROW-orphan'],
      [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
    ),
    'ROW-orphan': layoutItem(
      'ROW-orphan',
      ROW_TYPE,
      ['COLUMN-orphan'],
      [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'COLUMN-orphan'],
    ),
    'CHART-archived': {
      ...layoutItem('CHART-archived', CHART_TYPE, [], []),
      meta: { chartId: 42, width: 4, height: 50 },
    },
  };

  const layout = hydrate(positionData).data.dashboardLayout.present;

  expect(layout['COLUMN-orphan']).toBeUndefined();
  expect(layout['ROW-orphan']).toBeUndefined();
  const [rowId] = layout[DASHBOARD_GRID_ID].children;
  expect(layout[rowId].children).toEqual(['CHART-archived']);
  expect(layout['CHART-archived'].meta.chartId).toBe(42);
});

test('rebuilds stale parents from the layout children', () => {
  const positionData = {
    [DASHBOARD_ROOT_ID]: layoutItem(
      DASHBOARD_ROOT_ID,
      DASHBOARD_ROOT_TYPE,
      [DASHBOARD_GRID_ID],
      [],
    ),
    [DASHBOARD_GRID_ID]: layoutItem(
      DASHBOARD_GRID_ID,
      DASHBOARD_GRID_TYPE,
      ['ROW-a'],
      [DASHBOARD_ROOT_ID],
    ),
    'ROW-a': layoutItem('ROW-a', ROW_TYPE, ['COLUMN-a'], [DASHBOARD_ROOT_ID]),
    'COLUMN-a': layoutItem(
      'COLUMN-a',
      COLUMN_TYPE,
      [],
      [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-stale'],
    ),
  };

  const layout = hydrate(positionData).data.dashboardLayout.present;

  expect(layout['ROW-a'].parents).toEqual([
    DASHBOARD_ROOT_ID,
    DASHBOARD_GRID_ID,
  ]);
  expect(layout['COLUMN-a'].parents).toEqual([
    DASHBOARD_ROOT_ID,
    DASHBOARD_GRID_ID,
    'ROW-a',
  ]);
});

// The following tests read the `edit`/regular query params off
// window.location via extractUrlParams, so each restores the original URL.
const originalLocationHref = window.location.href;

afterEach(() => {
  window.history.replaceState(null, '', originalLocationHref);
});

const buildChart = (urlParams: Record<string, unknown> = {}) => ({
  slice_id: 7,
  slice_url: '/explore/?slice_id=7',
  slice_name: 'Test chart',
  form_data: {
    slice_id: 7,
    viz_type: 'table',
    datasource: '1__table',
    url_params: urlParams,
  },
  description: '',
  description_markeddown: '',
  editors: [],
  modified: '',
  changed_on: '2024-01-01T00:00:00.000Z',
});

// hydrate.ts derives editMode from the reserved `edit` URL param
// (extractUrlParams('reserved')), gated on whether the viewer may edit the
// dashboard at all.
test('?edit=true hydrates editMode true for a user who can edit', () => {
  window.history.replaceState(null, '', '/superset/dashboard/1/?edit=true');

  const action = hydrate(flatTabsPositionData, { user: editorUser });

  expect(action.data.dashboardState.editMode).toBe(true);
});

test('editMode is false with no edit param, even for a user who can edit', () => {
  window.history.replaceState(null, '', '/superset/dashboard/1/');

  const action = hydrate(flatTabsPositionData, { user: editorUser });

  expect(action.data.dashboardState.editMode).toBe(false);
});

test('?edit=true does not hydrate editMode for a user without edit permission', () => {
  window.history.replaceState(null, '', '/superset/dashboard/1/?edit=true');

  const action = hydrate(flatTabsPositionData, {
    user: { roles: {}, userId: 1 },
  });

  expect(action.data.dashboardState.editMode).toBe(false);
});

// hydrate.ts merges the non-reserved ("regular") URL query params into every
// chart's form_data.url_params so drill-through/native-filter query params
// carried on the dashboard URL reach each chart's query.
test('a regular url param is merged into the chart form_data url_params', () => {
  window.history.replaceState(null, '', '/superset/dashboard/1/?foo=bar');

  const action = hydrate(flatTabsPositionData, {
    charts: [buildChart()],
  });

  expect(action.data.charts[7].form_data.url_params).toEqual({
    foo: 'bar',
  });
});

test('a regular url param overrides a same-key param already on the chart', () => {
  window.history.replaceState(null, '', '/superset/dashboard/1/?foo=fromUrl');

  const action = hydrate(flatTabsPositionData, {
    charts: [buildChart({ foo: 'fromChart', keep: 'chartOnly' })],
  });

  expect(action.data.charts[7].form_data.url_params).toEqual({
    foo: 'fromUrl',
    keep: 'chartOnly',
  });
});

test('reserved edit and standalone params are not merged into chart form_data url_params', () => {
  window.history.replaceState(
    null,
    '',
    '/superset/dashboard/1/?foo=bar&edit=true&standalone=1',
  );

  const action = hydrate(flatTabsPositionData, {
    charts: [buildChart()],
  });

  expect(action.data.charts[7].form_data.url_params).toEqual({ foo: 'bar' });
});

// hydrate.ts reads filterBarOrientation back from dashboard.metadata
// (metadata.filter_bar_orientation), falling back to Vertical when absent.
test('reads filter_bar_orientation from dashboard metadata', () => {
  const action = hydrate(flatTabsPositionData, {
    metadata: { filter_bar_orientation: FilterBarOrientation.Horizontal },
  });

  expect(action.data.dashboardInfo.filterBarOrientation).toBe(
    FilterBarOrientation.Horizontal,
  );
});

test('falls back to vertical when metadata has no filter_bar_orientation', () => {
  const action = hydrate(flatTabsPositionData, { metadata: {} });

  expect(action.data.dashboardInfo.filterBarOrientation).toBe(
    FilterBarOrientation.Vertical,
  );
});
