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
  ActiveDragData,
  DroppableData,
  resolveDragEnd,
} from './ExploreDndContext';

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
  const onDropLabel = jest.fn();
  resolveDragEnd(
    active(
      { type: METRIC, dragIndex: 1, onMoveLabel, onDropLabel },
      'sortable-metric-1',
    ),
    over({ type: METRIC, dragIndex: 0 }, 'sortable-metric-0'),
  );
  expect(onMoveLabel).toHaveBeenCalledWith(1, 0);
  expect(onDropLabel).toHaveBeenCalled();
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
  const onDrop = jest.fn();
  expect(() =>
    resolveDragEnd(active({ type: COLUMN, value: {}, onDrop }), null),
  ).not.toThrow();
});

test('no-op when dropping onto itself', () => {
  const onDrop = jest.fn();
  resolveDragEnd(
    active({ type: COLUMN, value: {}, onDrop }, 'same'),
    over({ accept: [COLUMN], onDrop }, 'same'),
  );
  expect(onDrop).not.toHaveBeenCalled();
});
