import {
  ADD_SLICE,
  CHANGE_FILTER,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_EDIT_MODE,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  TOGGLE_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
} from '../../../../src/dashboard/actions/dashboardState';

import dashboardStateReducer from '../../../../src/dashboard/reducers/dashboardState';

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
    ).toEqual({ sliceIds: [1], refresh: false, filters: {} });
  });

  test('should reset filters if a removed slice is a filter', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1, 2], filters: { 2: {}, 1: {} } },
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).toEqual({ sliceIds: [1], filters: { 1: {} }, refresh: true });
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
    ).toEqual({ editMode: true, showBuilderPane: true });
  });

  test('should toggle builder pane', () => {
    expect(
      dashboardStateReducer(
        { showBuilderPane: false },
        { type: TOGGLE_BUILDER_PANE },
      ),
    ).toEqual({ showBuilderPane: true });

    expect(
      dashboardStateReducer(
        { showBuilderPane: true },
        { type: TOGGLE_BUILDER_PANE },
      ),
    ).toEqual({ showBuilderPane: false });
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
    expect(
      dashboardStateReducer({ hasUnsavedChanges: true }, { type: ON_SAVE }),
    ).toEqual({
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
      editMode: false,
    });
  });

  describe('change filter', () => {
    test('should add a new filter if it does not exist', () => {
      expect(
        dashboardStateReducer(
          {
            filters: {},
            sliceIds: [1],
          },
          {
            type: CHANGE_FILTER,
            chart: { id: 1, formData: { groupby: 'column' } },
            col: 'column',
            vals: ['b', 'a'],
            refresh: true,
            merge: true,
          },
        ),
      ).toEqual({
        filters: { 1: { column: ['b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    test('should overwrite a filter if merge is false', () => {
      expect(
        dashboardStateReducer(
          {
            filters: {
              1: { column: ['z'] },
            },
            sliceIds: [1],
          },
          {
            type: CHANGE_FILTER,
            chart: { id: 1, formData: { groupby: 'column' } },
            col: 'column',
            vals: ['b', 'a'],
            refresh: true,
            merge: false,
          },
        ),
      ).toEqual({
        filters: { 1: { column: ['b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    test('should merge a filter if merge is true', () => {
      expect(
        dashboardStateReducer(
          {
            filters: {
              1: { column: ['z'] },
            },
            sliceIds: [1],
          },
          {
            type: CHANGE_FILTER,
            chart: { id: 1, formData: { groupby: 'column' } },
            col: 'column',
            vals: ['b', 'a'],
            refresh: true,
            merge: true,
          },
        ),
      ).toEqual({
        filters: { 1: { column: ['z', 'b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    test('should remove the filter if values are empty', () => {
      expect(
        dashboardStateReducer(
          {
            filters: {
              1: { column: ['z'] },
            },
            sliceIds: [1],
          },
          {
            type: CHANGE_FILTER,
            chart: { id: 1, formData: { groupby: 'column' } },
            col: 'column',
            vals: [],
            refresh: true,
            merge: false,
          },
        ),
      ).toEqual({
        filters: {},
        refresh: true,
        sliceIds: [1],
      });
    });
  });
});
