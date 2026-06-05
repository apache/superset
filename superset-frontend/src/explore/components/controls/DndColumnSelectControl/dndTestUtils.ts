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
  DroppableData,
  resolveDragEnd,
} from 'src/explore/components/ExploreContainer/ExploreDndContext';
import { DndItemType } from 'src/explore/components/DndItemType';
import { DndItemValue } from 'src/explore/components/DatasourcePanel/types';

/**
 * @dnd-kit's PointerSensor only reacts to real pointer events, which jsdom
 * cannot meaningfully dispatch (it has no layout). To exercise drop behavior in
 * unit tests we capture the `data` object a control registers via
 * `useDroppable` and feed it through the same `resolveDragEnd` dispatcher the
 * live `ExploreDndContextProvider` runs on drag end.
 *
 * Usage: spy on `useDroppable` with `captureDroppableData`, render the control,
 * then call `simulateDrop` with the dragged item.
 */
export type CapturedDroppable = { current: DroppableData | undefined };

/**
 * Returns a `jest.fn` mock implementation for `@dnd-kit/core`'s `useDroppable`
 * that records the most recently registered droppable data into `captured`,
 * while returning an inert droppable shape so the control still renders.
 */
export function captureDroppableData(captured: CapturedDroppable) {
  return (args: { data?: DroppableData }) => {
    captured.current = args?.data;
    return {
      setNodeRef: () => {},
      isOver: false,
      active: null,
      rect: { current: null },
      node: { current: null },
      over: null,
    };
  };
}

/**
 * Drives a single drag-and-drop of `item` onto the captured droppable through
 * the production `resolveDragEnd` dispatcher.
 */
export function simulateDrop(
  captured: CapturedDroppable,
  item: { type: DndItemType; value: DndItemValue },
) {
  resolveDragEnd(
    { id: 'drag-source', data: { current: item } },
    { id: 'dropzone', data: { current: captured.current ?? {} } },
  );
}

export type SortableItemData = {
  type: string;
  dragIndex: number;
  onShiftOptions?: (dragIndex: number, hoverIndex: number) => void;
  onMoveLabel?: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel?: () => void;
};

export type CapturedSortables = { items: SortableItemData[] };

/**
 * Returns a `jest.fn` implementation for `@dnd-kit/sortable`'s `useSortable`
 * that records each sortable item's registered data (carrying the reorder
 * callbacks) into `captured`, while returning an inert sortable shape so the
 * control still renders.
 */
export function captureSortableData(captured: CapturedSortables) {
  return (args: { data?: SortableItemData }) => {
    if (args?.data) {
      captured.items.push(args.data);
    }
    return {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
      setActivatorNodeRef: () => {},
    };
  };
}

/**
 * Drives an in-list reorder (drag item at `fromIndex` over item at `toIndex`)
 * through the production `resolveDragEnd` dispatcher, using the reorder
 * callbacks the control registered on its sortable items.
 */
export function simulateReorder(
  captured: CapturedSortables,
  fromIndex: number,
  toIndex: number,
) {
  const from = captured.items.find(i => i.dragIndex === fromIndex);
  const to = captured.items.find(i => i.dragIndex === toIndex);
  resolveDragEnd(
    { id: `from-${fromIndex}`, data: { current: from } },
    { id: `to-${toIndex}`, data: { current: to } },
  );
}
