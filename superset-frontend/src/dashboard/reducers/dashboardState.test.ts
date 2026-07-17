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
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import dashboardStateReducer from './dashboardState';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import { setActiveTab, setActiveTabs } from '../actions/dashboardState';
import { DashboardState, RootState } from '../types';

// Type the reducer function properly since it's imported from JS
type DashboardStateReducer = (
  state: Partial<DashboardState> | undefined,
  action: any,
) => Partial<DashboardState>;
const typedDashboardStateReducer =
  dashboardStateReducer as DashboardStateReducer;

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

// Helper function to create mock dashboard state with proper types
const createMockDashboardState = (
  overrides: Partial<DashboardState> = {},
): DashboardState => ({
  editMode: false,
  isPublished: false,
  directPathToChild: [],
  activeTabs: [],
  fullSizeChartId: null,
  isRefreshing: false,
  isFiltersRefreshing: false,
  hasUnsavedChanges: false,
  dashboardIsSaving: false,
  colorScheme: '',
  sliceIds: [],
  directPathLastUpdated: 0,
  nativeFiltersBarOpen: false,
  refreshFrequency: 0,
  ...overrides,
});

describe('DashboardState reducer', () => {
  describe('SET_ACTIVE_TAB', () => {
    it('switches a single tab', () => {
      const store = mockStore({
        dashboardState: { activeTabs: [] },
        dashboardLayout: { present: { tab1: { parents: [] } } },
      });
      const request = setActiveTab('tab1');
      const thunkAction = request(store.dispatch, store.getState);

      expect(
        typedDashboardStateReducer(
          createMockDashboardState({ activeTabs: [] }),
          thunkAction,
        ),
      ).toEqual(
        expect.objectContaining({
          activeTabs: ['tab1'],
          inactiveTabs: [],
        }),
      );

      const request2 = setActiveTab('tab2', 'tab1');
      const thunkAction2 = request2(store.dispatch, store.getState);
      expect(
        typedDashboardStateReducer(
          createMockDashboardState({ activeTabs: ['tab1'] }),
          thunkAction2,
        ),
      ).toEqual(
        expect.objectContaining({ activeTabs: ['tab2'], inactiveTabs: [] }),
      );
    });

    it('switches a multi-depth tab', () => {
      const initState = { activeTabs: ['TAB-1', 'TAB-A', 'TAB-__a'] };
      const store = mockStore({
        dashboardState: initState,
        dashboardLayout: {
          present: {
            'TAB-1': { parents: [] },
            'TAB-2': { parents: [] },
            'TAB-A': { parents: ['TAB-1', 'TABS-1'] },
            'TAB-B': { parents: ['TAB-1', 'TABS-1'] },
            'TAB-__a': { parents: ['TAB-1', 'TABS-1', 'TAB-A', 'TABS-A'] },
            'TAB-__b': { parents: ['TAB-1', 'TABS-1', 'TAB-B', 'TABS-B'] },
          },
        },
      });
      let request = setActiveTab('TAB-B', 'TAB-A');
      let thunkAction = request(store.dispatch, store.getState);
      let result = typedDashboardStateReducer(
        createMockDashboardState({ activeTabs: ['TAB-1', 'TAB-A', 'TAB-__a'] }),
        thunkAction,
      );
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-B']),
          inactiveTabs: ['TAB-__a'],
        }),
      );
      request = setActiveTab('TAB-2', 'TAB-1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: ['TAB-2'],
          inactiveTabs: expect.arrayContaining(['TAB-B', 'TAB-__a']),
        }),
      );
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-B']),
          inactiveTabs: ['TAB-__a'],
        }),
      );
      request = setActiveTab('TAB-A', 'TAB-B');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
          inactiveTabs: [],
        }),
      );
      request = setActiveTab('TAB-2', 'TAB-1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-2']),
          inactiveTabs: ['TAB-A', 'TAB-__a'],
        }),
      );
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
          inactiveTabs: [],
        }),
      );
    });

    test('preserves a hydrate-seeded outer ancestor across a nested-tab switch', () => {
      const store = mockStore({
        dashboardState: { activeTabs: ['TAB-Outer1', 'TAB-Inner1'] },
        dashboardLayout: {
          present: {
            'TAB-Outer1': { parents: [] },
            'TAB-Outer2': { parents: [] },
            'TAB-Inner1': { parents: ['TAB-Outer1', 'TABS-2'] },
            'TAB-Inner2': { parents: ['TAB-Outer1', 'TABS-2'] },
          },
        },
      });
      const request = setActiveTab('TAB-Inner2', 'TAB-Inner1');
      const thunkAction = request(
        store.dispatch,
        store.getState as () => RootState,
      );

      const result = typedDashboardStateReducer(
        createMockDashboardState({
          activeTabs: ['TAB-Outer1', 'TAB-Inner1'],
        }),
        thunkAction,
      );

      expect(result.activeTabs).toContain('TAB-Outer1');
      expect(result.activeTabs).toEqual(
        expect.arrayContaining(['TAB-Outer1', 'TAB-Inner2']),
      );
    });

    // Pins the exact seam that replaced the deleted useActiveDashboardTabs
    // layout-walk reconstruction: the Tabs component's initial-mount
    // dispatch (no prevTabId) must not drop a hydrate-seeded outer ancestor
    // either. The prior test only covers a later prev→next switch.
    test('preserves a hydrate-seeded outer ancestor on the initial mount dispatch (no prevTabId)', () => {
      const store = mockStore({
        dashboardState: { activeTabs: ['TAB-Outer1', 'TAB-Inner1'] },
        dashboardLayout: {
          present: {
            'TAB-Outer1': { parents: [] },
            'TAB-Outer2': { parents: [] },
            'TAB-Inner1': { parents: ['TAB-Outer1', 'TABS-2'] },
            'TAB-Inner2': { parents: ['TAB-Outer1', 'TABS-2'] },
          },
        },
      });
      const request = setActiveTab('TAB-Inner1', undefined);
      const thunkAction = request(
        store.dispatch,
        store.getState as () => RootState,
      );

      const result = typedDashboardStateReducer(
        createMockDashboardState({
          activeTabs: ['TAB-Outer1', 'TAB-Inner1'],
        }),
        thunkAction,
      );

      expect(result.activeTabs).toContain('TAB-Outer1');
      expect(result.activeTabs).toEqual(
        expect.arrayContaining(['TAB-Outer1', 'TAB-Inner1']),
      );
    });
  });
  // Pins a side effect of seeding activeTabs at hydration (see
  // actions/hydrate.ts / util/getDefaultActiveTabs.ts): a non-empty seeded
  // activeTabs now reaches HYDRATE_DASHBOARD with entries, which the
  // existing "Initialize tab activation times for initially active tabs"
  // branch below was already written to handle — previously unreachable in
  // practice on a fresh load because activeTabs was always seeded `[]`.
  test('HYDRATE_DASHBOARD populates tabActivationTimes for a seeded activeTabs value', () => {
    const result = typedDashboardStateReducer(undefined, {
      type: HYDRATE_DASHBOARD,
      data: { dashboardState: { activeTabs: ['TAB-1'] } },
    });

    expect(result.activeTabs).toEqual(['TAB-1']);
    expect(result.tabActivationTimes?.['TAB-1']).toEqual(expect.any(Number));
  });

  test('SET_ACTIVE_TABS', () => {
    expect(
      typedDashboardStateReducer(
        createMockDashboardState({ activeTabs: [] }),
        setActiveTabs(['tab1']),
      ),
    ).toEqual(expect.objectContaining({ activeTabs: ['tab1'] }));
    expect(
      typedDashboardStateReducer(
        createMockDashboardState({ activeTabs: ['tab1', 'tab2'] }),
        setActiveTabs(['tab3', 'tab4']),
      ),
    ).toEqual(expect.objectContaining({ activeTabs: ['tab3', 'tab4'] }));
  });
});
