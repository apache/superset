import { ActionCreators as UndoActionCreators } from 'redux-undo';

import { addInfoToast } from './messageToasts';
import { setUnsavedChanges } from './dashboardState';
import { CHART_TYPE, MARKDOWN_TYPE, TABS_TYPE } from '../util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  GRID_MIN_COLUMN_COUNT,
  DASHBOARD_HEADER_ID,
} from '../util/constants';
import dropOverflowsParent from '../util/dropOverflowsParent';
import findParentId from '../util/findParentId';

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

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

// Component CRUD -------------------------------------------------------------
export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';

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

      // set any resizable children to have a minimum width so that
      // the chances that they are validly movable to future containers is maximized
      component.children.forEach(childId => {
        const child = dashboard[childId];
        if ([CHART_TYPE, MARKDOWN_TYPE].includes(child.type)) {
          updatedComponents[childId] = {
            ...child,
            meta: {
              ...child.meta,
              width: GRID_MIN_COLUMN_COUNT,
              height: height || child.meta.height,
            },
          };
        }
      });

      dispatch(updateComponents(updatedComponents));
    }
  };
}

// Drag and drop --------------------------------------------------------------
export const MOVE_COMPONENT = 'MOVE_COMPONENT';
function moveComponent(dropResult) {
  return {
    type: MOVE_COMPONENT,
    payload: {
      dropResult,
    },
  };
}

export const HANDLE_COMPONENT_DROP = 'HANDLE_COMPONENT_DROP';
export function handleComponentDrop(dropResult) {
  return (dispatch, getState) => {
    const overflowsParent = dropOverflowsParent(
      dropResult,
      getState().dashboardLayout.present,
    );

    if (overflowsParent) {
      return dispatch(
        addInfoToast(
          `Parent does not have enough space for this component.
         Try decreasing its width or add it to a new row.`,
        ),
      );
    }

    const { source, destination } = dropResult;
    const droppedOnRoot = destination && destination.id === DASHBOARD_ROOT_ID;
    const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;

    if (droppedOnRoot) {
      dispatch(createTopLevelTabs(dropResult));
    } else if (destination && isNewComponent) {
      dispatch(createComponent(dropResult));
    } else if (
      destination &&
      source &&
      !// ensure it has moved
      (destination.id === source.id && destination.index === source.index)
    ) {
      dispatch(moveComponent(dropResult));
    }

    const { dashboardLayout: undoableLayout } = getState();

    // if we moved a Tab and the parent Tabs no longer has children, delete it.
    if (!isNewComponent) {
      const { present: layout } = undoableLayout;
      const sourceComponent = layout[source.id];
      if (
        sourceComponent.type === TABS_TYPE &&
        sourceComponent.children.length === 0
      ) {
        const parentId = findParentId({
          childId: source.id,
          layout,
        });
        dispatch(deleteComponent(source.id, parentId));
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
      !dashboardState.maxUndoHistoryExceeded
    ) {
      dispatch(setUnsavedChanges(false));
    }
  };
}

export const redoLayoutAction = setUnsavedChangesAfterAction(
  UndoActionCreators.redo,
);
