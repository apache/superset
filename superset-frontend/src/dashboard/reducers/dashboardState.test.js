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
} from 'src/dashboard/actions/dashboardState';

import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('dashboardState reducer', () => {
  test('should return initial state', () => {
    expect(dashboardStateReducer(undefined, {})).toEqual({});
  });

  test('should add a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1] },
        { type: ADD_SLICE, slice: { slice_id: 2 } },
      ),
    ).toEqual({ sliceIds: [1, 2] });
  });

  test('should remove a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1, 2], filters: {} },
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).toEqual({ sliceIds: [1], filters: {} });
  });

  test('should toggle fav star', () => {
    expect(
      dashboardStateReducer(
        { isStarred: false },
        { type: TOGGLE_FAVE_STAR, isStarred: true },
      ),
    ).toEqual({ isStarred: true });
  });

  test('should toggle edit mode', () => {
    expect(
      dashboardStateReducer(
        { editMode: false },
        { type: SET_EDIT_MODE, editMode: true },
      ),
    ).toEqual({
      editMode: true,
    });
  });

  test('should toggle expanded slices', () => {
    expect(
      dashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } },
        { type: TOGGLE_EXPAND_SLICE, sliceId: 1 },
      ),
    ).toEqual({ expandedSlices: { 2: false } });

    expect(
      dashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } },
        { type: TOGGLE_EXPAND_SLICE, sliceId: 2 },
      ),
    ).toEqual({ expandedSlices: { 1: true, 2: true } });
  });

  test('should set hasUnsavedChanges', () => {
    expect(dashboardStateReducer({}, { type: ON_CHANGE })).toEqual({
      hasUnsavedChanges: true,
    });

    expect(
      dashboardStateReducer(
        {},
        { type: SET_UNSAVED_CHANGES, payload: { hasUnsavedChanges: false } },
      ),
    ).toEqual({
      hasUnsavedChanges: false,
    });
  });

  test('should set maxUndoHistoryExceeded', () => {
    expect(
      dashboardStateReducer(
        {},
        {
          type: SET_MAX_UNDO_HISTORY_EXCEEDED,
          payload: { maxUndoHistoryExceeded: true },
        },
      ),
    ).toEqual({
      maxUndoHistoryExceeded: true,
    });
  });

  test('should set unsaved changes, max undo history, and editMode to false on save', () => {
    const result = dashboardStateReducer(
      { hasUnsavedChanges: true },
      { type: ON_SAVE },
    );
    expect(result.hasUnsavedChanges).toBe(false);
    expect(result.maxUndoHistoryExceeded).toBe(false);
    expect(result.editMode).toBe(false);
    expect(result.updatedColorScheme).toBe(false);
  });

  test('should reset lastModifiedTime on save', () => {
    const initTime = new Date().getTime() / 1000;
    dashboardStateReducer(
      {
        lastModifiedTime: initTime,
      },
      {},
    );

    const lastModifiedTime = new Date().getTime() / 1000;
    expect(
      dashboardStateReducer(
        { hasUnsavedChanges: true },
        { type: ON_SAVE, lastModifiedTime },
      ).lastModifiedTime,
    ).toBeGreaterThanOrEqual(initTime);
  });

  test('should clear the focused filter field', () => {
    const initState = {
      focusedFilterField: {
        chartId: 1,
        column: 'column_1',
      },
    };

    const cleared = dashboardStateReducer(initState, {
      type: UNSET_FOCUSED_FILTER_FIELD,
      chartId: 1,
      column: 'column_1',
    });

    expect(cleared.focusedFilterField).toBeNull();
  });

  test('should only clear focused filter when the fields match', () => {
    // dashboard only has 1 focused filter field at a time,
    // but when user switch different filter boxes,
    // browser didn't always fire onBlur and onFocus events in order.

    // init state: has 1 focus field
    const initState = {
      focusedFilterField: {
        chartId: 1,
        column: 'column_1',
      },
    };
    // when user switching filter,
    // browser focus on new filter first,
    // then blur current filter
    const step1 = dashboardStateReducer(initState, {
      type: SET_FOCUSED_FILTER_FIELD,
      chartId: 2,
      column: 'column_2',
    });
    const step2 = dashboardStateReducer(step1, {
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
      dashboardStateReducer(
        { nativeFiltersBarOpen: false },
        { type: TOGGLE_NATIVE_FILTERS_BAR, isOpen: true },
      ),
    ).toEqual({ nativeFiltersBarOpen: true });

    expect(
      dashboardStateReducer(
        { nativeFiltersBarOpen: true },
        { type: TOGGLE_NATIVE_FILTERS_BAR, isOpen: false },
      ),
    ).toEqual({ nativeFiltersBarOpen: false });
  });

  test('should update chart state', () => {
    const chartState = { columnState: [], filterModel: {} };
    const result = dashboardStateReducer(
      { chartStates: {} },
      {
        type: UPDATE_CHART_STATE,
        chartId: 123,
        vizType: 'ag-grid-table',
        chartState,
        lastModified: 1234567890,
      },
    );
    expect(result.chartStates[123]).toEqual({
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
    };
    const result = dashboardStateReducer(initState, {
      type: REMOVE_CHART_STATE,
      chartId: 123,
    });
    expect(result.chartStates[123]).toBeUndefined();
    expect(result.chartStates[456]).toBeDefined();
  });

  test('should restore chart states', () => {
    const chartStates = {
      123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
    };
    const result = dashboardStateReducer(
      { chartStates: {} },
      { type: RESTORE_CHART_STATES, chartStates },
    );
    expect(result.chartStates).toEqual(chartStates);
  });

  test('should restore chart states to empty when given null', () => {
    const initState = {
      chartStates: {
        123: { chartId: 123, vizType: 'ag-grid-table', state: {} },
      },
    };
    const result = dashboardStateReducer(initState, {
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
    };
    const result = dashboardStateReducer(initState, {
      type: CLEAR_ALL_CHART_STATES,
    });
    expect(result.chartStates).toEqual({});
    expect(result.otherState).toEqual('preserved');
  });
});
