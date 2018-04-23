import { addInfoToast } from './messageToasts';
import { CHART_TYPE, MARKDOWN_TYPE, TABS_TYPE } from '../util/componentTypes';
import { DASHBOARD_ROOT_ID, NEW_COMPONENTS_SOURCE_ID } from '../util/constants';
import dropOverflowsParent from '../util/dropOverflowsParent';
import findParentId from '../util/findParentId';

// Component CRUD -------------------------------------------------------------
export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';
export function updateComponents(nextComponents) {
  return {
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents,
    },
  };
}

export const DELETE_COMPONENT = 'DELETE_COMPONENT';
export function deleteComponent(id, parentId) {
  return {
    type: DELETE_COMPONENT,
    payload: {
      id,
      parentId,
    },
  };
}

export const CREATE_COMPONENT = 'CREATE_COMPONENT';
export function createComponent(dropResult) {
  return {
    type: CREATE_COMPONENT,
    payload: {
      dropResult,
    },
  };
}

// Tabs -----------------------------------------------------------------------
export const CREATE_TOP_LEVEL_TABS = 'CREATE_TOP_LEVEL_TABS';
export function createTopLevelTabs(dropResult) {
  return {
    type: CREATE_TOP_LEVEL_TABS,
    payload: {
      dropResult,
    },
  };
}

export const DELETE_TOP_LEVEL_TABS = 'DELETE_TOP_LEVEL_TABS';
export function deleteTopLevelTabs() {
  return {
    type: DELETE_TOP_LEVEL_TABS,
    payload: {},
  };
}

// Resize ---------------------------------------------------------------------
export const RESIZE_COMPONENT = 'RESIZE_COMPONENT';
export function resizeComponent({ id, width, height }) {
  return (dispatch, getState) => {
    const { dashboardLayout: undoableLayout } = getState();
    const { present: dashboard } = undoableLayout;
    const component = dashboard[id];

    if (
      component &&
      (component.meta.width !== width || component.meta.height !== height)
    ) {
      // update the size of this component + any resizable children
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

      component.children.forEach((childId) => {
        const child = dashboard[childId];
        if ([CHART_TYPE, MARKDOWN_TYPE].includes(child.type)) {
          updatedComponents[childId] = {
            ...child,
            meta: {
              ...child.meta,
              width: width || child.meta.width,
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
    const overflowsParent = dropOverflowsParent(dropResult, getState().dashboardLayout.present);

    if (overflowsParent) {
      return dispatch(addInfoToast(
        `Parent does not have enough space for this component.
         Try decreasing its width or add it to a new row.`,
      ));
    }

    const { source, destination } = dropResult;
    const droppedOnRoot = destination && destination.id === DASHBOARD_ROOT_ID;
    const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;

    if (droppedOnRoot) {
      dispatch(createTopLevelTabs(dropResult));
    } else if (destination && isNewComponent) {
      dispatch(createComponent(dropResult));
    } else if (
      destination
      && source
      && !( // ensure it has moved
        destination.id === source.id
        && destination.index === source.index
      )
    ) {
      dispatch(moveComponent(dropResult));
    }

    // if we moved a Tab and the parent Tabs no longer has children, delete it.
    if (!isNewComponent) {
      const { dashboardLayout: undoableLayout } = getState();
      const { present: layout } = undoableLayout;
      const sourceComponent = layout[source.id];

      if (sourceComponent.type === TABS_TYPE && sourceComponent.children.length === 0) {
        const parentId = findParentId({ childId: source.id, components: layout });
        dispatch(deleteComponent(source.id, parentId));
      }
    }

    return null;
  };
}
