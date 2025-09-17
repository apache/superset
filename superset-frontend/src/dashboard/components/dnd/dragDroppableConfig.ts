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
import { DragSourceSpec, DropTargetSpec, DragSourceCollector, DropTargetCollector } from 'react-dnd';
import handleHover from './handleHover';
import handleDrop from './handleDrop';

interface DragItem {
  type: string;
  id: string;
  meta?: Record<string, any>;
  index: number;
  parentId?: string;
  parentType?: string;
}

interface DragDroppableProps {
  component: {
    type: string;
    id: string;
    meta?: Record<string, any>;
  };
  parentComponent?: {
    id: string;
    type: string;
  };
  index: number;
  disableDragDrop: boolean;
}

interface DragDroppableComponent {
  mounted: boolean;
}

const TYPE = 'DRAG_DROPPABLE';

export const dragConfig: [
  string,
  DragSourceSpec<DragDroppableProps, DragItem>,
  DragSourceCollector<any, any>
] = [
  TYPE,
  {
    canDrag(props: DragDroppableProps) {
      return !props.disableDragDrop;
    },

    beginDrag(props: DragDroppableProps): DragItem {
      const { component, index, parentComponent = {} } = props;
      return {
        type: component.type,
        id: component.id,
        meta: component.meta,
        index,
        parentId: parentComponent.id,
        parentType: parentComponent.type,
      };
    },
  },
  function dragStateToProps(connect, monitor) {
    return {
      dragSourceRef: connect.dragSource(),
      dragPreviewRef: connect.dragPreview(),
      isDragging: monitor.isDragging(),
      dragComponentType: monitor.getItem()?.type,
      dragComponentId: monitor.getItem()?.id,
    };
  },
];

export const dropConfig: [
  string,
  DropTargetSpec<DragDroppableProps>,
  DropTargetCollector<any, any>
] = [
  TYPE,
  {
    canDrop(props: DragDroppableProps) {
      return !props.disableDragDrop;
    },
    hover(props: DragDroppableProps, monitor, component?: DragDroppableComponent) {
      if (component && component.mounted) {
        handleHover(props, monitor, component);
      }
    },
    drop(props: DragDroppableProps, monitor, component?: DragDroppableComponent) {
      const dropResult = monitor.getDropResult();
      if ((!dropResult || !dropResult.destination) && component?.mounted) {
        return handleDrop(props, monitor, component);
      }
      return undefined;
    },
  },
  function dropStateToProps(connect, monitor) {
    return {
      droppableRef: connect.dropTarget(),
      isDraggingOver: monitor.isOver(),
      isDraggingOverShallow: monitor.isOver({ shallow: true }),
    };
  },
];
