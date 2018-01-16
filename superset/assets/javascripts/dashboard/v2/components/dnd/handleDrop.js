import getDropPosition, { DROP_TOP, DROP_RIGHT, DROP_BOTTOM, DROP_LEFT } from '../../util/getDropPosition';

export default function handleDrop(props, monitor, Component) {
  // this may happen due to throttling
  if (!Component.mounted) return undefined;

  Component.setState(() => ({ dropIndicator: null }));
  const dropPosition = getDropPosition(monitor, Component);

  if (!dropPosition) {
    return undefined;
  }

  const {
    parentComponent,
    component,
    index: componentIndex,
    onDrop,
    orientation,
  } = Component.props;

  const draggingItem = monitor.getItem();

  const dropAsChildOrSibling =
    (orientation === 'row' && (dropPosition === DROP_TOP || dropPosition === DROP_BOTTOM)) ||
    (orientation === 'column' && (dropPosition === DROP_LEFT || dropPosition === DROP_RIGHT))
    ? 'sibling' : 'child';

  const dropResult = {
    source: draggingItem.parentId ? {
      droppableId: draggingItem.parentId,
      index: draggingItem.index,
    } : null,
    draggableId: draggingItem.draggableId,
  };

  // simplest case, append as child
  if (dropAsChildOrSibling === 'child') {
    dropResult.destination = {
      droppableId: component.id,
      index: component.children.length,
    };
  } else {
    // if the item is in the same list with a smaller index, you must account for the
    // "missing" index upon movement within the list
    const sameParent = parentComponent && draggingItem.parentId === parentComponent.id;
    const sameParentLowerIndex = sameParent && draggingItem.index < componentIndex;

    let nextIndex = sameParentLowerIndex ? componentIndex - 1 : componentIndex;
    if (dropPosition === DROP_BOTTOM || dropPosition === DROP_RIGHT) {
      nextIndex += 1;
    }

    dropResult.destination = {
      droppableId: parentComponent.id,
      index: nextIndex,
    };
  }

  onDrop(dropResult);

  return dropResult;
}
