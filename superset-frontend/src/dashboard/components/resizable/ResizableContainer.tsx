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
import { useState, useCallback, useMemo } from 'react';
import { ResizeCallback, ResizeStartCallback, Resizable } from 're-resizable';
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import {
  RightResizeHandle,
  BottomResizeHandle,
  BottomRightResizeHandle,
} from './ResizableHandle';
import resizableConfig from '../../util/resizableConfig';
import { GRID_BASE_UNIT, GRID_GUTTER_SIZE } from '../../util/constants';

const proxyToInfinity = Number.MAX_VALUE;

export interface ResizableContainerProps {
  id: string;
  children?: object;
  adjustableWidth?: boolean;
  adjustableHeight?: boolean;
  gutterWidth?: number;
  widthStep?: number;
  heightStep?: number;
  widthMultiple: number;
  heightMultiple: number;
  minWidthMultiple?: number;
  maxWidthMultiple?: number;
  minHeightMultiple?: number;
  maxHeightMultiple?: number;
  staticHeight?: number;
  staticHeightMultiple?: number;
  staticWidth?: number;
  staticWidthMultiple?: number;
  onResizeStart?: ResizeStartCallback;
  onResize?: ResizeCallback;
  onResizeStop?: ResizeCallback;
  editMode: boolean;
}

// because columns are not multiples of a single variable (width = n*cols + (n-1) * gutters)
// we snap to the base unit and then snap to _actual_ column multiples on stop
const SNAP_TO_GRID: [number, number] = [GRID_BASE_UNIT, GRID_BASE_UNIT];
const HANDLE_CLASSES = {
  right: 'resizable-container-handle--right',
  bottom: 'resizable-container-handle--bottom',
};
// @ts-ignore
const StyledResizable = styled(Resizable)`
  ${({ theme }) => css`
    &.resizable-container {
      background-color: transparent;
      position: relative;

      /* re-resizable sets an empty div to 100% width and height, which doesn't
      play well with many 100% height containers we need */

      & ~ div {
        width: auto !important;
        height: auto !important;
      }
    }

    &.resizable-container--resizing {
      /* after ensures border visibility on top of any children */

      &:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-shadow: inset 0 0 0 2px ${theme.colors.primary.base};
      }

      & > span .resize-handle {
        border-color: ${theme.colors.primary.base};
      }
    }

    .resize-handle {
      opacity: 0;
      z-index: 10;

      &--bottom-right {
        position: absolute;
        border-right: 1px solid ${theme.colors.text.label};
        border-bottom: 1px solid ${theme.colors.text.label};
        right: ${theme.gridUnit * 4}px;
        bottom: ${theme.gridUnit * 4}px;
        width: ${theme.gridUnit * 2}px;
        height: ${theme.gridUnit * 2}px;
      }

      &--right {
        width: ${theme.gridUnit / 2}px;
        height: ${theme.gridUnit * 5}px;
        right: ${theme.gridUnit}px;
        top: 50%;
        transform: translate(0, -50%);
        position: absolute;
        border-left: 1px solid ${theme.colors.text.label};
        border-right: 1px solid ${theme.colors.text.label};
      }

      &--bottom {
        height: ${theme.gridUnit / 2}px;
        width: ${theme.gridUnit * 5}px;
        bottom: ${theme.gridUnit}px;
        left: 50%;
        transform: translate(-50%);
        position: absolute;
        border-top: 1px solid ${theme.colors.text.label};
        border-bottom: 1px solid ${theme.colors.text.label};
      }
    }
  `}

  &.resizable-container:hover .resize-handle,
  &.resizable-container--resizing .resize-handle {
    opacity: 1;
  }

  .dragdroppable-column & .resizable-container-handle--right {
    /* override the default because the inner column's handle's mouse target is very small */
    right: 0 !important;
  }

  & .resizable-container-handle--bottom {
    bottom: 0 !important;
  }
`;

