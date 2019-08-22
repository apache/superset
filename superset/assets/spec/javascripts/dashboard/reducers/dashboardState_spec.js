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
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
} from '../../../../src/dashboard/actions/dashboardState';

import dashboardStateReducer from '../../../../src/dashboard/reducers/dashboardState';
import { BUILDER_PANE_TYPE } from '../../../../src/dashboard/util/constants';

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
      builderPaneType: BUILDER_PANE_TYPE.ADD_COMPONENTS,
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
    expect(
      dashboardStateReducer({ hasUnsavedChanges: true }, { type: ON_SAVE }),
    ).toEqual({
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
      editMode: false,
      builderPaneType: BUILDER_PANE_TYPE.NONE,
      updatedColorScheme: false,
    });
  });
});
