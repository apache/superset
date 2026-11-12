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

/**
 * @fileoverview Letting widgets slide to where the grid has just put them.
 *
 * A drag reflows the grid under the pointer: neighbours give way, and when
 * the pointer moves back they return. Written straight to the grid they jump,
 * and a row of tiles rearranging itself in one frame is hard to read as the
 * consequence of what the hand is doing.
 *
 * The move is already done by the time this runs -- the widget holds its new
 * cells, so every measurement, every hit test and every geometry test still
 * sees the truth. What this adds is the *appearance* of not having moved yet:
 * the widget is offset back to where it was, and that offset is released on
 * the next frame, so it travels to a place it is already in.
 *
 * `transform` and nothing else. Animating `grid-row` or `grid-column` is not
 * possible -- they do not interpolate -- and animating width or top would lay
 * the page out again on every frame, which is also the thing that feeds the
 * preview, the scroll clamp and the drag's own travel measurement. A transform
 * changes no layout at all, so none of that can be disturbed.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type { GridPlacement } from './types';

/** How far a widget has yet to appear to travel, in pixels. */
export interface Reflow {
  x: number;
  y: number;
}

/** Pixels from one column to the next, and from one row to the next. */
export interface Pitch {
  col: number;
  row: number;
}

/**
 * Whether the viewer has asked not to be moved around.
 *
 * Read each time rather than cached: the setting can change while the page is
 * open, and a drag is exactly when someone who finds motion unpleasant would
 * go and turn it off.
 */
const stillnessWanted = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The offset each widget should start this frame at, to appear to slide to
 * where it has already been put.
 *
 * `held` is the widget being dragged, which is left out: it already carries a
 * transform of its own to follow the pointer, and two of them on one element
 * would fight -- the dragged widget would lag its own hand by a cell.
 *
 * Returns an empty map whenever nothing moved, so a grid at rest and a
 * gesture that changes nothing both cost nothing and animate nothing.
 */
export function useReflow(
  placements: Record<string, GridPlacement>,
  pitch: Pitch,
  held?: string,
): Record<string, Reflow> {
  const previous = useRef<Record<string, GridPlacement>>({});
  const [offsets, setOffsets] = useState<Record<string, Reflow>>({});

  useLayoutEffect(() => {
    const was = previous.current;
    previous.current = placements;
    if (stillnessWanted()) return undefined;

    const moved: Record<string, Reflow> = {};
    Object.entries(placements).forEach(([nodeId, rect]) => {
      const before = was[nodeId];
      // Nothing to have come from, which covers both the first render and a
      // widget that has only just arrived: neither should fly in from a
      // corner it never occupied.
      if (!before || nodeId === held) return;
      if (before.col === rect.col && before.row === rect.row) return;
      moved[nodeId] = {
        x: (before.col - rect.col) * pitch.col,
        y: (before.row - rect.row) * pitch.row,
      };
    });
    if (Object.keys(moved).length === 0) return undefined;

    setOffsets(moved);
    // Released on the next frame, which is what makes it a transition rather
    // than a jump: the browser has to paint the offset once before the value
    // it transitions to can mean anything.
    const frame = requestAnimationFrame(() => setOffsets({}));
    return () => cancelAnimationFrame(frame);
  }, [placements, pitch.col, pitch.row, held]);

  return offsets;
}
