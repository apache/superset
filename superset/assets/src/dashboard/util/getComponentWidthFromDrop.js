import { NEW_COMPONENTS_SOURCE_ID } from './constants';
import findParentId from './findParentId';
import getDetailedComponentWidth from './getDetailedComponentWidth';
import newComponentFactory from './newComponentFactory';

export default function getComponentWidthFromDrop({
  dropResult,
  layout: components,
}) {
  const { source, destination, dragging } = dropResult;

  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
  const component = isNewComponent
    ? newComponentFactory(dragging.type)
    : components[dragging.id] || {};

  // moving a component within the same container shouldn't change its width
  if (source.id === destination.id) {
    return component.meta.width;
  }

  const draggingWidth = getDetailedComponentWidth({
    component,
    components,
  });

  const destinationWidth = getDetailedComponentWidth({
    id: destination.id,
    components,
  });

  let destinationCapacity =
    destinationWidth.width - destinationWidth.occupiedWidth;

  if (isNaN(destinationCapacity)) {
    const grandparentWidth = getDetailedComponentWidth({
      id: findParentId({
        childId: destination.id,
        layout: components,
      }),
      components,
    });

    destinationCapacity =
      grandparentWidth.width - grandparentWidth.occupiedWidth;
  }

  if (isNaN(destinationCapacity) || isNaN(draggingWidth.width)) {
    return draggingWidth.width;
  } else if (destinationCapacity >= draggingWidth.width) {
    return draggingWidth.width;
  } else if (destinationCapacity >= draggingWidth.minimumWidth) {
    return destinationCapacity;
  }

  return -1;
}
