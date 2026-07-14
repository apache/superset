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
import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';
import {
  ActiveDragData,
  DroppableData,
  exploreCollisionDetection,
  resolveDragEnd,
} from './ExploreDndContext';

jest.mock('@dnd-kit/core', () => {
  const actual = jest.requireActual('@dnd-kit/core');
  return {
    ...actual,
    closestCenter: jest.fn(),
    pointerWithin: jest.fn(),
    rectIntersection: jest.fn(),
  };
});

const mockClosestCenter = closestCenter as jest.Mock;
const mockPointerWithin = pointerWithin as jest.Mock;
const mockRectIntersection = rectIntersection as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const COLUMN = 'column';
const METRIC = 'metric';

const active = (data: ActiveDragData, id = 'drag-source') => ({
  id,
  data: { current: data },
});

const over = (
  data: Partial<ActiveDragData> & DroppableData,
  id = 'dropzone-target',
) => ({
  id,
  data: { current: data },
});

test('reorder fires the active item onShiftOptions callback', () => {
  const onShiftOptions = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, dragIndex: 0, onShiftOptions }, 'sortable-column-0'),
    over({ type: COLUMN, dragIndex: 2 }, 'sortable-column-2'),
  );
  expect(onShiftOptions).toHaveBeenCalledWith(0, 2);
});

test('reorder falls back to onMoveLabel when onShiftOptions is absent', () => {
  const onMoveLabel = jest.fn();
  resolveDragEnd(
    active({ type: METRIC, dragIndex: 1, onMoveLabel }, 'sortable-metric-1'),
    over({ type: METRIC, dragIndex: 0 }, 'sortable-metric-0'),
  );
  expect(onMoveLabel).toHaveBeenCalledWith(1, 0);
});

test('reorder does NOT fire onDropLabel (reorder callback commits itself)', () => {
  // onDropLabel was the react-dnd commit-on-drop hook. The reorder callback
  // (onMoveLabel/onShiftOptions) now persists the new order itself, so firing
  // onDropLabel here would re-commit the stale pre-move value captured in its
  // render-time closure — snapping the pill back. It must not be called.
  const onMoveLabel = jest.fn();
  const onDropLabel = jest.fn();
  resolveDragEnd(
    active(
      { type: METRIC, dragIndex: 1, onMoveLabel, onDropLabel },
      'sortable-metric-1',
    ),
    over({ type: METRIC, dragIndex: 0 }, 'sortable-metric-0'),
  );
  expect(onMoveLabel).toHaveBeenCalledWith(1, 0);
  expect(onDropLabel).not.toHaveBeenCalled();
});

test('reorder does not fire across mismatched types', () => {
  const onShiftOptions = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, dragIndex: 0, onShiftOptions }, 'sortable-column-0'),
    over({ type: METRIC, dragIndex: 1 }, 'sortable-metric-1'),
  );
  expect(onShiftOptions).not.toHaveBeenCalled();
});

test('external drop fires onDrop and onDropValue when accepted', () => {
  const onDrop = jest.fn();
  const onDropValue = jest.fn();
  const value = { column_name: 'a' };
  resolveDragEnd(
    active({ type: COLUMN, value }),
    over({ accept: [COLUMN], canDrop: () => true, onDrop, onDropValue }),
  );
  expect(onDrop).toHaveBeenCalledWith({ type: COLUMN, value });
  expect(onDropValue).toHaveBeenCalledWith(value);
});

test('external drop is blocked when the type is not accepted', () => {
  const onDrop = jest.fn();
  resolveDragEnd(
    active({ type: METRIC, value: { metric_name: 'm' } }),
    over({ accept: [COLUMN], canDrop: () => true, onDrop }),
  );
  expect(onDrop).not.toHaveBeenCalled();
});

test('external drop is blocked when canDrop rejects the item', () => {
  const onDrop = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, value: { column_name: 'dupe' } }),
    over({ accept: [COLUMN], canDrop: () => false, onDrop }),
  );
  expect(onDrop).not.toHaveBeenCalled();
});

test('drop with no canDrop validator defaults to accepting the item', () => {
  const onDrop = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, value: { column_name: 'a' } }),
    over({ accept: [COLUMN], onDrop }),
  );
  expect(onDrop).toHaveBeenCalled();
});

test('no-op when there is no droppable target', () => {
  expect(() =>
    resolveDragEnd(active({ type: COLUMN, value: {} }), null),
  ).not.toThrow();
});

test('no-op when dropping onto itself', () => {
  const onDrop = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, value: {} }, 'same'),
    over({ accept: [COLUMN], onDrop }, 'same'),
  );
  expect(onDrop).not.toHaveBeenCalled();
});

// --- exploreCollisionDetection ---------------------------------------------
// These lock in the @dnd-kit migration regression fix: a reorder drag must
// collide only with pills in the SAME control (its SortableContext), never the
// enclosing parent dropzone nor a same-type pill in another control; and an
// external drag from the DatasourcePanel must collide only with parent
// dropzones. jsdom cannot drive @dnd-kit pointer sensors, so we assert the
// scoping of candidate droppables rather than simulating a real drag.

type TestContainer = { id: string; data: { current: Record<string, unknown> } };

const container = (
  id: string,
  data: Record<string, unknown>,
): TestContainer => ({ id, data: { current: data } });

