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
import { SupersetClient, makeApi } from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import { updateComponents } from 'src/dashboard/actions/dashboardLayout';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { applySavedFilterChanges } from 'src/dashboard/actions/nativeFilters';
import { updateDataMask } from 'src/dataMask/actions';
import {
  setChartFormData,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import { invalidateChartFormDataCache } from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { applyDefaultFormData } from 'src/explore/store';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { store } from 'src/views/store';
import { navigation } from '../navigation';
import { dashboard } from './index';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: { get: jest.fn() },
  makeApi: jest.fn(),
}));

jest.mock('src/dashboard/actions/dashboardLayout', () => ({
  updateComponents: jest.fn(nextComponents => ({
    type: 'MOCK_UPDATE_COMPONENTS',
    nextComponents,
  })),
}));

jest.mock('src/dashboard/actions/dashboardInfo', () => ({
  dashboardInfoChanged: jest.fn(newInfo => ({
    type: 'MOCK_DASHBOARD_INFO_CHANGED',
    newInfo,
  })),
}));

jest.mock('src/dashboard/actions/nativeFilters', () => ({
  applySavedFilterChanges: jest.fn(),
}));

jest.mock('src/dataMask/actions', () => ({
  updateDataMask: jest.fn((filterId, dataMask) => ({
    type: 'MOCK_UPDATE_DATA_MASK',
    filterId,
    dataMask,
  })),
}));

jest.mock('src/explore/store', () => ({
  applyDefaultFormData: jest.fn(formData => formData),
}));

jest.mock('src/dashboard/util/extractUrlParams', () => jest.fn(() => ({})));

jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters', () => ({
  invalidateChartFormDataCache: jest.fn(),
}));

jest.mock('src/views/store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../navigation', () => ({
  navigation: { getPage: jest.fn() },
}));

const mockGetPage = navigation.getPage as jest.Mock;
const mockGetState = store.getState as jest.Mock;
const mockDispatch = store.dispatch as jest.Mock;
const mockStoreSubscribe = store.subscribe as jest.Mock;
const mockClientGet = SupersetClient.get as jest.Mock;
const mockMakeApi = makeApi as jest.Mock;
const mockApplySavedFilterChanges = applySavedFilterChanges as jest.Mock;
const mockExtractUrlParams = extractUrlParams as jest.Mock;
const mockApplyDefaultFormData = applyDefaultFormData as jest.Mock;
const mockInvalidateChartFormDataCache =
  invalidateChartFormDataCache as jest.Mock;

// isDashboardActive() matches this against `window.location.pathname`'s
// `:idOrSlug`, so a test that activates dashboard N must also route the
// (mocked) browser to it, the way `DashboardPage`'s own URL would.
function activateDashboard(
  overrides: Record<string, unknown> = {},
  pathname?: string,
) {
  mockGetPage.mockReturnValue('dashboard');
  const dashboardInfo = (overrides.dashboardInfo as
    | { id?: number; slug?: string }
    | undefined) ?? { id: 7, css: '' };
  window.location.pathname = pathname ?? `/dashboard/${dashboardInfo.id}/`;
  mockGetState.mockReturnValue({
    dashboardInfo: { id: 7, css: '' },
    dashboardLayout: { present: {} },
    dashboardState: { activeTabs: [] },
    nativeFilters: { filters: {} },
    dataMask: {},
    charts: {},
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reassigning window.location wholesale (rather than just .pathname)
  // ensures it's a plain, freely writable object regardless of what a
  // previous test left it as.
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { pathname: '/' },
  });
  mockGetPage.mockReturnValue('home');
  mockGetState.mockReturnValue({
    dashboardInfo: {},
    dashboardLayout: { present: {} },
    dashboardState: { activeTabs: [] },
    nativeFilters: { filters: {} },
    dataMask: {},
    charts: {},
  });
  mockExtractUrlParams.mockReturnValue({});
  mockApplyDefaultFormData.mockImplementation(formData => formData);
  // clearAllMocks() only clears calls, not a mockImplementation override
  // left over from a previous test, so restore the default here.
  mockStoreSubscribe.mockImplementation(() => jest.fn());
});

const existingFilter = {
  id: 'NATIVE_FILTER-1',
  type: 'NATIVE_FILTER',
  name: 'Region',
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'region' } }],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues: {},
  cascadeParentIds: [],
  defaultDataMask: {},
  description: '',
};

