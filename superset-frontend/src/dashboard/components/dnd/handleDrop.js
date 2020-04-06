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
  DROP_TOP,
  DROP_RIGHT,
  DROP_BOTTOM,
  DROP_LEFT,
} from '../../util/getDropPosition';

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
    (orientation === 'row' &&
      (dropPosition === DROP_TOP || dropPosition === DROP_BOTTOM)) ||
    (orientation === 'column' &&
      (dropPosition === DROP_LEFT || dropPosition === DROP_RIGHT))
      ? 'sibling'
      : 'child';

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
  };

  // simplest case, append as child
  if (dropAsChildOrSibling === 'child') {
    dropResult.destination = {
      id: component.id,
      type: component.type,
      index: component.children.length,
    };
  } else {
    // if the item is in the same list with a smaller index, you must account for the
    // "missing" index upon movement within the list
    const sameParent =
      parentComponent && draggingItem.parentId === parentComponent.id;
    const sameParentLowerIndex =
      sameParent && draggingItem.index < componentIndex;

    let nextIndex = sameParentLowerIndex ? componentIndex - 1 : componentIndex;
    if (dropPosition === DROP_BOTTOM || dropPosition === DROP_RIGHT) {
      nextIndex += 1;
    }

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
