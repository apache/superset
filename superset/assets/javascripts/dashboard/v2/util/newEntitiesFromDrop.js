import newComponentIdToType from './newComponentIdToType';
import shouldWrapChildInRow from './shouldWrapChildInRow';
import newComponentFactory from './newComponentFactory';

import {
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from './componentTypes';

import { DASHBOARD_ROOT_ID } from './constants';

export default function newEntitiesFromDrop({ dropResult, components }) {
  const { draggableId, destination } = dropResult;

  const dragType = newComponentIdToType[draggableId];
  const dropEntity = components[destination.droppableId];

  if (!dropEntity) {
    console.warn('Drop target entity', destination.droppableId, 'not found');
    return null;
  }

  if (!dragType) {
    console.warn('Drag type not found for id', draggableId);
    return null;
  }

  const dropType = dropEntity.type;
  let newDropChild = newComponentFactory(dragType);
  const wrapChildInRow = shouldWrapChildInRow({ parentType: dropType, childType: dragType });
  const droppedOnRoot = dropEntity.id === DASHBOARD_ROOT_ID;

  const newEntities = {
    [newDropChild.id]: newDropChild,
  };

  if (wrapChildInRow) {
    const rowWrapper = newComponentFactory(ROW_TYPE);
    rowWrapper.children = [newDropChild.id];
    newEntities[rowWrapper.id] = rowWrapper;
    newDropChild = rowWrapper;
  } else if (dragType === TABS_TYPE) { // create a new tab component
    const tabChild = newComponentFactory(TAB_TYPE);
    newDropChild.children = [tabChild.id];
    newEntities[tabChild.id] = tabChild;

    if (droppedOnRoot) {
      // If we've dropped tabs on the root, move previous root children to new tab
      const rootComponent = components[DASHBOARD_ROOT_ID];
      const topLevelId = rootComponent.children[0];
      const topLevelComponent = components[topLevelId];
      tabChild.children = [...topLevelComponent.children];
      newEntities[topLevelId] = { ...topLevelComponent, children: [] };
      newEntities[DASHBOARD_ROOT_ID] = { ...rootComponent, children: [newDropChild.id] };
    }
  }

  if (!droppedOnRoot) {
    const nextDropChildren = [...dropEntity.children];
    nextDropChildren.splice(destination.index, 0, newDropChild.id);

    newEntities[destination.droppableId] = {
      ...dropEntity,
      children: nextDropChildren,
    };
  }

  return newEntities;
}
