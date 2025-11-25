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

import { LayoutItem, ComponentType } from 'src/dashboard/types';

// note: the 'type' hook is not useful for us as dropping is contingent on other properties
const TYPE = 'DRAG_DROPPABLE';

export interface DragDroppableProps {
  component: LayoutItem;
  parentComponent?: LayoutItem;
  index: number;
  disableDragDrop: boolean;
  onDrop?: (dropResult: DropResult) => void;
  onHover?: () => void;
  dropToChild?: boolean | ((draggingItem: DragItem) => boolean);
}

export interface DragItem {
  type: ComponentType;
  id: string;
  meta: LayoutItem['meta'];
  index: number;
  parentId?: string;
  parentType?: ComponentType;
}

export interface DropResult {
  source: {
    id: string;
    type: ComponentType;
    index: number;
  };
  dragging: {
    id: string;
    type: ComponentType;
    meta: LayoutItem['meta'];
  };
  destination?: {
    id: string;
    type: ComponentType;
    index: number;
  };
  position?: string;
}

// For @dnd-kit, we'll handle drag/drop logic directly in the component
// These exports maintain backward compatibility for components that import from this file
export { TYPE };
export default { TYPE };