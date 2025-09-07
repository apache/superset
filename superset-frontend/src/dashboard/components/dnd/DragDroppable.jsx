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
import { getEmptyImage } from 'react-dnd-html5-backend';
import { PureComponent, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { useDrag, useDrop } from 'react-dnd';
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import { componentShape } from '../../util/propShapes';
import { dragConfig, dropConfig } from './dragDroppableConfig';
import { DROP_FORBIDDEN } from '../../util/getDropPosition';

const propTypes = {
  children: PropTypes.func,
  className: PropTypes.string,
  component: componentShape,
  parentComponent: componentShape,
  depth: PropTypes.number.isRequired,
  disableDragDrop: PropTypes.bool,
  dropToChild: PropTypes.bool,
  orientation: PropTypes.oneOf(['row', 'column']),
  index: PropTypes.number.isRequired,
  style: PropTypes.object,
  onDrop: PropTypes.func,
  onHover: PropTypes.func,
  onDropIndicatorChange: PropTypes.func,
  onDragTab: PropTypes.func,
  editMode: PropTypes.bool,
  useEmptyDragPreview: PropTypes.bool,

  // from react-dnd
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  isDraggingOverShallow: PropTypes.bool,
  dragComponentType: PropTypes.string,
  dragComponentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  droppableRef: PropTypes.func,
  dragSourceRef: PropTypes.func,
  dragPreviewRef: PropTypes.func,
};

const defaultProps = {
  className: null,
  style: null,
  parentComponent: null,
  disableDragDrop: false,
  dropToChild: false,
  children() {},
  onDrop() {},
  onHover() {},
  onDropIndicatorChange() {},
  onDragTab() {},
  orientation: 'row',
  useEmptyDragPreview: false,
  isDragging: false,
  isDraggingOver: false,
  isDraggingOverShallow: false,
  droppableRef() {},
  dragSourceRef() {},
  dragPreviewRef() {},
};

const DragDroppableStyles = styled.div`
  ${({ theme }) => css`
    position: relative;

    &.dragdroppable--dragging {
      opacity: 0.2;
    }

    &.dragdroppable-row {
      width: 100%;
    }

    &.dragdroppable-column .resizable-container span div {
      z-index: 10;
    }

    & {
      .drop-indicator {
        display: block;
        background-color: ${theme.colorPrimary};
        position: absolute;
        z-index: 10;
        opacity: 0.3;
        width: 100%;
        height: 100%;
        &.drop-indicator--forbidden {
          background-color: ${theme.colorErrorBg};
        }
      }
    }
  `};
`;
// Functional component using hooks API
export function UnwrappedDragDroppable(props) {
  const {
    children,
    className,
    orientation,
    disableDragDrop = false,
    style,
    editMode,
    component,
    index,
    parentComponent = {},
    onDrop = () => {},
    onHover = () => {},
    onDropIndicatorChange = () => {},
    onDragTab = () => {},
    useEmptyDragPreview = false,
  } = props;

  const ref = useRef(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [{ isDragging, dragComponentType, dragComponentId }, dragSourceRef, dragPreviewRef] = useDrag({
    type: 'DRAG_DROPPABLE',
    canDrag: () => !disableDragDrop,
    item: () => ({
      type: component.type,
      id: component.id,
      meta: component.meta,
      index,
      parentId: parentComponent.id,
      parentType: parentComponent.type,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
      dragComponentType: monitor.getItem()?.type,
      dragComponentId: monitor.getItem()?.id,
    }),
  });

  const [{ isDraggingOver, isDraggingOverShallow }, droppableRef] = useDrop({
    accept: 'DRAG_DROPPABLE',
    canDrop: () => !disableDragDrop,
    hover: (item, monitor) => {
      if (mounted) {
        // Import and call handleHover logic
        const handleHover = require('./handleHover').default;
        handleHover({ ...props, component }, monitor, { mounted: true, setState: setDropIndicator });
      }
    },
    drop: (item, monitor) => {
      const dropResult = monitor.getDropResult();
      if ((!dropResult || !dropResult.destination) && mounted) {
        const handleDrop = require('./handleDrop').default;
        return handleDrop({ ...props, component }, monitor, { mounted: true });
      }
      return undefined;
    },
    collect: (monitor) => ({
      isDraggingOver: monitor.isOver(),
      isDraggingOverShallow: monitor.isOver({ shallow: true }),
    }),
  });

  const setRef = (element) => {
    ref.current = element;
    droppableRef(element);
    dragSourceRef(element);
    
    if (useEmptyDragPreview) {
      dragPreviewRef(getEmptyImage(), {
        captureDraggingState: true,
      });
    } else {
      dragPreviewRef(element);
    }
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const isTabsType = component.type === TAB_TYPE;
    if (onDropIndicatorChange && isTabsType) {
      onDropIndicatorChange({ dropIndicator, isDraggingOver, index });
    }
  }, [dropIndicator, isDraggingOver, index, onDropIndicatorChange, component.type]);

  useEffect(() => {
    if (dragComponentId) {
      setTimeout(() => {
        onDragTab(dragComponentId);
      });
    }
  }, [dragComponentId, onDragTab]);

  const dropIndicatorProps =
    isDraggingOver && dropIndicator && !disableDragDrop
      ? {
          className: cx(
            'drop-indicator',
            dropIndicator === DROP_FORBIDDEN && 'drop-indicator--forbidden',
          ),
        }
      : null;

  const draggingTabOnTab =
    component.type === TAB_TYPE && dragComponentType === TAB_TYPE;

  const childProps = editMode
    ? {
        dragSourceRef,
        dropIndicatorProps,
        draggingTabOnTab,
        'data-test': 'dragdroppable-content',
      }
    : {
        'data-test': 'dragdroppable-content',
      };

  return (
    <DragDroppableStyles
      style={style}
      ref={setRef}
      data-test="dragdroppable-object"
      className={cx(
        'dragdroppable',
        editMode && 'dragdroppable--edit-mode',
        orientation === 'row' && 'dragdroppable-row',
        orientation === 'column' && 'dragdroppable-column',
        isDragging && 'dragdroppable--dragging',
        className,
      )}
    >
      {children(childProps)}
    </DragDroppableStyles>
  );
}

UnwrappedDragDroppable.propTypes = propTypes;
UnwrappedDragDroppable.defaultProps = defaultProps;

export const Draggable = DragSource(...dragConfig)(UnwrappedDragDroppable);
export const Droppable = DropTarget(...dropConfig)(UnwrappedDragDroppable);

// note that the composition order here determines using
// component.method() vs decoratedComponentInstance.method() in the drag/drop config
export const DragDroppable = DragSource(...dragConfig)(
  DropTarget(...dropConfig)(UnwrappedDragDroppable),
);
