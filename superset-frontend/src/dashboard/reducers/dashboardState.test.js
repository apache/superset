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
  UNSET_FOCUSED_FILTER_FIELD,
} from 'src/dashboard/actions/dashboardState';

import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';

describe('dashboardState reducer', () => {
  it('should return initial state', () => {
    expect(dashboardStateReducer(undefined, {})).toEqual({});
  });

  it('should add a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1] },
        { type: ADD_SLICE, slice: { slice_id: 2 } },
      ),
    ).toEqual({ sliceIds: [1, 2] });
  });

  it('should remove a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1, 2], filters: {} },
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).toEqual({ sliceIds: [1], filters: {} });
  });

  it('should toggle fav star', () => {
    expect(
      dashboardStateReducer(
        { isStarred: false },
        { type: TOGGLE_FAVE_STAR, isStarred: true },
      ),
    ).toEqual({ isStarred: true });
  });

  it('should toggle edit mode', () => {
    expect(
      dashboardStateReducer(
        { editMode: false },
        { type: SET_EDIT_MODE, editMode: true },
      ),
    ).toEqual({
      editMode: true,
    });
  });

  it('should toggle expanded slices', () => {
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

  it('should set hasUnsavedChanges', () => {
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

  it('should set maxUndoHistoryExceeded', () => {
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

  it('should set unsaved changes, max undo history, and editMode to false on save', () => {
    const result = dashboardStateReducer(
      { hasUnsavedChanges: true },
      { type: ON_SAVE },
    );
    expect(result.hasUnsavedChanges).toBe(false);
    expect(result.maxUndoHistoryExceeded).toBe(false);
    expect(result.editMode).toBe(false);
    expect(result.updatedColorScheme).toBe(false);
  });

  it('should reset lastModifiedTime on save', () => {
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

  it('should clear the focused filter field', () => {
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

  it('should only clear focused filter when the fields match', () => {
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
});
