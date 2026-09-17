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
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  NEW_COMPONENTS_SOURCE_ID,
  DASHBOARD_HEADER_ID,
} from '../util/constants';
import componentIsResizable from '../util/componentIsResizable';
import findParentId from '../util/findParentId';
import getComponentWidthFromDrop from '../util/getComponentWidthFromDrop';
import updateComponentParentsList from '../util/updateComponentParentsList';
import newComponentFactory from '../util/newComponentFactory';
import newEntitiesFromDrop from '../util/newEntitiesFromDrop';
import reorderItem from '../util/dnd-reorder';
import shouldWrapChildInRow from '../util/shouldWrapChildInRow';
import { ROW_TYPE, TAB_TYPE, TABS_TYPE } from '../util/componentTypes';

import {
  UPDATE_COMPONENTS,
  UPDATE_COMPONENTS_PARENTS_LIST,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  MOVE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
  DASHBOARD_TITLE_CHANGED,
} from '../actions/dashboardLayout';

import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export function recursivelyDeleteChildren(
  componentId,
  componentParentId,
  nextComponents,
) {
  // delete child and it's children
  const component = nextComponents?.[componentId];
  if (component) {
    // eslint-disable-next-line no-param-reassign
    delete nextComponents[componentId];

    const { children = [] } = component;
    children?.forEach?.(childId => {
      recursivelyDeleteChildren(childId, componentId, nextComponents);
    });

    const parent = nextComponents?.[componentParentId];
    if (Array.isArray(parent?.children)) {
      // may have been deleted in another recursion
      const componentIndex = parent.children.indexOf(componentId);
      if (componentIndex > -1) {
        const nextChildren = [...parent.children];
        nextChildren.splice(componentIndex, 1);
        // eslint-disable-next-line no-param-reassign
        nextComponents[componentParentId] = {
          ...parent,
          children: nextChildren,
        };
      }
    }
  }
}

const actionHandlers = {
  [HYDRATE_DASHBOARD](state, action) {
    return {
      ...action.data.dashboardLayout.present,
    };
  },

  [UPDATE_COMPONENTS](state, action) {
    const {
      payload: { nextComponents },
    } = action;
    return {
      ...state,
      ...nextComponents,
    };
  },

  [DELETE_COMPONENT](state, action) {
    const {
      payload: { id, parentId },
    } = action;

    if (!parentId || !id || !state[id] || !state[parentId]) return state;

    const nextComponents = { ...state };

    recursivelyDeleteChildren(id, parentId, nextComponents);
    const nextParent = nextComponents[parentId];
    if (nextParent?.type === ROW_TYPE && nextParent?.children?.length === 0) {
      const grandparentId = findParentId({
        childId: parentId,
        layout: nextComponents,
      });
      recursivelyDeleteChildren(parentId, grandparentId, nextComponents);
    }

    return nextComponents;
  },

  [CREATE_COMPONENT](state, action) {
    const {
      payload: { dropResult },
    } = action;

    const newEntities = newEntitiesFromDrop({ dropResult, layout: state });

    return {
      ...state,
      ...newEntities,
    };
  },

  [MOVE_COMPONENT](state, action) {
    const {
      payload: { dropResult },
    } = action;
    const { source, destination, dragging, position } = dropResult;

    if (!source || !destination || !dragging) return state;

    const nextEntities = reorderItem({
      entitiesMap: state,
      source,
      destination,
      position,
    });

    if (componentIsResizable(nextEntities[dragging.id])) {
      // update component width if it changed
      const nextWidth =
        getComponentWidthFromDrop({
          dropResult,
          layout: state,
        }) || undefined; // don't set a 0 width
      if ((nextEntities[dragging.id].meta || {}).width !== nextWidth) {
        nextEntities[dragging.id] = {
          ...nextEntities[dragging.id],
          meta: {
            ...nextEntities[dragging.id].meta,
            width: nextWidth,
          },
        };
      }
    }

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
      newRow.parents = (destinationEntity.parents || []).concat(destination.id);
      destinationChildren[destination.index] = newRow.id;
      nextEntities[newRow.id] = newRow;
    }

    return {
      ...state,
      ...nextEntities,
    };
  },

  [CREATE_TOP_LEVEL_TABS](state, action) {
    const {
      payload: { dropResult },
    } = action;
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
      const childrenToMove = [...topLevelComponent.children].filter(
        id => id !== dragging.id,
      );

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
          children: [...draggingTab.children, ...childrenToMove],
        },
      };
    }

    // create new component
    const newEntities = newEntitiesFromDrop({ dropResult, layout: state });
    const newEntitiesArray = Object.values(newEntities);
    const tabComponent = newEntitiesArray.find(
      component => component.type === TAB_TYPE,
    );
    const tabsComponent = newEntitiesArray.find(
      component => component.type === TABS_TYPE,
    );

    tabComponent.children = [...topLevelComponent.children];
    newEntities[topLevelId] = { ...topLevelComponent, children: [] };
    newEntities[DASHBOARD_ROOT_ID] = {
      ...rootComponent,
      children: [tabsComponent.id],
    };

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

    topLevelTabs.children.forEach(tabId => {
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
      ...state[DASHBOARD_GRID_ID],
      children: childrenToMove,
    };

    return nextEntities;
  },

  [UPDATE_COMPONENTS_PARENTS_LIST](state) {
    const nextState = {
      ...state,
    };

    updateComponentParentsList({
      currentComponent: nextState[DASHBOARD_ROOT_ID],
      layout: nextState,
    });

    return {
      ...nextState,
    };
  },

  [DASHBOARD_TITLE_CHANGED](state, action) {
    return {
      ...state,
      [DASHBOARD_HEADER_ID]: {
        ...state[DASHBOARD_HEADER_ID],
        meta: {
          ...state[DASHBOARD_HEADER_ID].meta,
          text: action.text,
        },
      },
    };
  },
};

export default function layoutReducer(state = {}, action) {
  if (action.type in actionHandlers) {
    const handler = actionHandlers[action.type];
    return handler(state, action);
  }

  return state;
}