test('getDashboardId returns undefined when the dashboard is not active', () => {
  expect(dashboard.getDashboardId()).toBeUndefined();
});

test('getDashboardId returns the active dashboard id', () => {
  activateDashboard({ dashboardInfo: { id: 42, css: '' } });
  expect(dashboard.getDashboardId()).toBe(42);
});

test('getDashboardId is undefined mid-navigation, when the route has moved on to a new dashboard but Redux hasn’t hydrated it yet', () => {
  // The browser has already routed to dashboard 8, but dashboardInfo (and
  // the other Redux slices) still hold dashboard 5's data until its
  // HYDRATE_DASHBOARD completes.
  mockGetPage.mockReturnValue('dashboard');
  window.location.pathname = '/dashboard/8/';
  mockGetState.mockReturnValue({
    dashboardInfo: { id: 5, css: '' },
    dashboardLayout: { present: {} },
    dashboardState: { activeTabs: [] },
    nativeFilters: { filters: {} },
    dataMask: {},
    charts: {},
  });

  expect(dashboard.getDashboardId()).toBeUndefined();
  expect(dashboard.getCss()).toBe('');
  expect(dashboard.getFilters()).toEqual([]);
});

test('getDashboardId is active again once dashboardInfo catches up with the routed dashboard', () => {
  mockGetPage.mockReturnValue('dashboard');
  window.location.pathname = '/dashboard/8/';
  mockGetState.mockReturnValue({
    dashboardInfo: { id: 8, css: '' },
    dashboardLayout: { present: {} },
    dashboardState: { activeTabs: [] },
    nativeFilters: { filters: {} },
    dataMask: {},
    charts: {},
  });

  expect(dashboard.getDashboardId()).toBe(8);
});

test('getDashboardId matches the routed dashboard by slug', () => {
  mockGetPage.mockReturnValue('dashboard');
  window.location.pathname = '/dashboard/my-dashboard-slug/';
  mockGetState.mockReturnValue({
    dashboardInfo: { id: 8, slug: 'my-dashboard-slug', css: '' },
    dashboardLayout: { present: {} },
    dashboardState: { activeTabs: [] },
    nativeFilters: { filters: {} },
    dataMask: {},
    charts: {},
  });

  expect(dashboard.getDashboardId()).toBe(8);
});

test('getLayout returns {} when the dashboard is not active', () => {
  expect(dashboard.getLayout()).toEqual({});
});

test('getLayout returns a copy of the current layout when active', () => {
  const present = { 'CHART-1': { id: 'CHART-1', meta: { width: 4 } } };
  activateDashboard({ dashboardLayout: { present } });
  const layout = dashboard.getLayout();
  expect(layout).toEqual(present);
  expect(layout).not.toBe(present);
});

test('getLayout freezes the returned map and every node, including nested meta', () => {
  const present = {
    'CHART-1': {
      id: 'CHART-1',
      children: ['CHART-1-content'],
      meta: { width: 4, chartId: 99 },
    },
  };
  activateDashboard({ dashboardLayout: { present } });
  const layout = dashboard.getLayout();

  expect(Object.isFrozen(layout)).toBe(true);
  expect(Object.isFrozen(layout['CHART-1'])).toBe(true);
  expect(Object.isFrozen(layout['CHART-1'].meta)).toBe(true);
  expect(Object.isFrozen(layout['CHART-1'].children)).toBe(true);

  // A mutation attempt must not leak into the next call's result, and must
  // not corrupt the live Redux state it's sharing node references with.
  expect(() => {
    (layout['CHART-1'].meta as Record<string, unknown>).width = 999;
  }).toThrow(TypeError);
  expect(present['CHART-1'].meta.width).toBe(4);
  expect(dashboard.getLayout()['CHART-1'].meta.width).toBe(4);
});

test('getActiveTabs returns [] when the dashboard is not active', () => {
  expect(dashboard.getActiveTabs()).toEqual([]);
});

test('getActiveTabs returns a copy of the current active tab IDs when active', () => {
  const activeTabs = ['TAB-1', 'TAB-1-1'];
  activateDashboard({ dashboardState: { activeTabs } });
  const result = dashboard.getActiveTabs();
  expect(result).toEqual(activeTabs);
  expect(result).not.toBe(activeTabs);
});

