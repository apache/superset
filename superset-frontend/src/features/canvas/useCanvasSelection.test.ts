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
import { act, renderHook } from '@testing-library/react';
import type { GridPlacement } from './types';
import { useCanvasSelectionState } from './useCanvasSelection';

const KPI: GridPlacement = { col: 1, row: 1, colSpan: 6, rowSpan: 4 };
const TREND: GridPlacement = { col: 1, row: 5, colSpan: 24, rowSpan: 8 };
const both = { kpi: KPI, trend: TREND };

const render = (
  editable = true,
  placements: Record<string, GridPlacement> = both,
) =>
  renderHook(props => useCanvasSelectionState(props), {
    initialProps: { editable, placements },
  });

test('a widget can be selected and let go', () => {
  const { result } = render();

  act(() => result.current.select('kpi'));
  expect(result.current.selectedId).toBe('kpi');

  act(() => result.current.select());
  expect(result.current.selectedId).toBeUndefined();
});

test('nothing is selectable unless the canvas may be edited', () => {
  // On a published canvas a selection drives nothing, and the canvas should
  // look the same for everyone looking at it.
  const { result } = render(false);

  act(() => result.current.select('kpi'));

  expect(result.current.selectedId).toBeUndefined();
});

test('editing stopping lets the selection go', () => {
  // Publishing, discarding or closing the draft: there is no longer anything
  // to be working on.
  const { result, rerender } = render();
  act(() => result.current.select('kpi'));

  rerender({ editable: false, placements: both });

  expect(result.current.selectedId).toBeUndefined();
});

test('a widget that leaves the canvas takes the selection with it', () => {
  // Undone, removed by the agent, or dropped by a poll. Holding on would
  // leave the next widget to be given that id selected by inheritance.
  const { result, rerender } = render();
  act(() => result.current.select('kpi'));

  rerender({ editable: true, placements: { trend: TREND } });

  expect(result.current.selectedId).toBeUndefined();
});

test('a widget that only moves keeps the selection', () => {
  // Dragged into a group, say: still placed, so still the thing being worked
  // on.
  const { result, rerender } = render();
  act(() => result.current.select('kpi'));

  rerender({
    editable: true,
    placements: { ...both, kpi: { ...KPI, col: 7, row: 9 } },
  });

  expect(result.current.selectedId).toBe('kpi');
});
