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
} from 'src/dashboard/actions/dashboardLayout';

import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import * as dashboardFilters from 'src/dashboard/actions/dashboardFilters';
import { ADD_TOAST } from 'src/components/MessageToasts/actions';

import {
  DASHBOARD_GRID_TYPE,
  ROW_TYPE,
  CHART_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';

import {
  DASHBOARD_HEADER_ID,
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  NEW_ROW_ID,
} from 'src/dashboard/util/constants';

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
  beforeEach(() => {
    sinon.spy(dashboardFilters, 'updateLayoutComponents');
  });
  afterEach(() => {
    dashboardFilters.updateLayoutComponents.restore();
  });

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

      // update component should not trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(0);
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const nextComponents = { 1: {} };
      const thunk = updateComponents(nextComponents);
      thunk(dispatch, getState);
      expect(dispatch.getCall(1).args[0]).toEqual(setUnsavedChanges(true));

      // update component should not trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(0);
    });
  });

  describe('deleteComponents', () => {
    it('should dispatch an deleteComponent action', () => {
      const { getState, dispatch } = setup();
      const thunk = deleteComponent('id', 'parentId');
      thunk(dispatch, getState);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: DELETE_COMPONENT,
        payload: { id: 'id', parentId: 'parentId' },
      });

      // delete components should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = deleteComponent('id', 'parentId');
      thunk(dispatch, getState);
      expect(dispatch.getCall(2).args[0]).toEqual(setUnsavedChanges(true));

      // delete components should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
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

      // update dashboard title should not trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(0);
    });
  });

  describe('createTopLevelTabs', () => {
    it('should dispatch a createTopLevelTabs action', () => {
      const { getState, dispatch } = setup();
      const dropResult = {};
      const thunk = createTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: CREATE_TOP_LEVEL_TABS,
        payload: { dropResult },
      });

      // create top level tabs should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const dropResult = {};
      const thunk = createTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.getCall(2).args[0]).toEqual(setUnsavedChanges(true));

      // create top level tabs should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });
  });

  describe('deleteTopLevelTabs', () => {
    it('should dispatch a deleteTopLevelTabs action', () => {
      const { getState, dispatch } = setup();
      const dropResult = {};
      const thunk = deleteTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: DELETE_TOP_LEVEL_TABS,
        payload: {},
      });

      // delete top level tabs should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });

    it('should dispatch a setUnsavedChanges action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const dropResult = {};
      const thunk = deleteTopLevelTabs(dropResult);
      thunk(dispatch, getState);
      expect(dispatch.getCall(2).args[0]).toEqual(setUnsavedChanges(true));

      // delete top level tabs should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
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

      // resize components should not trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(0);
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

      // create components should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
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

      // create components should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });

    it('should dispatch a toast if the drop overflows the destination', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: {
          present: {
            source: { id: 'source', type: ROW_TYPE, children: ['dragging'] },
            destination: {
              id: 'destination',
              type: ROW_TYPE,
              children: ['rowChild'],
            },
            dragging: { id: 'dragging', type: CHART_TYPE, meta: { width: 1 } },
            rowChild: { id: 'rowChild', type: CHART_TYPE, meta: { width: 12 } },
          },
        },
      });
      const dropResult = {
        source: { id: 'source', type: ROW_TYPE },
        destination: { id: 'destination', type: ROW_TYPE },
        dragging: { id: 'dragging', type: CHART_TYPE, meta: { width: 1 } },
      };

      const thunk = handleComponentDrop(dropResult);
      thunk(dispatch, getState);

      expect(dispatch.getCall(0).args[0].type).toEqual(ADD_TOAST);

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
    });

    it('should dispatch a toast if drop top-level tab into nested tab', () => {
      const { getState, dispatch } = setup({
        dashboardLayout: {
          present: {
            [DASHBOARD_ROOT_ID]: {
              children: ['TABS-ROOT_TABS'],
              id: DASHBOARD_ROOT_ID,
              type: 'ROOT',
            },
            'TABS-ROOT_TABS': {
              children: ['TAB-iMppmTOQy', 'TAB-rt1y8cQ6K9', 'TAB-X_pnCIwPN'],
              id: 'TABS-ROOT_TABS',
              meta: {},
              parents: ['ROOT_ID'],
              type: TABS_TYPE,
            },
            'TABS-ROW_TABS': {
              children: [
                'TAB-dKIDBT03bQ',
                'TAB-PtxY5bbTe',
                'TAB-Wc2P-yGMz',
                'TAB-U-xe_si7i',
              ],
              id: 'TABS-ROW_TABS',
              meta: {},
              parents: ['ROOT_ID', 'TABS-ROOT_TABS', 'TAB-X_pnCIwPN'],
              type: TABS_TYPE,
            },
          },
        },
      });
      const dropResult = {
        source: {
          id: 'TABS-ROOT_TABS',
          index: 1,
          type: TABS_TYPE,
        },
        destination: {
          id: 'TABS-ROW_TABS',
          index: 1,
          type: TABS_TYPE,
        },
        dragging: {
          id: 'TAB-rt1y8cQ6K9',
          meta: { text: 'New Tab' },
          type: 'TAB',
        },
      };

      handleComponentDrop(dropResult)(dispatch, getState);

      expect(dispatch.getCall(0).args[0].type).toEqual(ADD_TOAST);
    });
  });

  describe('undoLayoutAction', () => {
    it('should dispatch a redux-undo .undo() action', () => {
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
    it('should dispatch a redux-undo .redo() action', () => {
      const { getState, dispatch } = setup();
      const thunk = redoLayoutAction();
      thunk(dispatch, getState);

      expect(dispatch.getCall(0).args[0]).toEqual(UndoActionCreators.redo());

      // redo/undo should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });

    it('should dispatch a setUnsavedChanges(true) action if hasUnsavedChanges=false', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = redoLayoutAction();
      thunk(dispatch, getState);
      expect(dispatch.getCall(2).args[0]).toEqual(setUnsavedChanges(true));

      // redo/undo should trigger action for dashboardFilters
      expect(dashboardFilters.updateLayoutComponents.callCount).toEqual(1);
    });
  });
});
