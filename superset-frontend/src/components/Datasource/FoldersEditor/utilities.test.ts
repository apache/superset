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
  flattenTree,
  buildTree,
  findItemDeep,
  removeChildrenOf,
  getChildCount,
  serializeForAPI,
  getDescendantIds,
  canAcceptDrop,
  canNestFolder,
  getProjection,
  TreeItem,
  FlattenedTreeItem,
  DRAG_INDENTATION_WIDTH,
} from './utilities';
import { FoldersEditorItemType } from '../types';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from './folderUtils';

const createMetricItem = (uuid: string, name: string): TreeItem => ({
  uuid,
  type: FoldersEditorItemType.Metric,
  name,
});

const createColumnItem = (uuid: string, name: string): TreeItem => ({
  uuid,
  type: FoldersEditorItemType.Column,
  name,
});

const createFolderItem = (
  uuid: string,
  name: string,
  children: TreeItem[] = [],
): TreeItem => ({
  uuid,
  type: FoldersEditorItemType.Folder,
  name,
  children,
});

test('flattenTree converts nested tree to flat array', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
      createMetricItem('metric2', 'Metric 2'),
    ]),
    createFolderItem('folder2', 'Folder 2', [
      createColumnItem('column1', 'Column 1'),
    ]),
  ];

  const flattened = flattenTree(tree);

  expect(flattened).toHaveLength(5);
  expect(flattened[0].uuid).toBe('folder1');
  expect(flattened[0].depth).toBe(0);
  expect(flattened[0].parentId).toBeNull();
  expect(flattened[1].uuid).toBe('metric1');
  expect(flattened[1].depth).toBe(1);
  expect(flattened[1].parentId).toBe('folder1');
  expect(flattened[2].uuid).toBe('metric2');
  expect(flattened[2].depth).toBe(1);
  expect(flattened[3].uuid).toBe('folder2');
  expect(flattened[3].depth).toBe(0);
  expect(flattened[4].uuid).toBe('column1');
  expect(flattened[4].depth).toBe(1);
  expect(flattened[4].parentId).toBe('folder2');
});

test('flattenTree handles nested folders', () => {
  const tree: TreeItem[] = [
    createFolderItem('parent', 'Parent', [
      createFolderItem('child', 'Child', [
        createMetricItem('metric1', 'Metric 1'),
      ]),
    ]),
  ];

  const flattened = flattenTree(tree);

  expect(flattened).toHaveLength(3);
  expect(flattened[0].depth).toBe(0);
  expect(flattened[1].depth).toBe(1);
  expect(flattened[1].parentId).toBe('parent');
  expect(flattened[2].depth).toBe(2);
  expect(flattened[2].parentId).toBe('child');
});

test('flattenTree handles empty tree', () => {
  const flattened = flattenTree([]);
  expect(flattened).toHaveLength(0);
});

test('buildTree reconstructs tree from flattened items', () => {
  const flatItems: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'folder1',
      depth: 1,
      index: 0,
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 2',
      parentId: null,
      depth: 0,
      index: 1,
      children: [],
    },
  ];

  const tree = buildTree(flatItems);

  expect(tree).toHaveLength(2);
  expect(tree[0].uuid).toBe('folder1');
  expect((tree[0] as any).children).toHaveLength(1);
  expect((tree[0] as any).children[0].uuid).toBe('metric1');
  expect(tree[1].uuid).toBe('folder2');
});

test('buildTree handles orphan items by placing them at root', () => {
  const flatItems: FlattenedTreeItem[] = [
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'nonexistent-parent',
      depth: 1,
      index: 0,
    },
  ];

  const tree = buildTree(flatItems);

  expect(tree).toHaveLength(1);
  expect(tree[0].uuid).toBe('metric1');
});

test('findItemDeep finds item at root level', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', []),
    createFolderItem('folder2', 'Folder 2', []),
  ];

  const found = findItemDeep(tree, 'folder2');

  expect(found).toBeDefined();
  expect(found?.uuid).toBe('folder2');
});

test('findItemDeep finds deeply nested item', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createFolderItem('folder2', 'Folder 2', [
        createMetricItem('metric1', 'Metric 1'),
      ]),
    ]),
  ];

  const found = findItemDeep(tree, 'metric1');

  expect(found).toBeDefined();
  expect(found?.uuid).toBe('metric1');
});

test('findItemDeep returns undefined for non-existent item', () => {
  const tree: TreeItem[] = [createFolderItem('folder1', 'Folder 1', [])];

  const found = findItemDeep(tree, 'nonexistent');

  expect(found).toBeUndefined();
});

test('removeChildrenOf filters out children of specified parents', () => {
  const items: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
      children: [
        { uuid: 'metric1', type: FoldersEditorItemType.Metric, name: 'M' },
      ],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'folder1',
      depth: 1,
      index: 0,
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 2',
      parentId: null,
      depth: 0,
      index: 1,
      children: [],
    },
  ];

  const filtered = removeChildrenOf(items, ['folder1']);

  expect(filtered).toHaveLength(2);
  expect(filtered.find(i => i.uuid === 'metric1')).toBeUndefined();
});

