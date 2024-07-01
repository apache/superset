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
import getDropPosition, {
  clearDropCache,
  DROP_FORBIDDEN,
} from '../../util/getDropPosition';

export default function handleDrop(props, monitor, Component) {
  // this may happen due to throttling
  if (!Component.mounted) return undefined;

  Component.setState(() => ({ dropIndicator: null }));
  const dropPosition = getDropPosition(monitor, Component);

  if (!dropPosition || dropPosition === DROP_FORBIDDEN) {
    return undefined;
  }

  const {
    parentComponent,
    component,
    index: componentIndex,
    onDrop,
    dropToChild,
  } = Component.props;

  const draggingItem = monitor.getItem();

  const dropResult = {
    source: {
      id: draggingItem.parentId,
      type: draggingItem.parentType,
      index: draggingItem.index,
    },
    dragging: {
      id: draggingItem.id,
      type: draggingItem.type,
      meta: draggingItem.meta,
    },
    position: dropPosition,
  };

  const shouldAppendToChildren =
    typeof dropToChild === 'function' ? dropToChild(draggingItem) : dropToChild;

  // simplest case, append as child
  if (shouldAppendToChildren) {
    dropResult.destination = {
      id: component.id,
      type: component.type,
      index: component.children.length,
    };
  } else if (!parentComponent) {
    dropResult.destination = {
      id: component.id,
      type: component.type,
      index: componentIndex,
    };
  } else {
    // if the item is in the same list with a smaller index, you must account for the
    // "missing" index upon movement within the list
    const sameParent =
      parentComponent && draggingItem.parentId === parentComponent.id;
    const sameParentLowerIndex =
      sameParent &&
      draggingItem.index < componentIndex &&
      draggingItem.type !== component.type;

    const nextIndex = sameParentLowerIndex
      ? componentIndex - 1
      : componentIndex;

    dropResult.destination = {
      id: parentComponent.id,
      type: parentComponent.type,
      index: nextIndex,
    };
  }

  onDrop(dropResult);
  clearDropCache();

  return dropResult;
}
