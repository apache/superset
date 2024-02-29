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
import React from 'react';
import PropTypes from 'prop-types';
import { DragSource, DropTarget } from 'react-dnd';
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import { componentShape } from '../../util/propShapes';
import { dragConfig, dropConfig } from './dragDroppableConfig';
import {
  DROP_TOP,
  DROP_RIGHT,
  DROP_BOTTOM,
  DROP_LEFT,
} from '../../util/getDropPosition';

const propTypes = {
  children: PropTypes.func,
  className: PropTypes.string,
  component: componentShape,
  parentComponent: componentShape,
  depth: PropTypes.number.isRequired,
  disableDragDrop: PropTypes.bool,
  orientation: PropTypes.oneOf(['row', 'column']),
  index: PropTypes.number.isRequired,
  style: PropTypes.object,
  onDrop: PropTypes.func,
  onHover: PropTypes.func,
  editMode: PropTypes.bool,
  useEmptyDragPreview: PropTypes.bool,

  // from react-dnd
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  isDraggingOverShallow: PropTypes.bool,
  droppableRef: PropTypes.func,
  dragSourceRef: PropTypes.func,
  dragPreviewRef: PropTypes.func,
};

const defaultProps = {
  className: null,
  style: null,
  parentComponent: null,
  disableDragDrop: false,
  children() {},
  onDrop() {},
  onHover() {},
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
    transform: translate3d(0, 0, 0);

    &.dragdroppable--dragging {
      opacity: 0.2;
    }

    &.dragdroppable-row {
      width: 100%;
    }

    &.dragdroppable-column .resizable-container span div {
      z-index: 10;
    }

    &.empty-droptarget--full > .drop-indicator--top {
      height: 100%;
      opacity: 0.3;
    }

    & {
      .drop-indicator {
        display: block;
        background-color: ${theme.colors.primary.base};
        position: absolute;
        z-index: 10;
      }

      .drop-indicator--top {
        top: ${-theme.gridUnit - 2}px;
        left: 0;
        height: ${theme.gridUnit}px;
        width: 100%;
        min-width: ${theme.gridUnit * 4}px;
      }

      .drop-indicator--bottom {
        bottom: ${-theme.gridUnit - 2}px;
        left: 0;
        height: ${theme.gridUnit}px;
        width: 100%;
        min-width: ${theme.gridUnit * 4}px;
      }

      .drop-indicator--right {
        top: 0;
        left: calc(100% - ${theme.gridUnit}px);
        height: 100%;
        width: ${theme.gridUnit}px;
        min-height: ${theme.gridUnit * 4}px;
      }

      .drop-indicator--left {
        top: 0;
        left: 0;
        height: 100%;
        width: ${theme.gridUnit}px;
        min-height: ${theme.gridUnit * 4}px;
      }
    }
  `};
`;
// export unwrapped component for testing
export class UnwrappedDragDroppable extends React.PureComponent {
  constructor(props) {
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

  setRef(ref) {
    this.ref = ref;
    // this is needed for a custom drag preview
    if (this.props.useEmptyDragPreview) {
      this.props.dragPreviewRef(getEmptyImage(), {
        // IE fallback: specify that we'd rather screenshot the node
        // when it already knows it's being dragged so we can hide it with CSS.
        captureDraggingState: true,
      });
    } else {
      this.props.dragPreviewRef(ref);
    }
    this.props.droppableRef?.(ref);
  }

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
    } = this.props;

    const { dropIndicator } = this.state;
    const dropIndicatorProps =
      isDraggingOver && dropIndicator && !disableDragDrop
        ? {
            className: cx(
              'drop-indicator',
              dropIndicator === DROP_TOP && 'drop-indicator--top',
              dropIndicator === DROP_BOTTOM && 'drop-indicator--bottom',
              dropIndicator === DROP_LEFT && 'drop-indicator--left',
              dropIndicator === DROP_RIGHT && 'drop-indicator--right',
            ),
          }
        : null;

    const childProps = editMode
      ? {
          dragSourceRef,
          dropIndicatorProps,
        }
      : {};

    return (
      <DragDroppableStyles
        style={style}
        ref={this.setRef}
        data-test="dragdroppable-object"
        className={cx(
          'dragdroppable',
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

UnwrappedDragDroppable.propTypes = propTypes;
UnwrappedDragDroppable.defaultProps = defaultProps;

// note that the composition order here determines using
// component.method() vs decoratedComponentInstance.method() in the drag/drop config
export default DragSource(...dragConfig)(
  DropTarget(...dropConfig)(UnwrappedDragDroppable),
);
