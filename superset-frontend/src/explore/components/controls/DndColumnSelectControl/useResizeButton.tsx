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
  useCallback,
  useEffect,
  useState,
  MouseEvent as ReactMouseEvent,
} from 'react';

import { throttle } from 'lodash';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';

const RESIZE_THROTTLE_MS = 50;

export default function useResizeButton(
  minWidth: number,
  minHeight: number,
): [JSX.Element, number, number] {
  const [width, setWidth] = useState(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState(POPOVER_INITIAL_HEIGHT);
  const [clientX, setClientX] = useState(0);
  const [clientY, setClientY] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(width);
  const [dragStartHeight, setDragStartHeight] = useState(height);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseMove = useCallback((ev: MouseEvent): void => {
    ev.preventDefault();
    setClientX(ev.clientX);
    setClientY(ev.clientY);
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDragDown = useCallback((ev: ReactMouseEvent): void => {
    setDragStartX(ev.clientX);
    setDragStartY(ev.clientY);
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
    } else {
      setDragStartWidth(width);
      setDragStartHeight(height);
      document.removeEventListener('mousemove', onMouseMove);
    }
  }, [onMouseMove, isDragging]);

  const handleResize = useCallback(
    throttle(
      ({
        dragStartX,
        dragStartY,
        dragStartWidth,
        dragStartHeight,
        clientX,
        clientY,
        minWidth,
        minHeight,
      }: {
        dragStartX: number;
        dragStartY: number;
        dragStartWidth: number;
        dragStartHeight: number;
        clientX: number;
        clientY: number;
        minWidth: number;
        minHeight: number;
      }): void => {
        setWidth(Math.max(dragStartWidth + (clientX - dragStartX), minWidth));
        setHeight(
          Math.max(dragStartHeight + (clientY - dragStartY), minHeight),
        );
      },
      RESIZE_THROTTLE_MS,
    ),
    [setHeight, setWidth],
  );

  useEffect(() => {
    if (isDragging) {
      handleResize({
        dragStartX,
        dragStartY,
        dragStartWidth,
        dragStartHeight,
        clientX,
        clientY,
        minWidth,
        minHeight,
      });
    }
  }, [
    isDragging,
    clientX,
    clientY,
    dragStartWidth,
    dragStartHeight,
    dragStartX,
    dragStartY,
  ]);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseUp]);

  return [
    <i
      role="button"
      aria-label="Resize"
      tabIndex={0}
      onMouseDown={onDragDown}
      className="fa fa-expand edit-popover-resize text-muted"
    />,
    width,
    height,
  ];
}
