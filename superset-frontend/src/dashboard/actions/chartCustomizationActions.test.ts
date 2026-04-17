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
import fetchMock from 'fetch-mock';
import {
  ChartCustomization,
  ChartCustomizationType,
} from '@superset-ui/core';
import {
  setInScopeStatusOfCustomizations,
  saveChartCustomization,
} from './chartCustomizationActions';
import { SET_IN_SCOPE_STATUS_OF_FILTERS } from './nativeFilters';
import { DASHBOARD_INFO_UPDATED } from './dashboardInfo';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => fetchMock.clearHistory().removeRoutes());

function setup(stateOverrides: Record<string, unknown> = {}) {
  const state = {
    nativeFilters: {
      filters: {},
    },
    dashboardInfo: {
      metadata: {
        chart_customization_config: [],
      },
    },
    ...stateOverrides,
  };
  const getState = jest.fn(() => state) as unknown as () => any;
  const dispatch = jest.fn();
  return { getState, dispatch, state };
}

test('setInScopeStatusOfCustomizations filters null entries from chart_customization_config', () => {
  const { getState, dispatch } = setup({
    nativeFilters: {
      filters: {
        'CUSTOM-1': {
          id: 'CUSTOM-1',
          name: 'Group By',
          chartsInScope: [],
        },
      },
    },
    dashboardInfo: {
      metadata: {
        chart_customization_config: [
          null,
          { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [] },
          null,
        ],
      },
    },
  });

  const thunk = setInScopeStatusOfCustomizations([
    {
      customizationId: 'CUSTOM-1',
      chartsInScope: [10, 20],
      tabsInScope: ['TAB-A'],
    },
  ]);
  thunk(dispatch, getState, null);

  // Should dispatch SET_IN_SCOPE_STATUS_OF_FILTERS for the matching filter
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: SET_IN_SCOPE_STATUS_OF_FILTERS }),
  );

  // Should dispatch DASHBOARD_INFO_UPDATED with only the valid config item (nulls stripped)
  const infoUpdateCall = dispatch.mock.calls.find(
    ([action]: [{ type: string }]) => action.type === DASHBOARD_INFO_UPDATED,
  );
  expect(infoUpdateCall).toBeDefined();
  const updatedConfig =
    infoUpdateCall[0].newInfo.metadata.chart_customization_config;
  expect(updatedConfig).toHaveLength(1);
  expect(updatedConfig[0].id).toBe('CUSTOM-1');
  expect(updatedConfig[0].chartsInScope).toEqual([10, 20]);
  expect(updatedConfig[0].tabsInScope).toEqual(['TAB-A']);
});

test('setInScopeStatusOfCustomizations handles config that is entirely null entries', () => {
  const { getState, dispatch } = setup({
    nativeFilters: { filters: {} },
    dashboardInfo: {
      metadata: {
        chart_customization_config: [null, null],
      },
    },
  });

  const thunk = setInScopeStatusOfCustomizations([
    {
      customizationId: 'CUSTOM-MISSING',
      chartsInScope: [10],
      tabsInScope: [],
    },
  ]);
  thunk(dispatch, getState, null);

  // Should still dispatch the info update with an empty config
  const infoUpdateCall = dispatch.mock.calls.find(
    ([action]: [{ type: string }]) => action.type === DASHBOARD_INFO_UPDATED,
  );
  expect(infoUpdateCall).toBeDefined();
  expect(
    infoUpdateCall[0].newInfo.metadata.chart_customization_config,
  ).toHaveLength(0);
});

test('setInScopeStatusOfCustomizations works with undefined metadata', () => {
  const { getState, dispatch } = setup({
    nativeFilters: { filters: {} },
    dashboardInfo: { metadata: undefined },
  });

  const thunk = setInScopeStatusOfCustomizations([
    {
      customizationId: 'CUSTOM-1',
      chartsInScope: [10],
      tabsInScope: [],
    },
  ]);
  thunk(dispatch, getState, null);

  const infoUpdateCall = dispatch.mock.calls.find(
    ([action]: [{ type: string }]) => action.type === DASHBOARD_INFO_UPDATED,
  );
  expect(infoUpdateCall).toBeDefined();
  expect(
    infoUpdateCall[0].newInfo.metadata.chart_customization_config,
  ).toHaveLength(0);
});

test('saveChartCustomization filters null entries from currentConfig before merging', async () => {
  const customization: ChartCustomization = {
    id: 'CUSTOM-1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Group By',
    filterType: 'chart_customization_dynamic_groupby',
    targets: [{}],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    chartsInScope: [10],
    tabsInScope: ['TAB-A'],
    defaultDataMask: {},
    controlValues: {},
  };

  fetchMock.put('glob:*/api/v1/dashboard/1/chart_customizations', {
    result: [customization],
  });

  const { getState, dispatch } = setup({
    nativeFilters: { filters: {} },
    dashboardInfo: {
      id: 1,
      metadata: {
        chart_customization_config: [
          null,
          { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [10] },
          null,
        ],
      },
    },
  });

  const thunk = saveChartCustomization(
    [customization],
    [],
    [],
    false,
  );
  await thunk(dispatch, getState, null);

  // DASHBOARD_INFO_UPDATED should have merged config without nulls
  const infoUpdateCall = dispatch.mock.calls.find(
    ([action]: [{ type: string }]) => action.type === DASHBOARD_INFO_UPDATED,
  );
  expect(infoUpdateCall).toBeDefined();
  const config =
    infoUpdateCall[0].newInfo.metadata.chart_customization_config;
  expect(config.every((item: unknown) => item !== null)).toBe(true);
});

test('saveChartCustomization filters null entries from oldConfig when resetDataMask is true', async () => {
  const customization: ChartCustomization = {
    id: 'CUSTOM-1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Group By',
    filterType: 'chart_customization_dynamic_groupby',
    targets: [{}],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    chartsInScope: [10],
    tabsInScope: ['TAB-A'],
    defaultDataMask: {},
    controlValues: {},
  };

  fetchMock.put('glob:*/api/v1/dashboard/1/chart_customizations', {
    result: [customization],
  });

  const { getState, dispatch } = setup({
    nativeFilters: { filters: {} },
    dashboardInfo: {
      id: 1,
      metadata: {
        chart_customization_config: [
          null,
          { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [10] },
          null,
        ],
      },
    },
  });

  const thunk = saveChartCustomization(
    [customization],
    [],
    [],
    true,
  );

  // Should not throw when building oldCustomizationsById from null-containing config
  await expect(thunk(dispatch, getState, null)).resolves.toBeDefined();
});
