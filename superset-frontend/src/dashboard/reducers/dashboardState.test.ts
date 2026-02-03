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
import {
  ADD_SLICE,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_EDIT_MODE,
  SET_FOCUSED_FILTER_FIELD,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  TOGGLE_NATIVE_FILTERS_BAR,
  UNSET_FOCUSED_FILTER_FIELD,
  UPDATE_CHART_STATE,
  REMOVE_CHART_STATE,
  RESTORE_CHART_STATES,
  CLEAR_ALL_CHART_STATES,
  setActiveTab,
  setActiveTabs,
} from '../actions/dashboardState';
import { DashboardState } from '../types';

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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardState reducer', () => {
  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('SET_ACTIVE_TAB', () => {
    test('switches a single tab', () => {
      const store = mockStore({
        dashboardState: { activeTabs: [] },
        dashboardLayout: { present: { tab1: { parents: [] } } },
      });
      const request = setActiveTab('tab1');
      const thunkAction = request(store.dispatch, store.getState as any);

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
      const thunkAction2 = request2(store.dispatch, store.getState as any);
      expect(
        typedDashboardStateReducer(
          createMockDashboardState({ activeTabs: ['tab1'] }),
          thunkAction2,
        ),
      ).toEqual(
        expect.objectContaining({ activeTabs: ['tab2'], inactiveTabs: [] }),
      );
    });

    test('switches a multi-depth tab', () => {
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
      let thunkAction = request(store.dispatch, store.getState as any);
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
      thunkAction = request(store.dispatch, (() => ({
        ...(store.getState() as object),
        dashboardState: result as DashboardState,
      })) as any);
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: ['TAB-2'],
          inactiveTabs: expect.arrayContaining(['TAB-B', 'TAB-__a']),
        }),
      );
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, (() => ({
        ...(store.getState() as object),
        dashboardState: result as DashboardState,
      })) as any);
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-B']),
          inactiveTabs: ['TAB-__a'],
        }),
      );
      request = setActiveTab('TAB-A', 'TAB-B');
      thunkAction = request(store.dispatch, (() => ({
        ...(store.getState() as object),
        dashboardState: result as DashboardState,
      })) as any);
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
          inactiveTabs: [],
        }),
      );
      request = setActiveTab('TAB-2', 'TAB-1');
      thunkAction = request(store.dispatch, (() => ({
        ...(store.getState() as object),
        dashboardState: result as DashboardState,
      })) as any);
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-2']),
          inactiveTabs: ['TAB-A', 'TAB-__a'],
        }),
      );
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, (() => ({
        ...(store.getState() as object),
        dashboardState: result as DashboardState,
      })) as any);
      result = typedDashboardStateReducer(result, thunkAction);
      expect(result).toEqual(
        expect.objectContaining({
          activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
          inactiveTabs: [],
        }),
      );
    });
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

  test('should return initial state', () => {
    expect(
      typedDashboardStateReducer(undefined, {} as { type: string }),
    ).toEqual({});
  });

  test('should add a slice', () => {
    expect(
      typedDashboardStateReducer({ sliceIds: [1] } as Partial<DashboardState>, {
        type: ADD_SLICE,
        slice: { slice_id: 2 },
      }),
    ).toEqual({ sliceIds: [1, 2] });
  });

  test('should remove a slice', () => {
    expect(
      typedDashboardStateReducer(
        { sliceIds: [1, 2], filters: {} } as Partial<DashboardState>,
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).toEqual({ sliceIds: [1], filters: {} });
  });

  test('should toggle fav star', () => {
    expect(
      typedDashboardStateReducer(
        { isStarred: false } as Partial<DashboardState>,
        { type: TOGGLE_FAVE_STAR, isStarred: true },
      ),
    ).toEqual({ isStarred: true });
  });

  test('should toggle edit mode', () => {
    expect(
      typedDashboardStateReducer(
        { editMode: false } as Partial<DashboardState>,
        { type: SET_EDIT_MODE, editMode: true },
      ),
    ).toEqual({
      editMode: true,
    });
  });

  test('should toggle expanded slices', () => {
    expect(
      typedDashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } } as Partial<DashboardState>,
        { type: TOGGLE_EXPAND_SLICE, sliceId: 1 },
      ),
    ).toEqual({ expandedSlices: { 2: false } });

    expect(
      typedDashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } } as Partial<DashboardState>,
        { type: TOGGLE_EXPAND_SLICE, sliceId: 2 },
      ),
    ).toEqual({ expandedSlices: { 1: true, 2: true } });
  });

  test('should set hasUnsavedChanges', () => {
    expect(
      typedDashboardStateReducer({} as Partial<DashboardState>, {
        type: ON_CHANGE,
      }),
    ).toEqual({
      hasUnsavedChanges: true,
    });

    expect(
      typedDashboardStateReducer({} as Partial<DashboardState>, {
        type: SET_UNSAVED_CHANGES,
        payload: { hasUnsavedChanges: false },
      }),
    ).toEqual({
      hasUnsavedChanges: false,
    });
  });

  test('should set maxUndoHistoryExceeded', () => {
    expect(
      typedDashboardStateReducer({} as Partial<DashboardState>, {
        type: SET_MAX_UNDO_HISTORY_EXCEEDED,
        payload: { maxUndoHistoryExceeded: true },
      }),
    ).toEqual({
      maxUndoHistoryExceeded: true,
    });
  });

  test('should set unsaved changes, max undo history, and editMode to false on save', () => {
    const result = typedDashboardStateReducer(
      { hasUnsavedChanges: true } as Partial<DashboardState>,
      { type: ON_SAVE },
    );
    expect(result.hasUnsavedChanges).toBe(false);
    expect(result.maxUndoHistoryExceeded).toBe(false);
    expect(result.editMode).toBe(false);
    expect(result.updatedColorScheme).toBe(false);
  });

  test('should reset lastModifiedTime on save', () => {
    const initTime = new Date().getTime() / 1000;
    typedDashboardStateReducer(
      {
        lastModifiedTime: initTime,
      } as Partial<DashboardState>,
      {} as { type: string },
    );

    const lastModifiedTime = new Date().getTime() / 1000;
    expect(
      (
        typedDashboardStateReducer(
          { hasUnsavedChanges: true } as Partial<DashboardState>,
          { type: ON_SAVE, lastModifiedTime },
        ) as Record<string, unknown>
      ).lastModifiedTime as number,
    ).toBeGreaterThanOrEqual(initTime);
  });

  test('should clear the focused filter field', () => {
    const initState = {
      focusedFilterField: {
        chartId: 1,
        column: 'column_1',
      },
    } as Partial<DashboardState>;

    const cleared = typedDashboardStateReducer(initState, {
      type: UNSET_FOCUSED_FILTER_FIELD,
      chartId: 1,
      column: 'column_1',
    });

    expect(cleared.focusedFilterField).toBeNull();
  });

  test('should only clear focused filter when the fields match', () => {
    const initState = {
      focusedFilterField: {
        chartId: 1,
        column: 'column_1',
      },
    } as Partial<DashboardState>;

    const step1 = typedDashboardStateReducer(initState, {
      type: SET_FOCUSED_FILTER_FIELD,
      chartId: 2,
      column: 'column_2',
    });
    const step2 = typedDashboardStateReducer(step1, {
      type: UNSET_FOCUSED_FILTER_FIELD,
      chartId: 1,
      column: 'column_1',
    });

    expect(step2.focusedFilterField).toEqual({
      chartId: 2,
      column: 'column_2',
    });
  });

  test('should toggle native filters bar', () => {
    expect(
      typedDashboardStateReducer(
        { nativeFiltersBarOpen: false } as Partial<DashboardState>,
        { type: TOGGLE_NATIVE_FILTERS_BAR, isOpen: true },
      ),
    ).toEqual({ nativeFiltersBarOpen: true });

    expect(
      typedDashboardStateReducer(
        { nativeFiltersBarOpen: true } as Partial<DashboardState>,
        { type: TOGGLE_NATIVE_FILTERS_BAR, isOpen: false },
      ),
    ).toEqual({ nativeFiltersBarOpen: false });
  });

  test('should update chart state', () => {
    const chartState = { columnState: [], filterModel: {} };
    const result = typedDashboardStateReducer(
      { chartStates: {} } as Partial<DashboardState>,
      {
        type: UPDATE_CHART_STATE,
        chartId: 123,
        vizType: 'ag-grid-table',
        chartState,
        lastModified: 1234567890,
      },
    );
    expect(
      (result as Record<string, Record<string, unknown>>).chartStates[123],
    ).toEqual({
      chartId: 123,
      vizType: 'ag-grid-table',
      state: chartState,
      lastModified: 1234567890,
    });
  });

  test('should remove chart state', () => {
    const initState = {
      chartStates: {
        123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
        456: { chartId: 456, vizType: 'ag-grid-table', state: {} },
      },
    } as Partial<DashboardState>;
    const result = typedDashboardStateReducer(initState, {
      type: REMOVE_CHART_STATE,
      chartId: 123,
    });
    expect(
      (result as Record<string, Record<string, unknown>>).chartStates[123],
    ).toBeUndefined();
    expect(
      (result as Record<string, Record<string, unknown>>).chartStates[456],
    ).toBeDefined();
  });

  test('should restore chart states', () => {
    const chartStates = {
      123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
    };
    const result = typedDashboardStateReducer(
      { chartStates: {} } as Partial<DashboardState>,
      { type: RESTORE_CHART_STATES, chartStates },
    );
    expect(result.chartStates).toEqual(chartStates);
  });

  test('should restore chart states to empty when given null', () => {
    const initState = {
      chartStates: {
        123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
      },
    } as Partial<DashboardState>;
    const result = typedDashboardStateReducer(initState, {
      type: RESTORE_CHART_STATES,
      chartStates: null,
    });
    expect(result.chartStates).toEqual({});
  });

  test('should clear all chart states', () => {
    const initState = {
      chartStates: {
        123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
        456: { chartId: 456, vizType: 'ag-grid-table', state: {} },
      },
      otherState: 'preserved',
    } as Partial<DashboardState>;
    const result = typedDashboardStateReducer(initState, {
      type: CLEAR_ALL_CHART_STATES,
    });
    expect(result.chartStates).toEqual({});
    expect((result as Record<string, unknown>).otherState).toEqual('preserved');
  });
});
