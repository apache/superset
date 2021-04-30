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
import React from 'react';
import PropTypes from 'prop-types';
import { Resizable } from 're-resizable';
import cx from 'classnames';

import ResizableHandle from './ResizableHandle';
import resizableConfig from '../../util/resizableConfig';
import { GRID_BASE_UNIT, GRID_GUTTER_SIZE } from '../../util/constants';

const proxyToInfinity = Number.MAX_VALUE;

const propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.node,
  adjustableWidth: PropTypes.bool,
  adjustableHeight: PropTypes.bool,
  gutterWidth: PropTypes.number,
  widthStep: PropTypes.number,
  heightStep: PropTypes.number,
  widthMultiple: PropTypes.number,
  heightMultiple: PropTypes.number,
  minWidthMultiple: PropTypes.number,
  maxWidthMultiple: PropTypes.number,
  minHeightMultiple: PropTypes.number,
  maxHeightMultiple: PropTypes.number,
  staticHeight: PropTypes.number,
  staticHeightMultiple: PropTypes.number,
  staticWidth: PropTypes.number,
  staticWidthMultiple: PropTypes.number,
  onResizeStop: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStart: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
};

const defaultProps = {
  children: null,
  adjustableWidth: true,
  adjustableHeight: true,
  gutterWidth: GRID_GUTTER_SIZE,
  widthStep: GRID_BASE_UNIT,
  heightStep: GRID_BASE_UNIT,
  widthMultiple: null,
  heightMultiple: null,
  minWidthMultiple: 1,
  maxWidthMultiple: proxyToInfinity,
  minHeightMultiple: 1,
  maxHeightMultiple: proxyToInfinity,
  staticHeight: null,
  staticHeightMultiple: null,
  staticWidth: null,
  staticWidthMultiple: null,
  onResizeStop: null,
  onResize: null,
  onResizeStart: null,
};

// because columns are not multiples of a single variable (width = n*cols + (n-1) * gutters)
// we snap to the base unit and then snap to _actual_ column multiples on stop
const SNAP_TO_GRID = [GRID_BASE_UNIT, GRID_BASE_UNIT];
const HANDLE_CLASSES = {
  right: 'resizable-container-handle--right',
  bottom: 'resizable-container-handle--bottom',
};
class ResizableContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      isResizing: false,
    };

    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleResizeStop = this.handleResizeStop.bind(this);
  }

  handleResizeStart(event, direction, ref) {
    const { id, onResizeStart } = this.props;

    if (onResizeStart) {
      onResizeStart({ id, direction, ref });
    }

    this.setState(() => ({ isResizing: true }));
  }

  handleResize(event, direction, ref) {
    const { onResize, id } = this.props;
    if (onResize) {
      onResize({ id, direction, ref });
    }
  }

  handleResizeStop(event, direction, ref, delta) {
    const {
      id,
      onResizeStop,
      widthStep,
      heightStep,
      widthMultiple,
      heightMultiple,
      adjustableHeight,
      adjustableWidth,
      gutterWidth,
    } = this.props;

    if (onResizeStop) {
      const nextWidthMultiple =
        widthMultiple + Math.round(delta.width / (widthStep + gutterWidth));
      const nextHeightMultiple =
        heightMultiple + Math.round(delta.height / heightStep);

      onResizeStop({
        id,
        widthMultiple: adjustableWidth ? nextWidthMultiple : null,
        heightMultiple: adjustableHeight ? nextHeightMultiple : null,
      });

      this.setState(() => ({ isResizing: false }));
    }
  }

  render() {
    const {
      children,
      adjustableWidth,
      adjustableHeight,
      widthStep,
      heightStep,
      widthMultiple,
      heightMultiple,
      staticHeight,
      staticHeightMultiple,
      staticWidth,
      staticWidthMultiple,
      minWidthMultiple,
      maxWidthMultiple,
      minHeightMultiple,
      maxHeightMultiple,
      gutterWidth,
      editMode,
    } = this.props;

    const size = {
      width: adjustableWidth
        ? (widthStep + gutterWidth) * widthMultiple - gutterWidth
        : (staticWidthMultiple && staticWidthMultiple * widthStep) ||
          staticWidth ||
          undefined,
      height: adjustableHeight
        ? heightStep * heightMultiple
        : (staticHeightMultiple && staticHeightMultiple * heightStep) ||
          staticHeight ||
          undefined,
    };

    let enableConfig = resizableConfig.notAdjustable;

    if (editMode && adjustableWidth && adjustableHeight) {
      enableConfig = resizableConfig.widthAndHeight;
    } else if (editMode && adjustableWidth) {
      enableConfig = resizableConfig.widthOnly;
    } else if (editMode && adjustableHeight) {
      enableConfig = resizableConfig.heightOnly;
    }

    const { isResizing } = this.state;

    return (
      <Resizable
        enable={enableConfig}
        grid={SNAP_TO_GRID}
        minWidth={
          adjustableWidth
            ? minWidthMultiple * (widthStep + gutterWidth) - gutterWidth
            : undefined
        }
        minHeight={
          adjustableHeight ? minHeightMultiple * heightStep : undefined
        }
        maxWidth={
          adjustableWidth
            ? Math.max(
                size.width,
                Math.min(
                  proxyToInfinity,
                  maxWidthMultiple * (widthStep + gutterWidth) - gutterWidth,
                ),
              )
            : undefined
        }
        maxHeight={
          adjustableHeight
            ? Math.max(
                size.height,
                Math.min(proxyToInfinity, maxHeightMultiple * heightStep),
              )
            : undefined
        }
        size={size}
        onResizeStart={this.handleResizeStart}
        onResize={this.handleResize}
        onResizeStop={this.handleResizeStop}
        handleComponent={ResizableHandle}
        className={cx(
          'resizable-container',
          isResizing && 'resizable-container--resizing',
        )}
        handleClasses={HANDLE_CLASSES}
      >
        {children}
      </Resizable>
    );
  }
}

ResizableContainer.propTypes = propTypes;
ResizableContainer.defaultProps = defaultProps;

export default ResizableContainer;
