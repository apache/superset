import { expect } from 'chai';

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
  it('should return initial state', () => {
    expect(dashboardStateReducer(undefined, {})).to.deep.equal({});
  });

  it('should add a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1] },
        { type: ADD_SLICE, slice: { slice_id: 2 } },
      ),
    ).to.deep.equal({ sliceIds: [1, 2] });
  });

  it('should remove a slice', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1, 2], filters: {} },
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).to.deep.equal({ sliceIds: [1], refresh: false, filters: {} });
  });

  it('should reset filters if a removed slice is a filter', () => {
    expect(
      dashboardStateReducer(
        { sliceIds: [1, 2], filters: { 2: {}, 1: {} } },
        { type: REMOVE_SLICE, sliceId: 2 },
      ),
    ).to.deep.equal({ sliceIds: [1], filters: { 1: {} }, refresh: true });
  });

  it('should toggle fav star', () => {
    expect(
      dashboardStateReducer(
        { isStarred: false },
        { type: TOGGLE_FAVE_STAR, isStarred: true },
      ),
    ).to.deep.equal({ isStarred: true });
  });

  it('should toggle edit mode', () => {
    expect(
      dashboardStateReducer(
        { editMode: false },
        { type: SET_EDIT_MODE, editMode: true },
      ),
    ).to.deep.equal({ editMode: true, showBuilderPane: true });
  });

  it('should toggle builder pane', () => {
    expect(
      dashboardStateReducer(
        { showBuilderPane: false },
        { type: TOGGLE_BUILDER_PANE },
      ),
    ).to.deep.equal({ showBuilderPane: true });

    expect(
      dashboardStateReducer(
        { showBuilderPane: true },
        { type: TOGGLE_BUILDER_PANE },
      ),
    ).to.deep.equal({ showBuilderPane: false });
  });

  it('should toggle expanded slices', () => {
    expect(
      dashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } },
        { type: TOGGLE_EXPAND_SLICE, sliceId: 1 },
      ),
    ).to.deep.equal({ expandedSlices: { 2: false } });

    expect(
      dashboardStateReducer(
        { expandedSlices: { 1: true, 2: false } },
        { type: TOGGLE_EXPAND_SLICE, sliceId: 2 },
      ),
    ).to.deep.equal({ expandedSlices: { 1: true, 2: true } });
  });

  it('should set hasUnsavedChanges', () => {
    expect(dashboardStateReducer({}, { type: ON_CHANGE })).to.deep.equal({
      hasUnsavedChanges: true,
    });

    expect(
      dashboardStateReducer(
        {},
        { type: SET_UNSAVED_CHANGES, payload: { hasUnsavedChanges: false } },
      ),
    ).to.deep.equal({
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
    ).to.deep.equal({
      maxUndoHistoryExceeded: true,
    });
  });

  it('should set unsaved changes, max undo history, and editMode to false on save', () => {
    expect(
      dashboardStateReducer({ hasUnsavedChanges: true }, { type: ON_SAVE }),
    ).to.deep.equal({
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
      editMode: false,
    });
  });

  describe('change filter', () => {
    it('should add a new filter if it does not exist', () => {
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
      ).to.deep.equal({
        filters: { 1: { column: ['b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    it('should overwrite a filter if merge is false', () => {
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
      ).to.deep.equal({
        filters: { 1: { column: ['b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    it('should merge a filter if merge is true', () => {
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
      ).to.deep.equal({
        filters: { 1: { column: ['z', 'b', 'a'] } },
        refresh: true,
        sliceIds: [1],
      });
    });

    it('should remove the filter if values are empty', () => {
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
      ).to.deep.equal({
        filters: {},
        refresh: true,
        sliceIds: [1],
      });
    });
  });
});