test('removeChildrenOf recursively removes nested children when parent has children property', () => {
  // Note: removeChildrenOf only recurses into children that are excluded AND have children property set
  const items: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
      children: [
        { uuid: 'folder2', type: FoldersEditorItemType.Folder, name: 'F2' },
      ],
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 2',
      parentId: 'folder1',
      depth: 1,
      index: 0,
      children: [
        { uuid: 'metric1', type: FoldersEditorItemType.Metric, name: 'M' },
      ],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'folder2',
      depth: 2,
      index: 0,
    },
  ];

  const filtered = removeChildrenOf(items, ['folder1']);

  expect(filtered).toHaveLength(1);
  expect(filtered[0].uuid).toBe('folder1');
});

test('getChildCount returns correct count for folder', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
      createMetricItem('metric2', 'Metric 2'),
      createMetricItem('metric3', 'Metric 3'),
    ]),
  ];

  const count = getChildCount(tree, 'folder1');

  expect(count).toBe(3);
});

test('getChildCount includes nested children', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createFolderItem('folder2', 'Folder 2', [
        createMetricItem('metric1', 'Metric 1'),
        createMetricItem('metric2', 'Metric 2'),
      ]),
    ]),
  ];

  const count = getChildCount(tree, 'folder1');

  // folder2 + metric1 + metric2 = 3
  expect(count).toBe(3);
});

test('getChildCount returns 0 for non-folder items', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
    ]),
  ];

  const count = getChildCount(tree, 'metric1');

  expect(count).toBe(0);
});

test('getChildCount returns 0 for non-existent items', () => {
  const tree: TreeItem[] = [createFolderItem('folder1', 'Folder 1', [])];

  const count = getChildCount(tree, 'nonexistent');

  expect(count).toBe(0);
});

test('serializeForAPI excludes empty folders', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', []),
    createFolderItem('folder2', 'Folder 2', [
      createMetricItem('metric1', 'Metric 1'),
    ]),
  ];

  const serialized = serializeForAPI(tree);

  expect(serialized).toHaveLength(1);
  expect(serialized[0].uuid).toBe('folder2');
});

test('serializeForAPI includes only uuid and type for leaf items', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
    ]),
  ];

  const serialized = serializeForAPI(tree);

  expect(serialized[0].children).toHaveLength(1);
  expect(serialized[0].children![0]).toEqual({
    uuid: 'metric1',
    type: FoldersEditorItemType.Metric,
  });
});

test('serializeForAPI preserves nested folder structure', () => {
  const tree: TreeItem[] = [
    createFolderItem('parent', 'Parent', [
      createFolderItem('child', 'Child', [
        createMetricItem('metric1', 'Metric 1'),
      ]),
    ]),
  ];

  const serialized = serializeForAPI(tree);

  expect(serialized).toHaveLength(1);
  expect(serialized[0].uuid).toBe('parent');
  expect(serialized[0].children).toHaveLength(1);
  expect((serialized[0].children![0] as any).uuid).toBe('child');
  expect((serialized[0].children![0] as any).children).toHaveLength(1);
});

test('serializeForAPI excludes nested empty folders', () => {
  const tree: TreeItem[] = [
    createFolderItem('parent', 'Parent', [
      createFolderItem('emptyChild', 'Empty Child', []),
      createMetricItem('metric1', 'Metric 1'),
    ]),
  ];

  const serialized = serializeForAPI(tree);

  expect(serialized).toHaveLength(1);
  expect(serialized[0].children).toHaveLength(1);
  expect(serialized[0].children![0]).toEqual({
    uuid: 'metric1',
    type: FoldersEditorItemType.Metric,
  });
});

test('getDescendantIds returns all descendants of a folder', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
      createFolderItem('folder2', 'Folder 2', [
        createColumnItem('column1', 'Column 1'),
      ]),
    ]),
  ];

  const descendants = getDescendantIds(tree, 'folder1');

  expect(descendants).toContain('metric1');
  expect(descendants).toContain('folder2');
  expect(descendants).toContain('column1');
  expect(descendants).toHaveLength(3);
});

test('getDescendantIds returns empty array for non-folder items', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', [
      createMetricItem('metric1', 'Metric 1'),
    ]),
  ];

  const descendants = getDescendantIds(tree, 'metric1');

  expect(descendants).toHaveLength(0);
});

test('getDescendantIds returns empty array for non-existent items', () => {
  const tree: TreeItem[] = [createFolderItem('folder1', 'Folder 1', [])];

  const descendants = getDescendantIds(tree, 'nonexistent');

  expect(descendants).toHaveLength(0);
});

test('canAcceptDrop allows metrics in default Metrics folder', () => {
  const targetFolder: FlattenedTreeItem = {
    uuid: DEFAULT_METRICS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Metrics',
    parentId: null,
    depth: 0,
    index: 0,
  };
  const draggedItems: FlattenedTreeItem[] = [
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: null,
      depth: 1,
      index: 0,
    },
  ];

  expect(canAcceptDrop(targetFolder, draggedItems)).toBe(true);
});

