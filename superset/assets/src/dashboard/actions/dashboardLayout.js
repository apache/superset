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

// Component CRUD -------------------------------------------------------------
export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';
function updateLayoutComponents(nextComponents) {
  return {
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents,
    },
  };
}

export function updateComponents(nextComponents) {
  return (dispatch, getState) => {
    dispatch(updateLayoutComponents(nextComponents));

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

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
function deleteLayoutComponent(id, parentId) {
  return {
    type: DELETE_COMPONENT,
    payload: {
      id,
      parentId,
    },
  };
}

export function deleteComponent(id, parentId) {
  return (dispatch, getState) => {
    dispatch(deleteLayoutComponent(id, parentId));

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

export const CREATE_COMPONENT = 'CREATE_COMPONENT';
function createLayoutComponent(dropResult) {
  return {
    type: CREATE_COMPONENT,
    payload: {
      dropResult,
    },
  };
}

export function createComponent(dropResult) {
  return (dispatch, getState) => {
    dispatch(createLayoutComponent(dropResult));

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

// Tabs -----------------------------------------------------------------------
export const CREATE_TOP_LEVEL_TABS = 'CREATE_TOP_LEVEL_TABS';
function createTopLevelTabsAction(dropResult) {
  return {
    type: CREATE_TOP_LEVEL_TABS,
    payload: {
      dropResult,
    },
  };
}

export function createTopLevelTabs(dropResult) {
  return (dispatch, getState) => {
    dispatch(createTopLevelTabsAction(dropResult));

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

export const DELETE_TOP_LEVEL_TABS = 'DELETE_TOP_LEVEL_TABS';
function deleteTopLevelTabsAction() {
  return {
    type: DELETE_TOP_LEVEL_TABS,
    payload: {},
  };
}

export function deleteTopLevelTabs(dropResult) {
  return (dispatch, getState) => {
    dispatch(deleteTopLevelTabsAction(dropResult));

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}

// Resize ---------------------------------------------------------------------
export const RESIZE_COMPONENT = 'RESIZE_COMPONENT';
export function resizeComponent({ id, width, height }) {
  return (dispatch, getState) => {
    const { dashboardLayout: undoableLayout, dashboardState } = getState();
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
      if (!dashboardState.hasUnsavedChanges) {
        dispatch(setUnsavedChanges(true));
      }
    }
  };
}

// Drag and drop --------------------------------------------------------------
export const MOVE_COMPONENT = 'MOVE_COMPONENT';
export function moveComponent(dropResult) {
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

    const { dashboardLayout: undoableLayout, dashboardState } = getState();

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
          components: layout,
        });
        dispatch(deleteComponent(source.id, parentId));
      }
    }

    if (!dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
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

export function redoLayoutAction() {
  return (dispatch, getState) => {
    dispatch(UndoActionCreators.redo());

    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };
}
