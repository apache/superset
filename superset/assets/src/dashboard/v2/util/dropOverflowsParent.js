import { COLUMN_TYPE } from '../util/componentTypes';
import { GRID_COLUMN_COUNT, NEW_COMPONENTS_SOURCE_ID } from './constants';
import findParentId from './findParentId';
import getChildWidth from './getChildWidth';
import newComponentFactory from './newComponentFactory';

export default function doesChildOverflowParent(dropResult, components) {
  const { source, destination, dragging } = dropResult;
  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;

  const grandparentId = findParentId({ childId: destination.id, components });

  const child = isNewComponent ? newComponentFactory(dragging.type) : components[dragging.id] || {};
  const parent = components[destination.id] || {};
  const grandparent = components[grandparentId] || {};

  const grandparentWidth = (grandparent.meta && grandparent.meta.width) || GRID_COLUMN_COUNT;
  const parentWidth = (parent.meta && parent.meta.width) || grandparentWidth;
  const parentChildWidth = parent.type === COLUMN_TYPE
    ? 0 : getChildWidth({ id: destination.id, components });
  const childWidth = (child.meta && child.meta.width) || 0;

  return parentWidth - parentChildWidth < childWidth;
}