test('canAcceptDrop rejects columns in default Metrics folder', () => {
  const targetFolder: FlattenedTreeItem = {
    uuid: DEFAULT_METRICS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Metrics',
    parentId: null,
    depth: 0,
    index: 0,
  };
  const draggedItems: FlattenedTreeItem[] = [
    {
      uuid: 'column1',
      type: FoldersEditorItemType.Column,
      name: 'Column 1',
      parentId: null,
      depth: 1,
      index: 0,
    },
  ];

  expect(canAcceptDrop(targetFolder, draggedItems)).toBe(false);
});

test('canAcceptDrop allows columns in default Columns folder', () => {
  const targetFolder: FlattenedTreeItem = {
    uuid: DEFAULT_COLUMNS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Columns',
    parentId: null,
    depth: 0,
    index: 0,
  };
  const draggedItems: FlattenedTreeItem[] = [
    {
      uuid: 'column1',
      type: FoldersEditorItemType.Column,
      name: 'Column 1',
      parentId: null,
      depth: 1,
      index: 0,
    },
  ];

  expect(canAcceptDrop(targetFolder, draggedItems)).toBe(true);
});

test('canAcceptDrop rejects metrics in default Columns folder', () => {
  const targetFolder: FlattenedTreeItem = {
    uuid: DEFAULT_COLUMNS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Columns',
    parentId: null,
    depth: 0,
    index: 0,
  };
  const draggedItems: FlattenedTreeItem[] = [
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: null,
      depth: 1,
      index: 0,
    },
  ];

  expect(canAcceptDrop(targetFolder, draggedItems)).toBe(false);
});

test('canAcceptDrop allows any items in custom folders', () => {
  const targetFolder: FlattenedTreeItem = {
    uuid: 'custom-folder',
    type: FoldersEditorItemType.Folder,
    name: 'Custom Folder',
    parentId: null,
    depth: 0,
    index: 0,
  };
  const draggedItems: FlattenedTreeItem[] = [
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: null,
      depth: 1,
      index: 0,
    },
    {
      uuid: 'column1',
      type: FoldersEditorItemType.Column,
      name: 'Column 1',
      parentId: null,
      depth: 1,
      index: 1,
    },
  ];

  expect(canAcceptDrop(targetFolder, draggedItems)).toBe(true);
});

test('canNestFolder prevents folder from being nested inside itself', () => {
  const tree: TreeItem[] = [createFolderItem('folder1', 'Folder 1', [])];

  expect(canNestFolder(tree, 'folder1', 'folder1')).toBe(false);
});

test('canNestFolder prevents folder from being nested inside its descendants', () => {
  const tree: TreeItem[] = [
    createFolderItem('parent', 'Parent', [
      createFolderItem('child', 'Child', [
        createFolderItem('grandchild', 'Grandchild', []),
      ]),
    ]),
  ];

  expect(canNestFolder(tree, 'parent', 'child')).toBe(false);
  expect(canNestFolder(tree, 'parent', 'grandchild')).toBe(false);
});

test('canNestFolder allows valid nesting', () => {
  const tree: TreeItem[] = [
    createFolderItem('folder1', 'Folder 1', []),
    createFolderItem('folder2', 'Folder 2', []),
  ];

  expect(canNestFolder(tree, 'folder1', 'folder2')).toBe(true);
  expect(canNestFolder(tree, 'folder2', 'folder1')).toBe(true);
});

test('getProjection calculates correct depth when dragging down', () => {
  const items: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'folder1',
      depth: 1,
      index: 0,
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 2',
      parentId: null,
      depth: 0,
      index: 1,
      children: [],
    },
  ];

  // Drag metric1 to folder2 position with no horizontal offset
  const projection = getProjection(items, 'metric1', 'folder2', 0);

  expect(projection).not.toBeNull();
  expect(projection!.depth).toBeGreaterThanOrEqual(1); // Metrics need to be in a folder
});

test('getProjection returns null for invalid drag', () => {
  const items: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
    },
  ];

  const projection = getProjection(items, 'nonexistent', 'folder1', 0);

  expect(projection).toBeNull();
});

test('getProjection nests item under folder when dragging down with offset', () => {
  const items: FlattenedTreeItem[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 1',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'folder1',
      depth: 1,
      index: 0,
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Folder 2',
      parentId: null,
      depth: 0,
      index: 1,
      children: [],
    },
  ];

  // Drag folder2 down over metric1's position with horizontal offset to nest under folder1
  // When dragging down (activeIndex > overIndex), after move: previousItem = items[overIndex] = metric1
  // metric1 is at depth 1 and is not a folder, so maxDepth = metric1.depth = 1
  const projection = getProjection(
    items,
    'folder2',
    'metric1',
    DRAG_INDENTATION_WIDTH, // Move right by indentation width
  );

  expect(projection).not.toBeNull();
  // folder2 starts at depth 0, drag offset adds 1, so projected = 1
  // maxDepth from metric1 (non-folder) = metric1.depth = 1
  expect(projection!.depth).toBe(1);
  expect(projection!.parentId).toBe('folder1');
});
