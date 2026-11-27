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
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

/** Narrowest and widest a user can drag a column, in pixels. */
export const MIN_RESIZE_WIDTH = 80;
export const MAX_RESIZE_WIDTH = 1600;
/** Width change per arrow key press. */
export const RESIZE_KEYBOARD_STEP = 16;

export const clampResizeWidth = (width: number) =>
  Math.round(Math.min(MAX_RESIZE_WIDTH, Math.max(MIN_RESIZE_WIDTH, width)));

export interface ColumnResizeHandleProps {
  /** The column's rendered width when the resize starts. */
  width: number;
  /** Called with the new width while dragging or on arrow keys. */
  onResize: (width: number) => void;
  /** Called on double-click or Escape to restore the automatic width. */
  onReset: () => void;
}

const Handle = styled.span`
  ${({ theme }) => `
    position: absolute;
    top: 0;
    inset-inline-end: 0;
    z-index: 1;
    width: ${theme.sizeUnit * 2}px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;

    &::after {
      content: '';
      position: absolute;
      top: 25%;
      inset-inline-end: 0;
      width: 2px;
      height: 50%;
      background: transparent;
      transition: background ${theme.motionDurationMid};
    }

    &:hover::after,
    &:focus-visible::after,
    &[data-resizing]::after {
      background: ${theme.colorPrimary};
    }

    &:focus-visible {
      outline: none;
    }
  `}
`;

/**
 * Drag handle on the trailing edge of a list view header cell. Dragging,
 * or ArrowLeft/ArrowRight while focused, sets the column width; a
 * double-click or Escape restores the automatic width.
 */
export function ColumnResizeHandle({
  width,
  onResize,
  onReset,
}: ColumnResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number; rtl: boolean }>();

  const stop = (event: MouseEvent | PointerEvent) => {
    // Keep the header's sort-on-click from firing.
    event.stopPropagation();
  };

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    target.dataset.resizing = '';
    drag.current = {
      startX: event.clientX,
      startWidth: width,
      rtl: getComputedStyle(target).direction === 'rtl',
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    // `buttons` is 0 once the button is up, e.g. if the release was missed.
    if (!drag.current || event.buttons === 0) return;
    const { startX, startWidth, rtl } = drag.current;
    const delta = (event.clientX - startX) * (rtl ? -1 : 1);
    onResize(clampResizeWidth(startWidth + delta));
  };

  const endDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    drag.current = undefined;
    delete event.currentTarget.dataset.resizing;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const reset = (target: HTMLSpanElement) => {
    // A reset during a drag ends the drag, so later moves don't undo it.
    drag.current = undefined;
    delete target.dataset.resizing;
    onReset();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const grow = rtl ? 'ArrowLeft' : 'ArrowRight';
    const shrink = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === grow || event.key === shrink) {
      event.preventDefault();
      event.stopPropagation();
      const step =
        event.key === grow ? RESIZE_KEYBOARD_STEP : -RESIZE_KEYBOARD_STEP;
      onResize(clampResizeWidth(width + step));
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      reset(event.currentTarget);
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Don't let the header cell treat the key as a sort toggle.
      event.stopPropagation();
    }
  };

  return (
    <Handle
      // A focusable separator is the ARIA pattern for a resize handle; an
      // <hr> can't be focused or carry the drag handlers.
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Resize column')}
      aria-valuenow={Math.round(width)}
      aria-valuemin={MIN_RESIZE_WIDTH}
      aria-valuemax={MAX_RESIZE_WIDTH}
      tabIndex={0}
      data-test="column-resize-handle"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onClick={stop}
      onDoubleClick={event => {
        event.stopPropagation();
        reset(event.currentTarget);
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
