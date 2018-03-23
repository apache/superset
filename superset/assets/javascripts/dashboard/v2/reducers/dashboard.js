import { DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, NEW_COMPONENTS_SOURCE_ID } from '../util/constants';
import newComponentFactory from '../util/newComponentFactory';
import newEntitiesFromDrop from '../util/newEntitiesFromDrop';
import reorderItem from '../util/dnd-reorder';
import shouldWrapChildInRow from '../util/shouldWrapChildInRow';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,

} from '../util/componentTypes';

import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  MOVE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
} from '../actions';

const actionHandlers = {
  [UPDATE_COMPONENTS](state, action) {
    const { payload: { nextComponents } } = action;
    return {
      ...state,
      ...nextComponents,
    };
  },

  [DELETE_COMPONENT](state, action) {
    const { payload: { id, parentId } } = action;

    if (!parentId || !id || !state[id] || !state[parentId]) return state;

    const nextComponents = { ...state };

    // recursively find children to remove
    function recursivelyDeleteChildren(componentId, componentParentId) {
      // delete child and it's children
      const component = nextComponents[componentId];
      delete nextComponents[componentId];

      const { children = [] } = component;
      children.forEach((childId) => { recursivelyDeleteChildren(childId, componentId); });

      const parent = nextComponents[componentParentId];
      if (parent) { // may have been deleted in another recursion
        const componentIndex = (parent.children || []).indexOf(componentId);
        if (componentIndex > -1) {
          const nextChildren = [...parent.children];
          nextChildren.splice(componentIndex, 1);
          nextComponents[componentParentId] = {
            ...parent,
            children: nextChildren,
          };
        }
      }
    }

    recursivelyDeleteChildren(id, parentId);

    return nextComponents;
  },

  [CREATE_COMPONENT](state, action) {
    const { payload: { dropResult } } = action;
    const { destination, dragging } = dropResult;
    const newEntities = newEntitiesFromDrop({ dropResult, components: state });

    // inherit the width of a column parent
    if (destination.type === COLUMN_TYPE && [CHART_TYPE, MARKDOWN_TYPE].includes(dragging.type)) {
      const newEntitiesArray = Object.values(newEntities);
      const component = newEntitiesArray.find(entity => entity.type === dragging.type);
      const parentColumn = newEntities[destination.id];

      newEntities[component.id] = {
        ...component,
        meta: {
          ...component.meta,
          width: parentColumn.meta.width,
        },
      };
    }

    return {
      ...state,
      ...newEntities,
    };
  },

  [MOVE_COMPONENT](state, action) {
    const { payload: { dropResult } } = action;
    const { source, destination, dragging } = dropResult;

    if (!source || !destination || !dragging) return state;

    const nextEntities = reorderItem({
      entitiesMap: state,
      source,
      destination,
    });

    // wrap the dragged component in a row depending on destination type
    const wrapInRow = shouldWrapChildInRow({
      parentType: destination.type,
      childType: dragging.type,
    });

    if (wrapInRow) {
      const destinationEntity = nextEntities[destination.id];
      const destinationChildren = destinationEntity.children;
      const newRow = newComponentFactory(ROW_TYPE);
      newRow.children = [destinationChildren[destination.index]];
      destinationChildren[destination.index] = newRow.id;
      nextEntities[newRow.id] = newRow;
    }

    // inherit the width of a column parent
    if (destination.type === COLUMN_TYPE && [CHART_TYPE, MARKDOWN_TYPE].includes(dragging.type)) {
      const component = nextEntities[dragging.id];
      const parentColumn = nextEntities[destination.id];
      nextEntities[dragging.id] = {
        ...component,
        meta: {
          ...component.meta,
          width: parentColumn.meta.width,
        },
      };
    }

    return {
      ...state,
      ...nextEntities,
    };
  },

  [CREATE_TOP_LEVEL_TABS](state, action) {
    const { payload: { dropResult } } = action;
    const { source, dragging } = dropResult;

    // move children of current root to be children of the dragging tab
    const rootComponent = state[DASHBOARD_ROOT_ID];
    const topLevelId = rootComponent.children[0];
    const topLevelComponent = state[topLevelId];

    if (source.id !== NEW_COMPONENTS_SOURCE_ID) {
      // component already exists
      const draggingTabs = state[dragging.id];
      const draggingTabId = draggingTabs.children[0];
      const draggingTab = state[draggingTabId];

      // move all children except the one that is dragging
      const childrenToMove = [...topLevelComponent.children].filter(id => id !== dragging.id);

      return {
        ...state,
        [DASHBOARD_ROOT_ID]: {
          ...rootComponent,
          children: [dragging.id],
        },
        [topLevelId]: {
          ...topLevelComponent,
          children: [],
        },
        [draggingTabId]: {
          ...draggingTab,
          children: [
            ...draggingTab.children,
            ...childrenToMove,
          ],
        },
      };
    }

    // create new component
    const newEntities = newEntitiesFromDrop({ dropResult, components: state });
    const newEntitiesArray = Object.values(newEntities);
    const tabComponent = newEntitiesArray.find(component => component.type === TAB_TYPE);
    const tabsComponent = newEntitiesArray.find(component => component.type === TABS_TYPE);

    tabComponent.children = [...topLevelComponent.children];
    newEntities[topLevelId] = { ...topLevelComponent, children: [] };
    newEntities[DASHBOARD_ROOT_ID] = { ...rootComponent, children: [tabsComponent.id] };

    return {
      ...state,
      ...newEntities,
    };
  },

  [DELETE_TOP_LEVEL_TABS](state) {
    const rootComponent = state[DASHBOARD_ROOT_ID];
    const topLevelId = rootComponent.children[0];
    const topLevelTabs = state[topLevelId];

    if (topLevelTabs.type !== TABS_TYPE) return state;

    let childrenToMove = [];
    const nextEntities = { ...state };

    topLevelTabs.children.forEach((tabId) => {
      const tabComponent = state[tabId];
      childrenToMove = [...childrenToMove, ...tabComponent.children];
      delete nextEntities[tabId];
    });

    delete nextEntities[topLevelId];

    nextEntities[DASHBOARD_ROOT_ID] = {
      ...rootComponent,
      children: [DASHBOARD_GRID_ID],
    };

    nextEntities[DASHBOARD_GRID_ID] = {
      ...(state[DASHBOARD_GRID_ID]),
      children: childrenToMove,
    };

    return nextEntities;
  },
};

export default function dashboardReducer(state = {}, action) {
  if (action.type in actionHandlers) {
    const handler = actionHandlers[action.type];
    return handler(state, action);
  }

  return state;
}