test('updateLayoutNode throws when the dashboard is not active', async () => {
  await expect(
    dashboard.updateLayoutNode('CHART-1', { width: 6 }),
  ).rejects.toThrow('No dashboard is currently active');
});

test('updateLayoutNode throws when the node does not exist', async () => {
  activateDashboard();
  await expect(
    dashboard.updateLayoutNode('CHART-missing', { width: 6 }),
  ).rejects.toThrow('Layout node "CHART-missing" not found');
});

test('updateLayoutNode merges meta into the node and preserves other fields', async () => {
  const present = {
    'CHART-1': {
      id: 'CHART-1',
      type: 'CHART',
      meta: { width: 4, height: 50, chartId: 99 },
    },
  };
  activateDashboard({ dashboardLayout: { present } });

  await dashboard.updateLayoutNode('CHART-1', { width: 6 });

  expect(updateComponents).toHaveBeenCalledWith({
    'CHART-1': {
      id: 'CHART-1',
      type: 'CHART',
      meta: { width: 6, height: 50, chartId: 99 },
    },
  });
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'MOCK_UPDATE_COMPONENTS',
    nextComponents: {
      'CHART-1': {
        id: 'CHART-1',
        type: 'CHART',
        meta: { width: 6, height: 50, chartId: 99 },
      },
    },
  });
});

test('getCss returns "" when the dashboard is not active', () => {
  expect(dashboard.getCss()).toBe('');
});

test('getCss returns the current dashboard css', () => {
  activateDashboard({ dashboardInfo: { id: 1, css: '.foo {}' } });
  expect(dashboard.getCss()).toBe('.foo {}');
});

test('setCss throws when the dashboard is not active', async () => {
  await expect(dashboard.setCss('.foo {}')).rejects.toThrow(
    'No dashboard is currently active',
  );
});

test('setCss dispatches dashboardInfoChanged with the new css', async () => {
  activateDashboard();
  await dashboard.setCss('.foo {}');
  expect(dashboardInfoChanged).toHaveBeenCalledWith({ css: '.foo {}' });
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'MOCK_DASHBOARD_INFO_CHANGED',
    newInfo: { css: '.foo {}' },
  });
});

test('getFilters returns [] when the dashboard is not active', () => {
  expect(dashboard.getFilters()).toEqual([]);
});

test('getFilters returns only native filters, with their current mask values', () => {
  activateDashboard({
    nativeFilters: {
      filters: {
        'NATIVE_FILTER-1': {
          id: 'NATIVE_FILTER-1',
          type: 'NATIVE_FILTER',
          name: 'Region',
          filterType: 'filter_select',
          targets: [{ datasetId: 1, column: { name: 'region' } }],
        },
        'DIVIDER-1': {
          id: 'DIVIDER-1',
          type: 'DIVIDER',
          title: 'Section',
        },
      },
    },
    dataMask: {
      'NATIVE_FILTER-1': {
        extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
        filterState: { value: ['US'] },
      },
    },
  });

  expect(dashboard.getFilters()).toEqual([
    {
      id: 'NATIVE_FILTER-1',
      name: 'Region',
      filterType: 'filter_select',
      targets: [{ datasetId: 1, column: { name: 'region' } }],
      extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
      filterState: { value: ['US'] },
    },
  ]);
});

test('updateFilters throws when the dashboard is not active', async () => {
  await expect(
    dashboard.updateFilters([{ filterId: 'NATIVE_FILTER-1' }]),
  ).rejects.toThrow('No dashboard is currently active');
});

test('updateFilters throws when an update references a filter not on this dashboard, and dispatches nothing', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });

  await expect(
    dashboard.updateFilters([
      { filterId: 'NATIVE_FILTER-1', filterState: { value: ['US'] } },
      { filterId: 'NATIVE_FILTER-missing', filterState: { value: ['US'] } },
    ]),
  ).rejects.toThrow(
    'Filter "NATIVE_FILTER-missing" not found on this dashboard',
  );
  expect(updateDataMask).not.toHaveBeenCalled();
});

test('updateFilters only includes the fields the caller supplied', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });

  await dashboard.updateFilters([
    { filterId: 'NATIVE_FILTER-1', filterState: { value: ['US'] } },
  ]);

  // A filterState-only update must not clear extraFormData by sending it as
  // undefined — that would erase the filter's query-modifying payload.
  expect(updateDataMask).toHaveBeenCalledWith('NATIVE_FILTER-1', {
    filterState: { value: ['US'] },
  });
});