// A sortable pill as registered by useSortable: `sortable.containerId`
// identifies the enclosing SortableContext (i.e. the control it belongs to).
const sortable = (
  id: string,
  containerId: string,
  dragIndex: number,
  type: string,
): TestContainer =>
  container(id, { type, dragIndex, sortable: { containerId } });

const activePill = (containerId: string, dragIndex: number, type: string) => ({
  type,
  dragIndex,
  sortable: { containerId },
});

const collisionArgs = (
  activeData: Record<string, unknown> | undefined,
  containers: TestContainer[],
) =>
  ({
    active: { id: 'active', data: { current: activeData } },
    droppableContainers: containers,
    collisionRect: {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    },
    droppableRects: new Map(),
    pointerCoordinates: { x: 0, y: 0 },
  }) as unknown as Parameters<typeof exploreCollisionDetection>[0];

const idsPassedTo = (mock: jest.Mock): string[] =>
  mock.mock.calls[0][0].droppableContainers.map((c: TestContainer) => c.id);

test('reorder collisions stay within the active control SortableContext', () => {
  // Regression + finding 1: the parent dropzone must not compete, and a
  // same-type pill in a *different* control (e.g. Mixed Timeseries' two filter
  // controls, which share the unscoped `filter` type) must not be a target.
  mockClosestCenter.mockReturnValue([{ id: 'filter-a-1' }]);
  const containers = [
    sortable('filter-a-0', 'ctx-a', 0, 'filter'),
    sortable('filter-a-1', 'ctx-a', 1, 'filter'),
    sortable('filter-b-0', 'ctx-b', 0, 'filter'),
    container('dropzone-filters-a', { onDrop: jest.fn() }),
  ];

  const result = exploreCollisionDetection(
    collisionArgs(activePill('ctx-a', 0, 'filter'), containers),
  );

  expect(mockClosestCenter).toHaveBeenCalledTimes(1);
  expect(idsPassedTo(mockClosestCenter)).toEqual(['filter-a-0', 'filter-a-1']);
  expect(mockPointerWithin).not.toHaveBeenCalled();
  expect(mockRectIntersection).not.toHaveBeenCalled();
  expect(result).toEqual([{ id: 'filter-a-1' }]);
});

test('reorder with no same-context siblings returns [] and never reaches the dropzone branch', () => {
  // Finding 4a: pins the guarantee that a scoped reorder can never leak into
  // the external-drop path, even when the only other droppables are dropzones
  // or foreign pills.
  mockClosestCenter.mockReturnValue([]);
  const containers = [
    sortable('filter-b-0', 'ctx-b', 0, 'filter'),
    container('dropzone-filters-a', { onDrop: jest.fn() }),
  ];

  const result = exploreCollisionDetection(
    collisionArgs(activePill('ctx-a', 0, 'filter'), containers),
  );

  expect(mockClosestCenter).toHaveBeenCalledTimes(1);
  expect(idsPassedTo(mockClosestCenter)).toEqual([]);
  expect(mockPointerWithin).not.toHaveBeenCalled();
  expect(mockRectIntersection).not.toHaveBeenCalled();
  expect(result).toEqual([]);
});

test('external drag collisions only consider dropzones with an onDrop handler', () => {
  mockPointerWithin.mockReturnValue([{ id: 'dropzone-cols' }]);
  const containers = [
    sortable('sortable-column-0', 'ctx-cols', 0, 'column'),
    container('dropzone-cols', { onDrop: jest.fn() }),
    container('dropzone-metrics', { onDrop: jest.fn() }),
  ];

  const result = exploreCollisionDetection(
    collisionArgs({ type: 'column' }, containers),
  );

  expect(mockPointerWithin).toHaveBeenCalledTimes(1);
  expect(idsPassedTo(mockPointerWithin)).toEqual([
    'dropzone-cols',
    'dropzone-metrics',
  ]);
  expect(mockClosestCenter).not.toHaveBeenCalled();
  expect(mockRectIntersection).not.toHaveBeenCalled();
  expect(result).toEqual([{ id: 'dropzone-cols' }]);
});

test('external drag falls back to rectIntersection when the pointer is over no dropzone', () => {
  mockPointerWithin.mockReturnValue([]);
  mockRectIntersection.mockReturnValue([{ id: 'dropzone-metrics' }]);
  const containers = [
    container('dropzone-cols', { onDrop: jest.fn() }),
    container('dropzone-metrics', { onDrop: jest.fn() }),
  ];

  const result = exploreCollisionDetection(
    collisionArgs({ type: 'metric' }, containers),
  );

  expect(mockPointerWithin).toHaveBeenCalledTimes(1);
  expect(mockRectIntersection).toHaveBeenCalledTimes(1);
  expect(idsPassedTo(mockRectIntersection)).toEqual([
    'dropzone-cols',
    'dropzone-metrics',
  ]);
  expect(result).toEqual([{ id: 'dropzone-metrics' }]);
});

test('a drag with no active data routes to the external dropzone branch', () => {
  // Finding 4b: absent active data must not be mistaken for a reorder.
  mockPointerWithin.mockReturnValue([{ id: 'dropzone-cols' }]);
  const containers = [container('dropzone-cols', { onDrop: jest.fn() })];

  const result = exploreCollisionDetection(
    collisionArgs(undefined, containers),
  );

  expect(mockClosestCenter).not.toHaveBeenCalled();
  expect(mockPointerWithin).toHaveBeenCalledTimes(1);
  expect(result).toEqual([{ id: 'dropzone-cols' }]);
});
