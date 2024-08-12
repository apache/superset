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
import handleHover from './handleHover';
import handleDrop from './handleDrop';

// note: the 'type' hook is not useful for us as dropping is contingent on other properties
const TYPE = 'DRAG_DROPPABLE';

export const dragConfig = [
  TYPE,
  {
    canDrag(props) {
      return !props.disableDragDrop;
    },

    // this defines the dragging item object returned by monitor.getItem()
    beginDrag(props /* , monitor, component */) {
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
    };
  },
];

export const dropConfig = [
  TYPE,
  {
    canDrop(props) {
      return !props.disableDragDrop;
    },
    hover(props, monitor, component) {
      if (component && component.mounted) {
        handleHover(props, monitor, component);
      }
    },
    // note:
    //  the react-dnd api requires that the drop() method return a result or undefined
    //  monitor.didDrop() cannot be used because it returns true only for the most-nested target
    drop(props, monitor, component) {
      const dropResult = monitor.getDropResult();
      if ((!dropResult || !dropResult.destination) && component.mounted) {
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
