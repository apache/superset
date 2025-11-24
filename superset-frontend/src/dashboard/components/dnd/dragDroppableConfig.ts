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
import {
  DragSourceMonitor,
  DropTargetMonitor,
  ConnectDragSource,
  ConnectDragPreview,
  ConnectDropTarget,
} from 'react-dnd';
import { LayoutItem, ComponentType } from 'src/dashboard/types';
import handleHover from './handleHover';
import handleDrop from './handleDrop';

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

export interface DragStateProps {
  dragSourceRef: ConnectDragSource;
  dragPreviewRef: ConnectDragPreview;
  isDragging: boolean;
  dragComponentType?: ComponentType;
  dragComponentId?: string;
}

export interface DropStateProps {
  droppableRef: ConnectDropTarget;
  isDraggingOver: boolean;
  isDraggingOverShallow: boolean;
}

export interface DragDroppableComponent {
  mounted: boolean;
  props: DragDroppableProps;
  setState: (stateUpdate: () => { dropIndicator: string | null }) => void;
}

export const dragConfig: [
  string,
  {
    canDrag: (props: DragDroppableProps) => boolean;
    beginDrag: (props: DragDroppableProps) => DragItem;
  },
  (connect: any, monitor: DragSourceMonitor) => DragStateProps,
] = [
  TYPE,
  {
    canDrag(props: DragDroppableProps): boolean {
      return !props.disableDragDrop;
    },

    // this defines the dragging item object returned by monitor.getItem()
    beginDrag(props: DragDroppableProps): DragItem {
      const { component, index, parentComponent } = props;
      return {
        type: component.type,
        id: component.id,
        meta: component.meta,
        index,
        parentId: parentComponent?.id,
        parentType: parentComponent?.type,
      };
    },
  },
  function dragStateToProps(
    connect: any,
    monitor: DragSourceMonitor,
  ): DragStateProps {
    return {
      dragSourceRef: connect.dragSource(),
      dragPreviewRef: connect.dragPreview(),
      isDragging: monitor.isDragging(),
      dragComponentType: monitor.getItem()?.type as ComponentType,
      dragComponentId: monitor.getItem()?.id as string,
    };
  },
];

export const dropConfig: [
  string,
  {
    canDrop: (props: DragDroppableProps) => boolean;
    hover: (
      props: DragDroppableProps,
      monitor: DropTargetMonitor,
      component: DragDroppableComponent,
    ) => void;
    drop: (
      props: DragDroppableProps,
      monitor: DropTargetMonitor,
      component: DragDroppableComponent,
    ) => DropResult | undefined;
  },
  (connect: any, monitor: DropTargetMonitor) => DropStateProps,
] = [
  TYPE,
  {
    canDrop(props: DragDroppableProps): boolean {
      return !props.disableDragDrop;
    },
    hover(
      props: DragDroppableProps,
      monitor: DropTargetMonitor,
      component: DragDroppableComponent,
    ): void {
      if (component && component.mounted) {
        handleHover(props, monitor, component);
      }
    },
    // note:
    //  the react-dnd api requires that the drop() method return a result or undefined
    //  monitor.didDrop() cannot be used because it returns true only for the most-nested target
    drop(
      props: DragDroppableProps,
      monitor: DropTargetMonitor,
      component: DragDroppableComponent,
    ): DropResult | undefined {
      const dropResult = monitor.getDropResult() as DropResult | null;
      if ((!dropResult || !dropResult.destination) && component.mounted) {
        return handleDrop(props, monitor, component);
      }
      return undefined;
    },
  },
  function dropStateToProps(
    connect: any,
    monitor: DropTargetMonitor,
  ): DropStateProps {
    return {
      droppableRef: connect.dropTarget(),
      isDraggingOver: monitor.isOver(),
      isDraggingOverShallow: monitor.isOver({ shallow: true }),
    };
  },
];
