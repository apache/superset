import sinon from 'sinon';

import { ActionCreators as UndoActionCreators } from 'redux-undo';

import {
  UPDATE_COMPONENTS,
  updateComponents,
  DELETE_COMPONENT,
  deleteComponent,
  CREATE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  createTopLevelTabs,
  DELETE_TOP_LEVEL_TABS,
  deleteTopLevelTabs,
  resizeComponent,
  MOVE_COMPONENT,
  handleComponentDrop,
  updateDashboardTitle,
  undoLayoutAction,
  redoLayoutAction,
} from '../../../../src/dashboard/actions/dashboardLayout';

import { setUnsavedChanges } from '../../../../src/dashboard/actions/dashboardState';
import { addInfoToast } from '../../../../src/messageToasts/actions';

import {
  DASHBOARD_GRID_TYPE,
  ROW_TYPE,
  CHART_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

import {
  DASHBOARD_HEADER_ID,
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  NEW_ROW_ID,
} from '../../../../src/dashboard/util/constants';

describe('dashboardLayout actions', () => {
  const mockState = {
    dashboardState: {
      hasUnsavedChanges: true, // don't dispatch setUnsavedChanges() after every action
    },
    dashboardInfo: {},
    dashboardLayout: {
      past: [],
      present: {},
      future: {},
    },
  };

  function setup(stateOverrides) {
    const state = { ...mockState, ...stateOverrides };
    const getState = sinon.spy(() => state);
    const dispatch = sinon.spy();

    return { getState, dispatch, state };
  }

  describe('updateComponents', () => {
    it('should dispatch an updateLayout action', () => {
      const { getState, dispatch } = setup();
      const nextComponents = { 1: {} };
      const thunk = updateComponents(nextComponents);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: UPDATE_COMPONENTS,
        payload: { nextComponents },
      });
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const nextComponents = { 1: {} };
      const thunk = updateComponents(nextComponents);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));
    });
  });

  describe('deleteComponents', () => {
    it('should dispatch an deleteComponent action', () => {
      const { getState, dispatch } = setup();
      const thunk = deleteComponent('id', 'parentId');
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: DELETE_COMPONENT,
        payload: { id: 'id', parentId: 'parentId' },
      });
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = deleteComponent('id', 'parentId');
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));
    });
  });

  describe('updateDashboardTitle', () => {
    it('should dispatch an updateComponent action for the header component', () => {
      const { getState, dispatch } = setup();
      const thunk1 = updateDashboardTitle('new text');
      thunk1(dispatch, getState);

      const thunk2 = dispatch.getCall(0).args[0];
      thunk2(dispatch, getState);

      expect(dispatch.getCall(1).args[0]).toEqual({
        type: UPDATE_COMPONENTS,
        payload: {
          nextComponents: {
            [DASHBOARD_HEADER_ID]: {
              meta: { text: 'new text' },
            },
          },
        },
      });

      expect(dispatch.callCount).toBe(2);
    });
  });

  describe('createTopLevelTabs', () => {
    it('should dispatch a createTopLevelTabs action', () => {
      const { getState, dispatch } = setup();
      const dropResult = {};
      const thunk = createTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: CREATE_TOP_LEVEL_TABS,
        payload: { dropResult },
      });
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const dropResult = {};
      const thunk = createTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));
    });
  });

  describe('deleteTopLevelTabs', () => {
    it('should dispatch a deleteTopLevelTabs action', () => {
      const { getState, dispatch } = setup();
      const dropResult = {};
      const thunk = deleteTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: DELETE_TOP_LEVEL_TABS,
        payload: {},
      });
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const dropResult = {};
      const thunk = deleteTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));
    });
  });

  describe('resizeComponent', () => {
    const dashboardLayout = {
      ...mockState.dashboardLayout,
      present: {
        1: {
          id: 1,
          children: [],
          meta: {
            width: 1,
            height: 1,
          },
        },
      },
    };

    it('should update the size of the component', () => {
      const { getState, dispatch } = setup({
        dashboardLayout,
      });

      const thunk1 = resizeComponent({ id: 1, width: 10, height: 3 });
      thunk1(dispatch, getState);

      const thunk2 = dispatch.getCall(0).args[0];
      thunk2(dispatch, getState);

      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual({
        type: UPDATE_COMPONENTS,
        payload: {
          nextComponents: {
            1: {
              id: 1,
              children: [],
              meta: {
                width: 10,
                height: 3,
              },
            },
          },
        },
      });

      expect(dispatch.callCount).toBe(2);
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
        dashboardLayout,
      });
      const thunk1 = resizeComponent({ id: 1, width: 10, height: 3 });
      thunk1(dispatch, getState);

      const thunk2 = dispatch.getCall(0).args[0];
      thunk2(dispatch, getState);

      expect(dispatch.callCount).toBe(3);
    });
  });

  describe('handleComponentDrop', () => {
    it('should create a component if it is new', () => {
      const { getState, dispatch } = setup();
      const dropResult = {
        source: { id: NEW_COMPONENTS_SOURCE_ID },
        destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
        dragging: { id: NEW_ROW_ID, type: ROW_TYPE },
      };

      const handleComponentDropThunk = handleComponentDrop(dropResult);
      handleComponentDropThunk(dispatch, getState);

      const createComponentThunk = dispatch.getCall(0).args[0];
      createComponentThunk(dispatch, getState);

      expect(dispatch.getCall(1).args[0]).toEqual({
        type: CREATE_COMPONENT,
        payload: {
          dropResult,
        },
      });

      expect(dispatch.callCount).toBe(2);
    });

    it('should move a component if the component is not new', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: {
          // if 'dragging' is not only child will dispatch deleteComponent thunk
          present: { id: { type: ROW_TYPE, children: ['_'] } },
        },
      });
      const dropResult = {
        source: { id: 'id', index: 0, type: ROW_TYPE },
        destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
        dragging: { id: 'dragging', type: ROW_TYPE },
      };

      const handleComponentDropThunk = handleComponentDrop(dropResult);
      handleComponentDropThunk(dispatch, getState);

      const moveComponentThunk = dispatch.getCall(0).args[0];
      moveComponentThunk(dispatch, getState);

      expect(dispatch.getCall(1).args[0]).toEqual({
        type: MOVE_COMPONENT,
        payload: {
          dropResult,
        },
      });

      expect(dispatch.callCount).toBe(2);
    });

    it('should dispatch a toast if the drop overflows the destination', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: {
          present: {
            source: { type: ROW_TYPE },
            destination: { type: ROW_TYPE, children: ['rowChild'] },
            dragging: { type: CHART_TYPE, meta: { width: 1 } },
            rowChild: { type: CHART_TYPE, meta: { width: 12 } },
          },
        },
      });
      const dropResult = {
        source: { id: 'source', type: ROW_TYPE },
        destination: { id: 'destination', type: ROW_TYPE },
        dragging: { id: 'dragging', type: CHART_TYPE },
      };

      const thunk = handleComponentDrop(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.getCall(0).args[0].type).toEqual(addInfoToast('').type);

      expect(dispatch.callCount).toBe(1);
    });

    it('should delete a parent Row or Tabs if the moved child was the only child', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: {
          present: {
            parentId: { id: 'parentId', children: ['tabsId'] },
            tabsId: { id: 'tabsId', type: TABS_TYPE, children: [] },
            [DASHBOARD_GRID_ID]: {
              id: DASHBOARD_GRID_ID,
              type: DASHBOARD_GRID_TYPE,
            },
            tabId: { id: 'tabId', type: TAB_TYPE },
          },
        },
      });

      const dropResult = {
        source: { id: 'tabsId', type: TABS_TYPE },
        destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
        dragging: { id: 'tabId', type: TAB_TYPE },
      };

      const moveThunk = handleComponentDrop(dropResult);
      moveThunk(dispatch, getState);

      // first call is move action which is not a thunk
      const deleteThunk = dispatch.getCall(1).args[0];
      deleteThunk(dispatch, getState);

      expect(dispatch.getCall(2).args[0]).toEqual({
        type: DELETE_COMPONENT,
        payload: {
          id: 'tabsId',
          parentId: 'parentId',
        },
      });

      // move thunk, delete thunk, delete result actions
      expect(dispatch.callCount).toBe(3);
    });

    it('should create top-level tabs if dropped on root', () => {
      const { getState, dispatch } = setup();
      const dropResult = {
        source: { id: NEW_COMPONENTS_SOURCE_ID },
        destination: { id: DASHBOARD_ROOT_ID },
        dragging: { id: NEW_ROW_ID, type: ROW_TYPE },
      };

      const thunk1 = handleComponentDrop(dropResult);
      thunk1(dispatch, getState);

      const thunk2 = dispatch.getCall(0).args[0];
      thunk2(dispatch, getState);

      expect(dispatch.getCall(1).args[0]).toEqual({
        type: CREATE_TOP_LEVEL_TABS,
        payload: {
          dropResult,
        },
      });

      expect(dispatch.callCount).toBe(2);
    });
  });

  describe('undoLayoutAction', () => {
    it('should dispatch a redux-undo .undo() action ', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: { past: ['non-empty'] },
      });
      const thunk = undoLayoutAction();
      thunk(dispatch, getState);

      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual(UndoActionCreators.undo());
    });

    it('should dispatch a setUnsavedChanges(false) action history length is zero', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: { past: [] },
      });
      const thunk = undoLayoutAction();
      thunk(dispatch, getState);

      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(false));
    });
  });

  describe('redoLayoutAction', () => {
    it('should dispatch a redux-undo .redo() action ', () => {
      const { getState, dispatch } = setup();
      const thunk = redoLayoutAction();
      thunk(dispatch, getState);

      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0]).toEqual(UndoActionCreators.redo());
    });

    it('should dispatch a setUnsavedChanges(true) action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = redoLayoutAction();
      thunk(dispatch, getState);

      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));
    });
  });
});
