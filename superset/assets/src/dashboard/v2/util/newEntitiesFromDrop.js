import shouldWrapChildInRow from './shouldWrapChildInRow';
import newComponentFactory from './newComponentFactory';

import {
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from './componentTypes';

export default function newEntitiesFromDrop({ dropResult, components }) {
  const { dragging, destination } = dropResult;

  const dragType = dragging.type;
  const dropEntity = components[destination.id];
  const dropType = dropEntity.type;
  let newDropChild = newComponentFactory(dragType);
  const wrapChildInRow = shouldWrapChildInRow({ parentType: dropType, childType: dragType });

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
  }

  const nextDropChildren = [...dropEntity.children];
  nextDropChildren.splice(destination.index, 0, newDropChild.id);

  newEntities[destination.id] = {
    ...dropEntity,
    children: nextDropChildren,
  };

  return newEntities;
}
