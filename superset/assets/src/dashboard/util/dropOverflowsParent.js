import { COLUMN_TYPE } from '../util/componentTypes';
import {
  GRID_COLUMN_COUNT,
  NEW_COMPONENTS_SOURCE_ID,
  GRID_MIN_COLUMN_COUNT,
} from './constants';
import findParentId from './findParentId';
import getChildWidth from './getChildWidth';
import newComponentFactory from './newComponentFactory';

export default function doesChildOverflowParent(dropResult, layout) {
  const { source, destination, dragging } = dropResult;

  // moving a component within a container should never overflow
  if (source.id === destination.id) {
    return false;
  }

  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
  const grandparentId = findParentId({
    childId: destination.id,
    components: layout,
  });

  const child = isNewComponent
    ? newComponentFactory(dragging.type)
    : layout[dragging.id] || {};
  const parent = layout[destination.id] || {};
  const grandparent = layout[grandparentId] || {};

  const childWidth = (child.meta && child.meta.width) || 0;

  const grandparentCapacity =
    grandparent.meta && typeof grandparent.meta.width === 'number'
      ? grandparent.meta.width
      : GRID_COLUMN_COUNT;

  const parentCapacity =
    parent.meta && typeof parent.meta.width === 'number'
      ? parent.meta.width
      : grandparentCapacity;

  const occupiedParentWidth =
    parent.type === COLUMN_TYPE
      ? 0
      : getChildWidth({ id: destination.id, components: layout });

  return parentCapacity < occupiedParentWidth + childWidth;
}
