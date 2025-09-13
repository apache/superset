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
import { ReactNode, PureComponent, CSSProperties, RefCallback } from 'react';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { DragSource, DropTarget, ConnectDragSource, ConnectDropTarget, ConnectDragPreview, DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import { componentShape } from '../../util/propShapes';
import { dragConfig, dropConfig } from './dragDroppableConfig';
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
  dragSourceRef?: ConnectDragSource;
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
  onDropIndicatorChange?: (params: { dropIndicator: string | null; isDraggingOver: boolean; index: number }) => void;
  onDragTab?: (dragComponentId: string | number | undefined) => void;
  editMode?: boolean;
  useEmptyDragPreview?: boolean;

  // from react-dnd
  isDragging?: boolean;
  isDraggingOver?: boolean;
  isDraggingOverShallow?: boolean;
  dragComponentType?: string;
  dragComponentId?: string | number;
  droppableRef?: RefCallback<HTMLElement>;
  dragSourceRef?: ConnectDragSource;
  dragPreviewRef?: ConnectDragPreview;
}

interface DragDroppableState {
  dropIndicator: string | null;
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
      z-index: 10;
    }

    & {
      .drop-indicator {
        display: block;
        background-color: ${theme.colors.primary.base};
        position: absolute;
        z-index: 10;
        opacity: 0.3;
        width: 100%;
        height: 100%;
        &.drop-indicator--forbidden {
          background-color: ${theme.colors.error.light2};
        }
      }
    }
  `};
`;

export class UnwrappedDragDroppable extends PureComponent<DragDroppableProps, DragDroppableState> {
  private mounted = false;
  private ref: HTMLElement | null = null;

  static defaultProps: Partial<DragDroppableProps> = {
    className: null,
    style: null,
    parentComponent: null,
    disableDragDrop: false,
    dropToChild: false,
    children: () => null,
    onDrop: () => {},
    onHover: () => {},
    onDropIndicatorChange: () => {},
    onDragTab: () => {},
    orientation: 'row',
    useEmptyDragPreview: false,
    isDragging: false,
    isDraggingOver: false,
    isDraggingOverShallow: false,
    droppableRef: () => {},
    dragSourceRef: undefined,
    dragPreviewRef: undefined,
  };

  constructor(props: DragDroppableProps) {
    super(props);
    this.state = {
      dropIndicator: null,
    };
    this.setRef = this.setRef.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  componentDidUpdate(prevProps: DragDroppableProps, prevState: DragDroppableState) {
    const {
      onDropIndicatorChange,
      isDraggingOver,
      component,
      index,
      dragComponentId,
      onDragTab,
    } = this.props;
    const { dropIndicator } = this.state;
    const isTabsType = component.type === TAB_TYPE;
    const validStateChange =
      dropIndicator !== prevState.dropIndicator ||
      isDraggingOver !== prevProps.isDraggingOver ||
      index !== prevProps.index;

    if (onDropIndicatorChange && isTabsType && validStateChange) {
      onDropIndicatorChange({ dropIndicator, isDraggingOver: Boolean(isDraggingOver), index });
    }

    if (dragComponentId !== prevProps.dragComponentId) {
      setTimeout(() => {
        if (onDragTab) {
          onDragTab(dragComponentId);
        }
      });
    }
  }

  setRef = (ref: HTMLElement | null) => {
    this.ref = ref;
    if (this.props.useEmptyDragPreview && this.props.dragPreviewRef) {
      this.props.dragPreviewRef(getEmptyImage(), {
        captureDraggingState: true,
      });
    } else if (this.props.dragPreviewRef) {
      this.props.dragPreviewRef(ref);
    }
    if (this.props.droppableRef) {
      this.props.droppableRef(ref);
    }
  };

  render() {
    const {
      children,
      className,
      orientation,
      dragSourceRef,
      disableDragDrop,
      isDragging,
      isDraggingOver,
      style,
      editMode,
      component,
      dragComponentType,
    } = this.props;

    const { dropIndicator } = this.state;
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

    const childProps: ChildProps = editMode
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
        style={style || undefined}
        ref={this.setRef}
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
}

export const Draggable = DragSource(...dragConfig)(UnwrappedDragDroppable);
export const Droppable = DropTarget(...dropConfig)(UnwrappedDragDroppable);

export const DragDroppable = DragSource(...dragConfig)(
  DropTarget(...dropConfig)(UnwrappedDragDroppable),
);
