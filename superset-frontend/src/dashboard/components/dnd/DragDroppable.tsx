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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { DragSource, DropTarget } from 'react-dnd';
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
    /*
      Next line is a workaround for a bug in react-dnd where the drag
      preview expands outside of the bounds of the drag source card, see:
      https://github.com/react-dnd/react-dnd/issues/832#issuecomment-442071628
    */
    &.dragdroppable--edit-mode {
      transform: translate3d(0, 0, 0);
    }

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
// export unwrapped component for testing
export class UnwrappedDragDroppable extends PureComponent {
  mounted: $TSFixMe;

  ref: $TSFixMe;

  constructor(props: $TSFixMe) {
    super(props);
    this.state = {
      dropIndicator: null, // this gets set/modified by the react-dnd HOCs
    };
    this.setRef = this.setRef.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  componentDidUpdate(prevProps: $TSFixMe, prevState: $TSFixMe) {
    const {
      // @ts-expect-error TS(2339): Property 'onDropIndicatorChange' does not exist on... Remove this comment to see the full error message
      onDropIndicatorChange,
      // @ts-expect-error TS(2339): Property 'isDraggingOver' does not exist on type '... Remove this comment to see the full error message
      isDraggingOver,
      // @ts-expect-error TS(2339): Property 'component' does not exist on type 'Reado... Remove this comment to see the full error message
      component,
      // @ts-expect-error TS(2339): Property 'index' does not exist on type 'Readonly<... Remove this comment to see the full error message
      index,
      // @ts-expect-error TS(2339): Property 'dragComponentId' does not exist on type ... Remove this comment to see the full error message
      dragComponentId,
      // @ts-expect-error TS(2339): Property 'onDragTab' does not exist on type 'Reado... Remove this comment to see the full error message
      onDragTab,
    } = this.props;
    // @ts-expect-error TS(2339): Property 'dropIndicator' does not exist on type 'R... Remove this comment to see the full error message
    const { dropIndicator } = this.state;
    const isTabsType = component.type === TAB_TYPE;
    const validStateChange =
      dropIndicator !== prevState.dropIndicator ||
      isDraggingOver !== prevProps.isDraggingOver ||
      index !== prevProps.index;

    if (onDropIndicatorChange && isTabsType && validStateChange) {
      onDropIndicatorChange({ dropIndicator, isDraggingOver, index });
    }

    if (dragComponentId !== prevProps.dragComponentId) {
      setTimeout(() => {
        /**
         * This timeout ensures the dargSourceRef and dragPreviewRef are set
         * before the component is removed in Tabs.jsx. Otherwise react-dnd
         * will not render the drag preview.
         */
        onDragTab(dragComponentId);
      });
    }
  }

  setRef(ref: $TSFixMe) {
    this.ref = ref;
    // this is needed for a custom drag preview
    // @ts-expect-error TS(2339): Property 'useEmptyDragPreview' does not exist on t... Remove this comment to see the full error message
    if (this.props.useEmptyDragPreview) {
      // @ts-expect-error TS(2339): Property 'dragPreviewRef' does not exist on type '... Remove this comment to see the full error message
      this.props.dragPreviewRef(getEmptyImage(), {
        // IE fallback: specify that we'd rather screenshot the node
        // when it already knows it's being dragged so we can hide it with CSS.
        captureDraggingState: true,
      });
    } else {
      // @ts-expect-error TS(2339): Property 'dragPreviewRef' does not exist on type '... Remove this comment to see the full error message
      this.props.dragPreviewRef(ref);
    }
    // @ts-expect-error TS(2339): Property 'droppableRef' does not exist on type 'Re... Remove this comment to see the full error message
    this.props.droppableRef?.(ref);
  }

  render() {
    const {
      children,
      // @ts-expect-error TS(2339): Property 'className' does not exist on type 'Reado... Remove this comment to see the full error message
      className,
      // @ts-expect-error TS(2339): Property 'orientation' does not exist on type 'Rea... Remove this comment to see the full error message
      orientation,
      // @ts-expect-error TS(2339): Property 'dragSourceRef' does not exist on type 'R... Remove this comment to see the full error message
      dragSourceRef,
      // @ts-expect-error TS(2339): Property 'disableDragDrop' does not exist on type ... Remove this comment to see the full error message
      disableDragDrop,
      // @ts-expect-error TS(2339): Property 'isDragging' does not exist on type 'Read... Remove this comment to see the full error message
      isDragging,
      // @ts-expect-error TS(2339): Property 'isDraggingOver' does not exist on type '... Remove this comment to see the full error message
      isDraggingOver,
      // @ts-expect-error TS(2339): Property 'style' does not exist on type 'Readonly<... Remove this comment to see the full error message
      style,
      // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
      editMode,
      // @ts-expect-error TS(2339): Property 'component' does not exist on type 'Reado... Remove this comment to see the full error message
      component,
      // @ts-expect-error TS(2339): Property 'dragComponentType' does not exist on typ... Remove this comment to see the full error message
      dragComponentType,
    } = this.props;

    // @ts-expect-error TS(2339): Property 'dropIndicator' does not exist on type 'R... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2349): This expression is not callable.
        {children(childProps)}
      </DragDroppableStyles>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
UnwrappedDragDroppable.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
UnwrappedDragDroppable.defaultProps = defaultProps;

// @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
export const Draggable = DragSource(...dragConfig)(UnwrappedDragDroppable);
// @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
export const Droppable = DropTarget(...dropConfig)(UnwrappedDragDroppable);

// note that the composition order here determines using
// component.method() vs decoratedComponentInstance.method() in the drag/drop config
// @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
export const DragDroppable = DragSource(...dragConfig)(
  // @ts-expect-error TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
  DropTarget(...dropConfig)(UnwrappedDragDroppable),
);