test('updateFilters applies both extraFormData and filterState when both are supplied', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });

  const extraFormData = { filters: [{ col: 'region', op: 'IN', val: ['US'] }] };
  await dashboard.updateFilters([
    {
      filterId: 'NATIVE_FILTER-1',
      extraFormData,
      filterState: { value: ['US'] },
    },
  ]);

  expect(updateDataMask).toHaveBeenCalledWith('NATIVE_FILTER-1', {
    extraFormData,
    filterState: { value: ['US'] },
  });
});

test('refreshChart throws when the dashboard is not active', async () => {
  await expect(dashboard.refreshChart(1)).rejects.toThrow(
    'No dashboard is currently active',
  );
});

test('refreshChart throws when the chart is not on the current dashboard', async () => {
  activateDashboard({ charts: {} });
  await expect(dashboard.refreshChart(123)).rejects.toThrow(
    'Chart 123 is not on the current dashboard',
  );
  expect(mockClientGet).not.toHaveBeenCalled();
});

test("refreshChart throws when the chart's configuration can't be retrieved", async () => {
  activateDashboard({ charts: { 123: { id: 123 } } });
  mockClientGet.mockResolvedValue({ json: { result: [] } });

  await expect(dashboard.refreshChart(123)).rejects.toThrow(
    "Could not load chart 123's current configuration",
  );
});

test('refreshChart re-fetches, merges url params, and re-queries the chart', async () => {
  activateDashboard({
    charts: { 123: { id: 123, chartStatus: 'rendered' } },
  });
  mockClientGet.mockResolvedValue({
    json: {
      result: [
        {
          id: 123,
          form_data: {
            slice_id: 123,
            viz_type: 'big_number',
            url_params: { foo: 'bar' },
          },
        },
      ],
    },
  });
  mockExtractUrlParams.mockReturnValue({ standalone: undefined, baz: 'qux' });

  await dashboard.refreshChart(123);

  expect(mockClientGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/dashboard/7/charts',
  });
  const expectedFormData = {
    slice_id: 123,
    viz_type: 'big_number',
    url_params: { foo: 'bar', standalone: undefined, baz: 'qux' },
  };
  expect(applyDefaultFormData).toHaveBeenCalledWith(expectedFormData);
  expect(mockInvalidateChartFormDataCache).toHaveBeenCalledWith(123);
  // setChartFormData/triggerQuery are plain, real (unmocked) action
  // creators here, so calling them again produces the same comparable
  // action object dispatch should have received.
  expect(mockDispatch).toHaveBeenNthCalledWith(
    1,
    setChartFormData(expectedFormData as unknown as QueryFormData, 123),
  );
  expect(mockDispatch).toHaveBeenNthCalledWith(2, triggerQuery(true, 123));
  expect(mockDispatch).toHaveBeenCalledTimes(2);
});

test('refreshChart waits for the chart to reach a terminal status before resolving', async () => {
  const charts: Record<number, { id: number; chartStatus?: string }> = {
    123: { id: 123, chartStatus: 'loading' },
  };
  activateDashboard({ charts });
  mockClientGet.mockResolvedValue({
    json: {
      result: [
        { id: 123, form_data: { slice_id: 123, viz_type: 'big_number' } },
      ],
    },
  });
  const unsubscribe = jest.fn();
  mockStoreSubscribe.mockImplementation(listener => {
    // Redux never calls a listener synchronously from within subscribe()
    // itself — only after some later dispatch — so defer this like a real
    // store would, to also exercise the returned unsubscribe being called.
    queueMicrotask(() => {
      charts[123].chartStatus = 'rendered';
      listener();
    });
    return unsubscribe;
  });

  await dashboard.refreshChart(123);

  expect(mockStoreSubscribe).toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalled();
});

test('saveFilters throws when the dashboard is not active', async () => {
  await expect(
    dashboard.saveFilters([{ filterId: 'NATIVE_FILTER-1', name: 'EMEA' }]),
  ).rejects.toThrow('No dashboard is currently active');
});

test('saveFilters throws when an update references a filter not on this dashboard', async () => {
  activateDashboard({ nativeFilters: { filters: {} } });

  await expect(
    dashboard.saveFilters([{ filterId: 'NATIVE_FILTER-missing', name: 'x' }]),
  ).rejects.toThrow(
    'Filter "NATIVE_FILTER-missing" not found on this dashboard',
  );
  expect(mockMakeApi).not.toHaveBeenCalled();
});

