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
/**
 * Guards against the hydration effect in DashboardPage running in a loop.
 * The effect must depend only on [readyToRender, dashboardRestoreKey], not on
 * dashboard/charts, because those are new object refs every render and would
 * cause infinite re-renders. The mocks below return new refs every call to
 * simulate that; we assert hydrateDashboard is dispatched at most a few times.
 */
import { waitFor } from '@testing-library/react';
import { render } from 'spec/helpers/testing-library';
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { MemoryRouter, Route } from 'react-router-dom';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import { DashboardPage } from 'src/dashboard/containers/DashboardPage';

const baseDashboard = {
  id: 1,
  dashboard_title: 'Test Dashboard',
  json_metadata: '{}',
  position_json: null,
  owners: [],
  metadata: {},
  position_data: null,
};

const baseCharts: { slice_id: number; form_data: Record<string, unknown> }[] =
  [];

jest.mock('src/hooks/apiResources/dashboards', () => {
  const actual = jest.requireActual('src/hooks/apiResources/dashboards');
  return {
    ...actual,
    useDashboard: () => ({
      result: { ...baseDashboard },
      error: undefined,
    }),
    useDashboardCharts: () => ({
      result: [...baseCharts],
      error: undefined,
    }),
    useDashboardDatasets: () => ({
      result: [],
      error: undefined,
      status: 'complete' as const,
    }),
  };
});

jest.mock('src/utils/urlUtils', () => ({
  getUrlParam: () => undefined,
}));

const initialState = {
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    metadata: {},
  },
  dashboardState: {
    sliceIds: [],
    expandedSlices: {},
    refreshFrequency: 0,
    editMode: false,
  },
  charts: {},
  dashboardLayout: {
    present: {
      [DASHBOARD_HEADER_ID]: { meta: { text: 'Dashboard Title' } },
    },
    past: [],
    future: [],
  },
};

test('hydration effect does not run in a loop when dashboard/charts refs change every render', async () => {
  const hydrateSpy = jest.spyOn(
    require('src/dashboard/actions/hydrate'),
    'hydrateDashboard',
  );

  const store = createStore(initialState, reducerIndex);
  render(
    <MemoryRouter initialEntries={['/dashboard/1']}>
      <Route path="/dashboard/:idOrSlug">
        <DashboardPage idOrSlug="1" />
      </Route>
    </MemoryRouter>,
    {
      useRedux: true,
      useTheme: true,
      store,
    },
  );

  await waitFor(
    () => {
      expect(hydrateSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  const countAfterFirstRun = hydrateSpy.mock.calls.length;
  await new Promise(r => setTimeout(r, 200));

  expect(hydrateSpy.mock.calls.length).toBeLessThanOrEqual(
    countAfterFirstRun + 1,
  );
  expect(hydrateSpy.mock.calls.length).toBeLessThanOrEqual(3);

  hydrateSpy.mockRestore();
});
