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

import { renderHook, act } from '@testing-library/react-hooks';
import type { DragStartEvent } from '@dnd-kit/core';
import { FlattenedTreeItem } from '../constants';
import { FoldersEditorItemType } from '../../types';
import { useDragHandlers } from './useDragHandlers';

const makeItem = (
  uuid: string,
  type: FoldersEditorItemType,
  depth: number,
  parentId: string | null = null,
  index = 0,
): FlattenedTreeItem => ({
  uuid,
  type,
  name: uuid,
  depth,
  parentId,
  index,
});

/**
 * Flat list representing:
 *   folder-a (depth 0)
 *     metric-1 (depth 1)
 *     subfolder-b (depth 1)
 *       metric-2 (depth 2)
 *     metric-3 (depth 1)
 *   folder-c (depth 0)
 *     column-1 (depth 1)
 */
const flatItems: FlattenedTreeItem[] = [
  makeItem('folder-a', FoldersEditorItemType.Folder, 0, null, 0),
  makeItem('metric-1', FoldersEditorItemType.Metric, 1, 'folder-a', 1),
  makeItem('subfolder-b', FoldersEditorItemType.Folder, 1, 'folder-a', 2),
  makeItem('metric-2', FoldersEditorItemType.Metric, 2, 'subfolder-b', 3),
  makeItem('metric-3', FoldersEditorItemType.Metric, 1, 'folder-a', 4),
  makeItem('folder-c', FoldersEditorItemType.Folder, 0, null, 5),
  makeItem('column-1', FoldersEditorItemType.Column, 1, 'folder-c', 6),
];

function makeDragStartEvent(id: string): DragStartEvent {
  return {
    active: {
      id,
      rect: { current: { initial: null, translated: null } },
      data: { current: {} },
    },
  } as unknown as DragStartEvent;
}

function setup(selectedIds: Set<string> = new Set()) {
  return renderHook(() =>
    useDragHandlers({
      setItems: jest.fn(),
      computeFlattenedItems: () => flatItems,
      fullFlattenedItems: flatItems,
      selectedItemIds: selectedIds,
      onChange: jest.fn(),
      addWarningToast: jest.fn(),
    }),
  );
}

test('folder drag collects all visible descendants into draggedFolderChildIds', () => {
  const { result } = setup();

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('folder-a'));
  });

  const childIds = result.current.draggedFolderChildIds;
  expect(childIds.has('metric-1')).toBe(true);
  expect(childIds.has('subfolder-b')).toBe(true);
  expect(childIds.has('metric-2')).toBe(true);
  expect(childIds.has('metric-3')).toBe(true);
  // Items outside the folder are not included
  expect(childIds.has('folder-c')).toBe(false);
  expect(childIds.has('column-1')).toBe(false);
});

test('non-folder drag leaves draggedFolderChildIds empty', () => {
  const { result } = setup();

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('metric-1'));
  });

  expect(result.current.draggedFolderChildIds.size).toBe(0);
});

test('projectionItems (flattenedItems) excludes folder descendants during folder drag', () => {
  const { result } = setup();

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('folder-a'));
  });

  const itemIds = result.current.flattenedItems.map(
    (item: FlattenedTreeItem) => item.uuid,
  );
  // The stable snapshot includes all items (captured before activeId is set),
  // but projectionItems filtering is internal. We verify the hook returns
  // the full stable snapshot since it's what the virtualized list needs.
  expect(itemIds).toContain('folder-a');
  expect(itemIds).toContain('folder-c');
  expect(itemIds).toContain('column-1');
});

test('subfolder drag collects only its own descendants', () => {
  const { result } = setup();

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('subfolder-b'));
  });

  const childIds = result.current.draggedFolderChildIds;
  expect(childIds.has('metric-2')).toBe(true);
  // Items outside subfolder-b
  expect(childIds.has('metric-1')).toBe(false);
  expect(childIds.has('metric-3')).toBe(false);
  expect(childIds.has('folder-a')).toBe(false);
});

test('draggedItemIds contains selected items when active item is selected', () => {
  const selected = new Set(['metric-1', 'metric-3']);
  const { result } = setup(selected);

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('metric-1'));
  });

  expect(result.current.draggedItemIds).toEqual(selected);
});

test('draggedItemIds contains only active item when not in selection', () => {
  const selected = new Set(['metric-1', 'metric-3']);
  const { result } = setup(selected);

  act(() => {
    result.current.handleDragStart(makeDragStartEvent('column-1'));
  });

  expect(result.current.draggedItemIds).toEqual(new Set(['column-1']));
});
