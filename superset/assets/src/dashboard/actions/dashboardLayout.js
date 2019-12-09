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
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { t } from '@superset-ui/translation';

import { addWarningToast } from '../../messageToasts/actions';
import { updateLayoutComponents } from './dashboardFilters';
import { setUnsavedChanges } from './dashboardState';
import { TABS_TYPE, ROW_TYPE } from '../util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  DASHBOARD_HEADER_ID,
} from '../util/constants';
import dropOverflowsParent from '../util/dropOverflowsParent';
import findParentId from '../util/findParentId';
import isInDifferentFilterScopes from '../util/isInDifferentFilterScopes';

// Component CRUD -------------------------------------------------------------
export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';

// this is a helper that takes an action as input and dispatches
// an additional setUnsavedChanges(true) action after the dispatch in the case
// that dashboardState.hasUnsavedChanges is false.
function setUnsavedChangesAfterAction(action) {
  return (...args) => (dispatch, getState) => {
    const result = action(...args);
    if (typeof result === 'function') {
      dispatch(result(dispatch, getState));
    } else {
      dispatch(result);
    }

    const isComponentLevelEvent =
      result.type === UPDATE_COMPONENTS &&
      result.payload &&
      result.payload.nextComponents;
    // trigger dashboardFilters state update if dashboard layout is changed.
    if (!isComponentLevelEvent) {
      const components = getState().dashboardLayout.present;
      dispatch(updateLayoutComponents(components));
    }

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

export const updateComponents = setUnsavedChangesAfterAction(
  nextComponents => ({
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents,
    },
  }),
);

export function updateDashboardTitle(text) {
  return (dispatch, getState) => {
    const { dashboardLayout } = getState();
    dispatch(
      updateComponents({
        [DASHBOARD_HEADER_ID]: {
          ...dashboardLayout.present[DASHBOARD_HEADER_ID],
          meta: {
            text,
          },
        },
      }),
    );
  };
}

export const DELETE_COMPONENT = 'DELETE_COMPONENT';
export const deleteComponent = setUnsavedChangesAfterAction((id, parentId) => ({
  type: DELETE_COMPONENT,
  payload: {
    id,
    parentId,
  },
}));

export const CREATE_COMPONENT = 'CREATE_COMPONENT';
export const createComponent = setUnsavedChangesAfterAction(dropResult => ({
  type: CREATE_COMPONENT,
  payload: {
    dropResult,
  },
}));

// Tabs -----------------------------------------------------------------------
export const CREATE_TOP_LEVEL_TABS = 'CREATE_TOP_LEVEL_TABS';
export const createTopLevelTabs = setUnsavedChangesAfterAction(dropResult => ({
  type: CREATE_TOP_LEVEL_TABS,
  payload: {
    dropResult,
  },
}));

export const DELETE_TOP_LEVEL_TABS = 'DELETE_TOP_LEVEL_TABS';
export const deleteTopLevelTabs = setUnsavedChangesAfterAction(() => ({
  type: DELETE_TOP_LEVEL_TABS,
  payload: {},
}));

// Resize ---------------------------------------------------------------------
export const RESIZE_COMPONENT = 'RESIZE_COMPONENT';
export function resizeComponent({ id, width, height }) {
  return (dispatch, getState) => {
    const { dashboardLayout: undoableLayout } = getState();
    const { present: dashboard } = undoableLayout;
    const component = dashboard[id];
    const widthChanged = width && component.meta.width !== width;
    const heightChanged = height && component.meta.height !== height;
    if (component && (widthChanged || heightChanged)) {
      // update the size of this component
      const updatedComponents = {
        [id]: {
          ...component,
          meta: {
            ...component.meta,
            width: width || component.meta.width,
            height: height || component.meta.height,
          },
        },
      };

      dispatch(updateComponents(updatedComponents));
    }
  };
}

// Drag and drop --------------------------------------------------------------
export const MOVE_COMPONENT = 'MOVE_COMPONENT';
const moveComponent = setUnsavedChangesAfterAction(dropResult => ({
  type: MOVE_COMPONENT,
  payload: {
    dropResult,
  },
}));

export const HANDLE_COMPONENT_DROP = 'HANDLE_COMPONENT_DROP';
export function handleComponentDrop(dropResult) {
  return (dispatch, getState) => {
    const overflowsParent = dropOverflowsParent(
      dropResult,
      getState().dashboardLayout.present,
    );

    if (overflowsParent) {
      return dispatch(
        addWarningToast(
          t(
            `There is not enough space for this component. Try decreasing its width, or increasing the destination width.`,
          ),
        ),
      );
    }

    const { source, destination } = dropResult;
    const droppedOnRoot = destination && destination.id === DASHBOARD_ROOT_ID;
    const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
    const dashboardRoot = getState().dashboardLayout.present[DASHBOARD_ROOT_ID];
    const rootChildId =
      dashboardRoot && dashboardRoot.children ? dashboardRoot.children[0] : '';

    if (droppedOnRoot) {
      dispatch(createTopLevelTabs(dropResult));
    } else if (destination && isNewComponent) {
      dispatch(createComponent(dropResult));
    } else if (
      // Add additional allow-to-drop logic for tag/tags source.
      // We only allow
      // - top-level tab => top-level tab: rearrange top-level tab order
      // - nested tab => top-level tab: allow row tab become top-level tab
      // Dashboard does not allow top-level tab become nested tab, to avoid
      // nested tab inside nested tab.
      source.type === TABS_TYPE &&
      destination.type === TABS_TYPE &&
      source.id === rootChildId &&
      destination.id !== rootChildId
    ) {
      return dispatch(
        addWarningToast(t(`Can not move top level tab into nested tabs`)),
      );
    } else if (
      destination &&
      source &&
      !(
        // ensure it has moved
        (destination.id === source.id && destination.index === source.index)
      )
    ) {
      dispatch(moveComponent(dropResult));
    }

    // call getState() again down here in case redux state is stale after
    // previous dispatch(es)
    const { dashboardFilters, dashboardLayout: undoableLayout } = getState();

    // if we moved a child from a Tab or Row parent and it was the only child, delete the parent.
    if (!isNewComponent) {
      const { present: layout } = undoableLayout;
      const sourceComponent = layout[source.id] || {};
      const destinationComponent = layout[destination.id] || {};
      if (
        (sourceComponent.type === TABS_TYPE ||
          sourceComponent.type === ROW_TYPE) &&
        sourceComponent.children &&
        sourceComponent.children.length === 0
      ) {
        const parentId = findParentId({
          childId: source.id,
          layout,
        });
        dispatch(deleteComponent(source.id, parentId));
      }

      // show warning if item has been moved between different scope
      if (
        isInDifferentFilterScopes({
          dashboardFilters,
          source: (sourceComponent.parents || []).concat(source.id),
          destination: (destinationComponent.parents || []).concat(
            destination.id,
          ),
        })
      ) {
        dispatch(
          addWarningToast(
            t('This chart has been moved to a different filter scope.'),
          ),
        );
      }
    }

    return null;
  };
}

// Undo redo ------------------------------------------------------------------
export function undoLayoutAction() {
  return (dispatch, getState) => {
    dispatch(UndoActionCreators.undo());

    const { dashboardLayout, dashboardState } = getState();

    if (
      dashboardLayout.past.length === 0 &&
      !dashboardState.maxUndoHistoryExceeded &&
      !dashboardState.updatedColorScheme
    ) {
      dispatch(setUnsavedChanges(false));
    }
  };
}

export const redoLayoutAction = setUnsavedChangesAfterAction(
  UndoActionCreators.redo,
);

// Update component parents list ----------------------------------------------
export const UPDATE_COMPONENTS_PARENTS_LIST = 'UPDATE_COMPONENTS_PARENTS_LIST';
