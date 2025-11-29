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
  ReactNode,
  useState,
  useEffect,
  useRef,
  CSSProperties,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import {
  useDraggable,
  useDroppable,
  DndContext,
  DragOverlay,
  Active,
  Over,
} from '@dnd-kit/core';
import {
  CSS,
} from '@dnd-kit/utilities';
import cx from 'classnames';
import { css, styled } from '@apache-superset/core/ui';

import { DROP_FORBIDDEN } from '../../util/getDropPosition';

type Orientation = 'row' | 'column';

interface ComponentType {
  id: string;
  type: string;
  parents?: string[];
  children?: string[];
  meta?: {
    width?: number;
    height?: number;
    headerSize?: string;
    background?: string;
    chartId?: number;
  };
}

interface ChildProps {
  dragSourceRef?: (element: HTMLElement | null) => void;
  dropIndicatorProps?: {
    className: string;
  } | null;
  draggingTabOnTab?: boolean;
  'data-test': string;
}

interface DragDroppableProps {
  children: (props: ChildProps) => ReactNode;
  className?: string | null;
  component: ComponentType;
  parentComponent?: ComponentType | null;
  depth: number;
  disableDragDrop?: boolean;
  dropToChild?: boolean;
  orientation?: Orientation;
  index: number;
  style?: CSSProperties | null;
  onDrop?: () => void;
  onHover?: () => void;
  onDropIndicatorChange?: (params: {
    dropIndicator: string | null;
    isDraggingOver: boolean;
    index: number;
  }) => void;
  onDragTab?: (dragComponentId: string | number | undefined) => void;
  editMode?: boolean;
  useEmptyDragPreview?: boolean;
}

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
      width: 100%;
    }

    .drop-indicator {
      display: block;
      background-color: ${theme.colors.primary.base};
      position: absolute;
      z-index: 10;
    }

    &.dragdroppable-row .drop-indicator {
      left: 0;
      top: -1px;
      height: 2px;
      width: 100%;
      min-width: ${theme.gridUnit * 4}px;
    }

    &.dragdroppable-column .drop-indicator {
      top: 0;
      left: -1px;
      width: 2px;
      height: 100%;
      min-height: ${theme.gridUnit * 4}px;
    }

    .drop-indicator--forbidden {
      background-color: ${theme.colors.warning.light1};
    }
  `}
`;

export const DragDroppable = forwardRef<HTMLDivElement, DragDroppableProps>(
  (props, ref) => {
    const {
      children,
      className,
      component,
      parentComponent,
      depth,
      disableDragDrop,
      dropToChild,
      orientation,
      index,
      style,
      onDrop,
      onHover,
      onDropIndicatorChange,
      onDragTab,
      editMode,
      useEmptyDragPreview,
    } = props;

    const [dropIndicator, setDropIndicator] = useState<string | null>(null);
    const elementRef = useRef<HTMLDivElement>(null);

    // Setup draggable functionality
    const {
      attributes: dragAttributes,
      listeners: dragListeners,
      setNodeRef: setDragNodeRef,
      isDragging,
      transform,
    } = useDraggable({
      id: `drag-${component.id}`,
      disabled: disableDragDrop || !editMode,
      data: {
        type: component.type,
        id: component.id,
        meta: component.meta,
        index,
        parentId: parentComponent?.id,
        parentType: parentComponent?.type,
      },
    });

    // Setup droppable functionality
    const {
      setNodeRef: setDropNodeRef,
      isOver: isDraggingOver,
      active,
      over,
    } = useDroppable({
      id: `drop-${component.id}`,
      disabled: disableDragDrop,
      data: {
        type: component.type,
        id: component.id,
        index,
      },
    });

    // Combine refs
    const setRefs = (element: HTMLDivElement | null) => {
      elementRef.current = element;
      setDragNodeRef(element);
      setDropNodeRef(element);
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else {
          ref.current = element;
        }
      }
    };

    // Handle drop indicator changes
    useEffect(() => {
      if (onDropIndicatorChange && component.type === TAB_TYPE) {
        onDropIndicatorChange({
          dropIndicator,
          isDraggingOver,
          index,
        });
      }
    }, [dropIndicator, isDraggingOver, index, onDropIndicatorChange, component.type]);

    // Handle drag tab
    useEffect(() => {
      if (onDragTab && active?.data.current?.id) {
        onDragTab(active.data.current.id);
      }
    }, [active?.data.current?.id, onDragTab]);

    const dragComponentType = active?.data.current?.type;
    const draggingTabOnTab =
      component.type === TAB_TYPE && dragComponentType === TAB_TYPE;

    const dropIndicatorProps =
      isDraggingOver && dropIndicator && !disableDragDrop
        ? {
            className: cx(
              'drop-indicator',
              dropIndicator === DROP_FORBIDDEN && 'drop-indicator--forbidden',
            ),
          }
        : null;

    const childProps: ChildProps = editMode
      ? {
          dragSourceRef: (element) => {
            if (element && !disableDragDrop) {
              // Apply drag attributes and listeners to the drag handle
              Object.entries(dragAttributes).forEach(([key, value]) => {
                element.setAttribute(key, value as string);
              });
              Object.entries(dragListeners || {}).forEach(([event, handler]) => {
                element.addEventListener(event, handler as EventListener);
              });
            }
          },
          dropIndicatorProps,
          draggingTabOnTab,
          'data-test': 'dragdroppable-content',
        }
      : {
          'data-test': 'dragdroppable-content',
        };

    const transformStyle = transform
      ? {
          transform: CSS.Transform.toString(transform),
        }
      : undefined;

    return (
      <DragDroppableStyles
        style={{ ...style, ...transformStyle }}
        ref={setRefs}
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
  },
);

DragDroppable.displayName = 'DragDroppable';

// Export compatibility aliases for gradual migration
export const Draggable = DragDroppable;
export const Droppable = DragDroppable;