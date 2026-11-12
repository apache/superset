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

import { renderHook, waitFor } from '@testing-library/react';
import { useReflow } from './useReflow';
import type { GridPlacement } from './types';

const PITCH = { col: 40, row: 56 };

const at = (col: number, row: number): GridPlacement => ({
  col,
  row,
  colSpan: 6,
  rowSpan: 2,
});

const reflowOf = (first: Record<string, GridPlacement>, held?: string) => {
  const { result, rerender } = renderHook(
    ({ placements }: { placements: Record<string, GridPlacement> }) =>
      useReflow(placements, PITCH, held),
    { initialProps: { placements: first } },
  );
  return { result, rerender };
};

test('a canvas does not play its own arrival', () => {
  // Nothing to have moved from on the first render.
  const { result } = reflowOf({ a: at(1, 1) });

  expect(result.current).toEqual({});
});

test('a widget that gave way starts where it was', () => {
  // The cells it holds are already the new ones; this is only what it has to
  // look like it has yet to travel, so releasing it reads as the move.
  const { result, rerender } = reflowOf({ a: at(1, 1) });

  rerender({ placements: { a: at(3, 4) } });

  // Two columns and three rows back the way it came.
  expect(result.current).toEqual({ a: { x: -80, y: -168 } });
});

test('and is let go of on the next frame', async () => {
  const { result, rerender } = reflowOf({ a: at(1, 1) });

  rerender({ placements: { a: at(3, 1) } });
  expect(result.current.a).toBeDefined();

  await waitFor(() => expect(result.current).toEqual({}));
});

test('a widget that stayed put is not offered an animation', () => {
  // Its span changed, not its place. Nothing has travelled, so nothing slides.
  const { result, rerender } = reflowOf({ a: at(1, 1) });

  rerender({ placements: { a: { ...at(1, 1), colSpan: 12 } } });

  expect(result.current).toEqual({});
});

test('the widget being dragged is left out of it', () => {
  // It already carries a transform to follow the pointer. A second one would
  // have it lag the hand by a cell -- and the hand is the one thing on screen
  // that cannot be allowed to lie.
  const { result, rerender } = reflowOf({ a: at(1, 1), b: at(1, 5) }, 'a');

  rerender({ placements: { a: at(5, 1), b: at(5, 5) } });

  expect(result.current.a).toBeUndefined();
  expect(result.current.b).toEqual({ x: -160, y: 0 });
});

test('a widget that has only just appeared slides from nowhere', () => {
  // Nothing to measure against, so it is simply there -- a widget arriving
  // from another grid should not fly in from the corner it never occupied.
  const { result, rerender } = reflowOf({ a: at(1, 1) });

  rerender({ placements: { a: at(1, 1), fresh: at(7, 1) } });

  expect(result.current).toEqual({});
});

test('nobody is moved around who asked not to be', () => {
  const matchMedia = jest
    .spyOn(window, 'matchMedia')
    .mockReturnValue({ matches: true } as MediaQueryList);
  const { result, rerender } = reflowOf({ a: at(1, 1) });

  rerender({ placements: { a: at(3, 4) } });

  expect(result.current).toEqual({});
  expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  matchMedia.mockRestore();
});