test('saveFilters is a no-op when there are no updates or deletions', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });

  await dashboard.saveFilters([]);

  expect(mockMakeApi).not.toHaveBeenCalled();
  expect(mockApplySavedFilterChanges).not.toHaveBeenCalled();
});

test('saveFilters merges partial updates onto the existing filter and persists them', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });
  const savedFilter = {
    ...existingFilter,
    name: 'Region (EMEA)',
    // The server's copy of scope fields, which the save call itself never
    // sent — these must be stripped before the result reaches Redux so
    // this session's own calculateScopes output isn't clobbered.
    chartsInScope: [1, 2],
    tabsInScope: ['TAB-1'],
  };
  const mockRequest = jest.fn().mockResolvedValue({ result: [savedFilter] });
  mockMakeApi.mockReturnValue(mockRequest);

  await dashboard.saveFilters([
    { filterId: 'NATIVE_FILTER-1', name: 'Region (EMEA)' },
  ]);

  expect(mockMakeApi).toHaveBeenCalledWith({
    method: 'PUT',
    endpoint: '/api/v1/dashboard/7/filters',
  });
  const expectedFilterChanges = {
    modified: [{ ...existingFilter, name: 'Region (EMEA)' }],
    deleted: [],
    reordered: [],
  };
  expect(mockRequest).toHaveBeenCalledWith(expectedFilterChanges);
  expect(mockApplySavedFilterChanges).toHaveBeenCalledWith(
    store.dispatch,
    expectedFilterChanges,
    [savedFilter],
    { 'NATIVE_FILTER-1': existingFilter },
  );
});

test('saveFilters restores a filter’s live value after a save that only changed its name', async () => {
  // A prior updateFilters() call left a session-only value live in
  // dataMask, which applySavedFilterChanges would otherwise wipe back to
  // the filter's default since this save includes it in `modified`.
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
    dataMask: {
      'NATIVE_FILTER-1': {
        extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
        filterState: { value: ['US'] },
      },
    },
  });
  const mockRequest = jest
    .fn()
    .mockResolvedValue({ result: [{ ...existingFilter, name: 'EMEA' }] });
  mockMakeApi.mockReturnValue(mockRequest);

  await dashboard.saveFilters([{ filterId: 'NATIVE_FILTER-1', name: 'EMEA' }]);

  expect(updateDataMask).toHaveBeenCalledWith('NATIVE_FILTER-1', {
    extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
    filterState: { value: ['US'] },
  });
});

test('saveFilters does not restore a live value when the update explicitly sets a new default', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
    dataMask: {
      'NATIVE_FILTER-1': {
        extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
        filterState: { value: ['US'] },
      },
    },
  });
  const mockRequest = jest.fn().mockResolvedValue({ result: [existingFilter] });
  mockMakeApi.mockReturnValue(mockRequest);

  await dashboard.saveFilters([
    { filterId: 'NATIVE_FILTER-1', defaultDataMask: { filterState: {} } },
  ]);

  expect(updateDataMask).not.toHaveBeenCalled();
});

test('saveFilters supports deleting filters without any modifications', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });
  const mockRequest = jest.fn().mockResolvedValue({ result: [] });
  mockMakeApi.mockReturnValue(mockRequest);

  await dashboard.saveFilters([], ['NATIVE_FILTER-1']);

  const expectedFilterChanges = {
    modified: [],
    deleted: ['NATIVE_FILTER-1'],
    reordered: [],
  };
  expect(mockRequest).toHaveBeenCalledWith(expectedFilterChanges);
  expect(mockApplySavedFilterChanges).toHaveBeenCalledWith(
    store.dispatch,
    expectedFilterChanges,
    [],
    { 'NATIVE_FILTER-1': existingFilter },
  );
});

test('saveFilters propagates a failed save instead of swallowing it', async () => {
  activateDashboard({
    nativeFilters: { filters: { 'NATIVE_FILTER-1': existingFilter } },
  });
  const mockRequest = jest.fn().mockRejectedValue(new Error('network error'));
  mockMakeApi.mockReturnValue(mockRequest);

  await expect(
    dashboard.saveFilters([{ filterId: 'NATIVE_FILTER-1', name: 'x' }]),
  ).rejects.toThrow('network error');
  expect(mockApplySavedFilterChanges).not.toHaveBeenCalled();
});