export default function ResizableContainer({
  id,
  children,
  widthMultiple,
  heightMultiple,
  staticHeight,
  staticHeightMultiple,
  staticWidth,
  staticWidthMultiple,
  onResizeStop,
  onResize,
  onResizeStart,
  editMode,
  adjustableWidth = true,
  adjustableHeight = true,
  gutterWidth = GRID_GUTTER_SIZE,
  widthStep = GRID_BASE_UNIT,
  heightStep = GRID_BASE_UNIT,
  minWidthMultiple = 1,
  maxWidthMultiple = proxyToInfinity,
  minHeightMultiple = 1,
  maxHeightMultiple = proxyToInfinity,
}: ResizableContainerProps) {
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const handleResize = useCallback<ResizeCallback>(
    (event, direction, elementRef, delta) => {
      if (onResize) onResize(event, direction, elementRef, delta);
    },
    [onResize],
  );

  const handleResizeStart = useCallback<ResizeStartCallback>(
    (e, dir, elementRef) => {
      if (onResizeStart) onResizeStart(e, dir, elementRef);
      setIsResizing(true);
    },
    [onResizeStart],
  );

  const handleResizeStop = useCallback<ResizeCallback>(
    (event, direction, elementRef, delta) => {
      if (onResizeStop) {
        const nextWidthMultiple =
          widthMultiple + Math.round(delta.width / (widthStep + gutterWidth));
        const nextHeightMultiple =
          heightMultiple + Math.round(delta.height / heightStep);

        onResizeStop(
          event,
          direction,
          elementRef,
          {
            width: adjustableWidth ? nextWidthMultiple : 0,
            height: adjustableHeight ? nextHeightMultiple : 0,
          },
          // @ts-ignore
          id,
        );
      }
      setIsResizing(false);
    },
    [
      onResizeStop,
      widthMultiple,
      heightMultiple,
      widthStep,
      heightStep,
      gutterWidth,
      adjustableWidth,
      adjustableHeight,
      id,
    ],
  );

  const size = useMemo(
    () => ({
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
    }),
    [
      adjustableWidth,
      widthStep,
      gutterWidth,
      widthMultiple,
      staticWidthMultiple,
      staticWidth,
      adjustableHeight,
      heightStep,
      heightMultiple,
      staticHeightMultiple,
      staticHeight,
    ],
  );

  const handleComponent = useMemo(
    () => ({
      right: <RightResizeHandle />,
      bottom: <BottomResizeHandle />,
      bottomRight: <BottomRightResizeHandle />,
    }),
    [],
  );

  const enableConfig = useMemo(() => {
    if (editMode && adjustableWidth && adjustableHeight) {
      return resizableConfig.widthAndHeight;
    }
    if (editMode && adjustableWidth) {
      return resizableConfig.widthOnly;
    }
    if (editMode && adjustableHeight) {
      return resizableConfig.heightOnly;
    }
    return resizableConfig.notAdjustable;
  }, [editMode, adjustableWidth, adjustableHeight]);

  return (
    <StyledResizable
      enable={enableConfig}
      grid={SNAP_TO_GRID}
      gridGap={undefined}
      minWidth={
        adjustableWidth
          ? minWidthMultiple * (widthStep + gutterWidth) - gutterWidth
          : undefined
      }
      minHeight={adjustableHeight ? minHeightMultiple * heightStep : undefined}
      maxWidth={
        adjustableWidth && size.width
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
        adjustableHeight && size.height
          ? Math.max(
              size.height,
              Math.min(proxyToInfinity, maxHeightMultiple * heightStep),
            )
          : undefined
      }
      size={size}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      handleComponent={handleComponent}
      className={cx(
        'resizable-container',
        isResizing && 'resizable-container--resizing',
      )}
      handleClasses={HANDLE_CLASSES}
    >
      {children}
    </StyledResizable>
  );
}
