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
import { ComponentType } from '../types';
import isValidChild from './isValidChild';
import { TAB_TYPE, TABS_TYPE } from './componentTypes';

export const DROP_TOP = 'DROP_TOP';
export const DROP_RIGHT = 'DROP_RIGHT';
export const DROP_BOTTOM = 'DROP_BOTTOM';
export const DROP_LEFT = 'DROP_LEFT';
export const DROP_FORBIDDEN = 'DROP_FORBIDDEN';

export type DropPosition =
  | typeof DROP_TOP
  | typeof DROP_RIGHT
  | typeof DROP_BOTTOM
  | typeof DROP_LEFT
  | typeof DROP_FORBIDDEN;

type Orientation = 'row' | 'column';

type ClientOffset = {
  x: number;
  y: number;
};

type DOMRectLike = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type DraggingItem = {
  id: string;
  type: ComponentType;
};

type ComponentProps = {
  depth: number;
  parentComponent?: {
    type: ComponentType;
  };
  component: {
    id: string;
    type: ComponentType;
    children?: string[];
  };
  orientation: Orientation;
  isDraggingOverShallow: boolean;
};

type DropTargetComponent = {
  props: ComponentProps;
  ref: {
    getBoundingClientRect: () => DOMRectLike | null;
  };
};

type DropTargetMonitor = {
  getItem: () => DraggingItem | null;
  getClientOffset: () => ClientOffset | null;
};

// this defines how close the mouse must be to the edge of a component to display
// a sibling type drop indicator
const SIBLING_DROP_THRESHOLD = 20;
const NON_SHALLOW_DROP_THRESHOLD = 20;

let CACHED_CLIENT_OFFSET: Record<string, ClientOffset> = {};
export function clearDropCache() {
  CACHED_CLIENT_OFFSET = {};
}

export default function getDropPosition(
  monitor: DropTargetMonitor,
  Component: DropTargetComponent,
): DropPosition | null {
  const {
    depth: componentDepth,
    parentComponent,
    component,
    orientation,
    isDraggingOverShallow,
  } = Component.props;

  const draggingItem = monitor.getItem();

  if (!draggingItem || draggingItem.id === component.id) {
    return null;
  }

  const validChild = isValidChild({
    parentType: component.type,
    parentDepth: componentDepth,
    childType: draggingItem.type,
  });

  const parentType = parentComponent?.type;
  const parentDepth =
    componentDepth +
    (parentType === TAB_TYPE || parentType === TABS_TYPE ? 0 : -1);

  const validSibling = isValidChild({
    parentType,
    parentDepth,
    childType: draggingItem.type,
  });

  if (!validChild && !validSibling) {
    return DROP_FORBIDDEN;
  }

  const hasChildren = (component.children || []).length > 0;
  const childDropOrientation =
    orientation === 'row' ? 'vertical' : 'horizontal';
  const siblingDropOrientation =
    orientation === 'row' ? 'horizontal' : 'vertical';

  if (validChild && !validSibling) {
    if (childDropOrientation === 'vertical') {
      return hasChildren ? DROP_RIGHT : DROP_LEFT;
    }
    return hasChildren ? DROP_BOTTOM : DROP_TOP;
  }

  const refBoundingRect = Component.ref.getBoundingClientRect();
  const clientOffset =
    monitor.getClientOffset() || CACHED_CLIENT_OFFSET[component.id];

  if (!clientOffset || !refBoundingRect) {
    return null;
  }

  CACHED_CLIENT_OFFSET[component.id] = clientOffset;
  const deltaTop = Math.abs(clientOffset.y - refBoundingRect.top);
  const deltaBottom = Math.abs(clientOffset.y - refBoundingRect.bottom);
  const deltaLeft = Math.abs(clientOffset.x - refBoundingRect.left);
  const deltaRight = Math.abs(clientOffset.x - refBoundingRect.right);

  if (
    !isDraggingOverShallow &&
    [deltaTop, deltaBottom, deltaLeft, deltaRight].every(
      delta => delta > NON_SHALLOW_DROP_THRESHOLD,
    )
  ) {
    return null;
  }

  if (validSibling && !validChild) {
    if (siblingDropOrientation === 'vertical') {
      const refMiddleX =
        refBoundingRect.left +
        (refBoundingRect.right - refBoundingRect.left) / 2;
      return clientOffset.x < refMiddleX ? DROP_LEFT : DROP_RIGHT;
    }
    const refMiddleY =
      refBoundingRect.top + (refBoundingRect.bottom - refBoundingRect.top) / 2;
    return clientOffset.y < refMiddleY ? DROP_TOP : DROP_BOTTOM;
  }

  if (validSibling && validChild) {
    if (siblingDropOrientation === 'vertical') {
      if (deltaLeft < SIBLING_DROP_THRESHOLD) return DROP_LEFT;
      if (deltaRight < SIBLING_DROP_THRESHOLD) return DROP_RIGHT;
    } else {
      if (deltaTop < SIBLING_DROP_THRESHOLD) return DROP_TOP;
      if (deltaBottom < SIBLING_DROP_THRESHOLD) return DROP_BOTTOM;
    }

    if (childDropOrientation === 'vertical') {
      return hasChildren ? DROP_RIGHT : DROP_LEFT;
    }
    return hasChildren ? DROP_BOTTOM : DROP_TOP;
  }

  return null;
}
