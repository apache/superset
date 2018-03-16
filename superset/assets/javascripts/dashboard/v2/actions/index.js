import { DASHBOARD_ROOT_ID } from '../util/constants';
import findParentId from '../util/findParentId';
import { TABS_TYPE } from '../util/componentTypes';

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
    const { source, destination } = dropResult;
    const droppedOnRoot = destination && destination.droppableId === DASHBOARD_ROOT_ID;
    const isNewComponent = !source; // @TODO create NEW_COMPONENTS source for better readability

    if (droppedOnRoot) {
      dispatch(createTopLevelTabs(dropResult));
    } else if (destination && isNewComponent) {
      dispatch(createComponent(dropResult));
    } else if (
      destination
      && source
      && !( // ensure it has moved
        destination.droppableId === source.droppableId
        && destination.index === source.index
      )
    ) {
      dispatch(moveComponent(dropResult));
    }

    if (source) {
      const { dashboard } = getState();
      const sourceComponent = dashboard[source.droppableId];

      if (sourceComponent.type === TABS_TYPE && sourceComponent.children.length === 0) {
        const parentId = findParentId({ childId: source.droppableId, components: dashboard });
        dispatch(deleteComponent(source.droppableId, parentId));
      }
    }

    return null;
  };
}
