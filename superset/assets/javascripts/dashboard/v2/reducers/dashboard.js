import newComponentFactory from '../util/newComponentFactory';
import newEntitiesFromDrop from '../util/newEntitiesFromDrop';
import reorderItem from '../util/dnd-reorder';
import shouldWrapChildInRow from '../util/shouldWrapChildInRow';
import { ROW_TYPE } from '../util/componentTypes';

import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  MOVE_COMPONENT,
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
    let deleteCount = 0;
    function recursivelyDeleteChildren(componentId, componentParentId) {
      // delete child and it's children
      const component = nextComponents[componentId];
      delete nextComponents[componentId];
      deleteCount += 1;
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
    console.log('deleted', deleteCount, 'total components', nextComponents);

    return nextComponents;
  },

  [CREATE_COMPONENT](state, action) {
    const { payload: { dropResult } } = action;
    const newEntities = newEntitiesFromDrop({ dropResult, components: state });
    return {
      ...state,
      ...newEntities,
    };
  },

  [MOVE_COMPONENT](state, action) {
    const { payload: { dropResult } } = action;
    const { source, destination, draggableId } = dropResult;

    if (!source || !destination || !draggableId) return state;

    const nextEntities = reorderItem({
      entitiesMap: state,
      source,
      destination,
    });

    // wrap the dragged component in a row depening on destination type
    const destinationType = (state[destination.droppableId] || {}).type;
    const draggableType = (state[draggableId] || {}).type;
    const wrapInRow = shouldWrapChildInRow({
      parentType: destinationType,
      childType: draggableType,
    });

    if (wrapInRow) {
      const destinationEntity = nextEntities[destination.droppableId];
      const destinationChildren = destinationEntity.children;
      const newRow = newComponentFactory(ROW_TYPE);
      newRow.children = [destinationChildren[destination.index]];
      destinationChildren[destination.index] = newRow.id;
      nextEntities[newRow.id] = newRow;
    }

    return {
      ...state,
      ...nextEntities,
    };
  },
};

export default function dashboardReducer(state = {}, action) {
  if (action.type in actionHandlers) {
    const handler = actionHandlers[action.type];
    return handler(state, action);
  }

  return state;
}
