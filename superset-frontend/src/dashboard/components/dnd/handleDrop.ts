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
import { DropTargetMonitor } from 'react-dnd';
import getDropPosition, {
  clearDropCache,
  DROP_FORBIDDEN,
} from '../../util/getDropPosition';

interface DragItem {
  id: string;
  type: string;
  meta?: Record<string, any>;
  parentId: string;
  parentType: string;
  index: number;
}

interface ComponentType {
  id: string;
  type: string;
  children: string[];
}

interface DragDroppableProps {
  parentComponent?: ComponentType;
  component: ComponentType;
  index: number;
  onDrop: (dropResult: DropResult) => void;
  dropToChild?: boolean | ((item: DragItem) => boolean);
}

interface DragDroppableComponent {
  mounted: boolean;
  setState: (updater: () => { dropIndicator: string | null }) => void;
  props: DragDroppableProps;
}

interface DropDestination {
  id: string;
  type: string;
  index: number;
}

interface DropSource {
  id: string;
  type: string;
  index: number;
}

interface DropResult {
  source: DropSource;
  dragging: {
    id: string;
    type: string;
    meta?: Record<string, any>;
  };
  destination: DropDestination;
  position: string;
}

export default function handleDrop(
  props: DragDroppableProps,
  monitor: DropTargetMonitor,
  Component: DragDroppableComponent,
): DropResult | undefined {
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

  const draggingItem = monitor.getItem() as DragItem;

  const dropResult: DropResult = {
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
    destination: {
      id: '',
      type: '',
      index: 0,
    },
  };

  const shouldAppendToChildren =
    typeof dropToChild === 'function' ? dropToChild(draggingItem) : dropToChild;

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
