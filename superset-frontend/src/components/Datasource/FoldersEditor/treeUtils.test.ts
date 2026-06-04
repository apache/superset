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
  TreeItem,
  FlattenedTreeItem,
  DRAG_INDENTATION_WIDTH,
} from './constants';
import {
  flattenTree,
  buildTree,
  removeChildrenOf,
  serializeForAPI,
  getProjection,
  countAllFolders,
  filterFoldersByValidUuids,
} from './treeUtils';
import { FoldersEditorItemType } from '../types';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';

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

test('buildTree preserves order when moving nested folder with children to root', () => {
  // This tests the scenario where a nested folder with children is dragged
  // horizontally to become a root-level folder
  // Initial structure: FolderA > NestedFolder > Metric1
  // After drag: NestedFolder (root) > Metric1, FolderA (root)
  const flatItems: FlattenedTreeItem[] = [
    {
      uuid: 'folderA',
      type: FoldersEditorItemType.Folder,
      name: 'Folder A',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'nestedFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Nested Folder',
      parentId: null, // Was 'folderA', now moved to root
      depth: 0, // Was 1, now 0
      index: 1,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'nestedFolder', // Still points to nestedFolder
      depth: 1, // Was 2, now 1
      index: 0,
    },
  ];

  const tree = buildTree(flatItems);

  // Both folders should be at root level
  expect(tree).toHaveLength(2);
  expect(tree[0].uuid).toBe('folderA');
  expect(tree[1].uuid).toBe('nestedFolder');

  // nestedFolder should still have metric1 as its child
  const nestedFolder = tree[1] as { children?: TreeItem[] };
  expect(nestedFolder.children).toBeDefined();
  expect(nestedFolder.children).toHaveLength(1);
  expect(nestedFolder.children![0].uuid).toBe('metric1');
});

test('buildTree handles reordered array correctly after drag', () => {
  // Simulates the exact scenario of dragging NestedFolder out of ParentFolder
  // This is the array AFTER handleDragEnd reorders it (before buildTree sorts by depth)
  //
  // Original: ParentFolder > NestedFolder > Metric1
  // After horizontal drag left: NestedFolder becomes sibling of ParentFolder
  //
  // The reordered array from handleDragEnd puts subtree at new position:
  // [ParentFolder, NestedFolder, Metric1] where NestedFolder is now at depth 0
  const flatItems: FlattenedTreeItem[] = [
    {
      uuid: 'parentFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Parent Folder',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'nestedFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Nested Folder',
      parentId: null, // Changed from 'parentFolder' to null (moved to root)
      depth: 0, // Changed from 1 to 0 (moved to root)
      index: 1,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'nestedFolder', // Still nestedFolder (unchanged)
      depth: 1, // Changed from 2 to 1 (parent moved up)
      index: 0,
    },
  ];

  const tree = buildTree(flatItems);

  // Verify structure
  expect(tree).toHaveLength(2);

  // Find nestedFolder in tree
  const nestedFolder = tree.find(
    item => item.uuid === 'nestedFolder',
  ) as TreeItem & { children: TreeItem[] };
  expect(nestedFolder).toBeDefined();
  expect(nestedFolder.children).toHaveLength(1);
  expect(nestedFolder.children[0].uuid).toBe('metric1');

  // ParentFolder should be empty now
  const parentFolder = tree.find(
    item => item.uuid === 'parentFolder',
  ) as TreeItem & { children: TreeItem[] };
  expect(parentFolder).toBeDefined();
  expect(parentFolder.children).toHaveLength(0);
});

test('getProjection calculates correct depth when dragging folder horizontally with children excluded', () => {
  // When dragging a folder horizontally, its children should be excluded from the
  // items array to avoid incorrect minDepth calculation.
  // This tests that with children excluded, dragging left allows moving to root.
  const itemsWithoutChildren: FlattenedTreeItem[] = [
    {
      uuid: 'parentFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Parent Folder',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'nestedFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Nested Folder',
      parentId: 'parentFolder',
      depth: 1,
      index: 1,
      children: [],
    },
    // Note: metric1 (child of nestedFolder) is excluded, simulating the drag state
  ];

  // Drag nestedFolder horizontally left (negative offset)
  const projection = getProjection(
    itemsWithoutChildren,
    'nestedFolder',
    'nestedFolder',
    -DRAG_INDENTATION_WIDTH, // Drag left by one indentation
  );

  expect(projection).not.toBeNull();
  // With children excluded and dragging left, folder should move to depth 0
  expect(projection!.depth).toBe(0);
  expect(projection!.parentId).toBeNull();
});

test('getProjection incorrectly clamps depth when children are included', () => {
  // This test documents why children must be excluded during projection:
  // If children are included, minDepth is calculated from the child's depth,
  // which prevents the folder from moving to a shallower depth.
  const itemsWithChildren: FlattenedTreeItem[] = [
    {
      uuid: 'parentFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Parent Folder',
      parentId: null,
      depth: 0,
      index: 0,
      children: [],
    },
    {
      uuid: 'nestedFolder',
      type: FoldersEditorItemType.Folder,
      name: 'Nested Folder',
      parentId: 'parentFolder',
      depth: 1,
      index: 1,
      children: [],
    },
    {
      uuid: 'metric1',
      type: FoldersEditorItemType.Metric,
      name: 'Metric 1',
      parentId: 'nestedFolder',
      depth: 2,
      index: 2,
    },
  ];

  // Drag nestedFolder horizontally left (negative offset)
  const projection = getProjection(
    itemsWithChildren,
    'nestedFolder',
    'nestedFolder',
    -DRAG_INDENTATION_WIDTH, // Drag left by one indentation
  );

  expect(projection).not.toBeNull();
  // With children included, minDepth is metric1.depth = 2
  // So depth gets clamped to 2, which is incorrect behavior!
  // This is why handleDragEnd should use flattenedItems (children excluded)
  expect(projection!.depth).toBe(2);
  expect(projection!.parentId).toBe('parentFolder');
});

test('flattenTree and buildTree roundtrip preserves nested folder structure', () => {
  // Test that flatten -> modify parentId/depth -> buildTree preserves children
  const originalTree: TreeItem[] = [
    createFolderItem('parentFolder', 'Parent Folder', [
      createFolderItem('nestedFolder', 'Nested Folder', [
        createMetricItem('metric1', 'Metric 1'),
      ]),
    ]),
  ];

  // Flatten the tree
  const flattened = flattenTree(originalTree);

  // Verify flattened structure
  expect(flattened).toHaveLength(3);
  expect(flattened[0]).toMatchObject({
    uuid: 'parentFolder',
    depth: 0,
    parentId: null,
  });
  expect(flattened[1]).toMatchObject({
    uuid: 'nestedFolder',
    depth: 1,
    parentId: 'parentFolder',
  });
  expect(flattened[2]).toMatchObject({
    uuid: 'metric1',
    depth: 2,
    parentId: 'nestedFolder',
  });

  // Simulate moving nestedFolder to root level (horizontal drag left)
  const modifiedFlattened = flattened.map(item => {
    if (item.uuid === 'nestedFolder') {
      return { ...item, depth: 0, parentId: null };
    }
    if (item.uuid === 'metric1') {
      return { ...item, depth: 1 }; // Depth decreases by 1, parentId stays same
    }
    return item;
  });

  // Rebuild tree
  const rebuiltTree = buildTree(modifiedFlattened);

  // Verify rebuilt structure
  expect(rebuiltTree).toHaveLength(2);

  const parentFolder = rebuiltTree.find(
    i => i.uuid === 'parentFolder',
  ) as TreeItem & { children: TreeItem[] };
  const nestedFolder = rebuiltTree.find(
    i => i.uuid === 'nestedFolder',
  ) as TreeItem & { children: TreeItem[] };

  expect(parentFolder).toBeDefined();
  expect(nestedFolder).toBeDefined();
  expect(parentFolder.children).toHaveLength(0); // nestedFolder moved out
  expect(nestedFolder.children).toHaveLength(1); // metric1 still in nestedFolder
  expect(nestedFolder.children[0].uuid).toBe('metric1');
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

test('countAllFolders returns 0 for empty array', () => {
  expect(countAllFolders([])).toBe(0);
});

test('countAllFolders counts flat folders', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Metrics', [createMetricItem('m1', 'Metric 1')]),
    createFolderItem('f2', 'Columns', [createColumnItem('c1', 'Column 1')]),
  ] as DatasourceFolder[];

  expect(countAllFolders(folders)).toBe(2);
});

test('countAllFolders counts nested folders recursively', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('metrics', 'Metrics', [
      createMetricItem('m1', 'Metric 1'),
    ]),
    createFolderItem('columns', 'Columns', [
      createColumnItem('c1', 'Column 1'),
    ]),
    createFolderItem('custom', 'Custom Folder', [
      createFolderItem('nested', 'Nested Folder', [
        createMetricItem('m2', 'Metric 2'),
      ]),
    ]),
  ] as DatasourceFolder[];

  expect(countAllFolders(folders)).toBe(4);
});

test('countAllFolders counts deeply nested folders', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('level0', 'Level 0', [
      createFolderItem('level1', 'Level 1', [
        createFolderItem('level2', 'Level 2', [
          createMetricItem('m1', 'Metric 1'),
        ]),
      ]),
    ]),
  ] as DatasourceFolder[];

  expect(countAllFolders(folders)).toBe(3);
});

test('countAllFolders ignores non-folder children', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Folder', [
      createMetricItem('m1', 'Metric 1'),
      createColumnItem('c1', 'Column 1'),
      createMetricItem('m2', 'Metric 2'),
    ]),
  ] as DatasourceFolder[];

  expect(countAllFolders(folders)).toBe(1);
});

test('filterFoldersByValidUuids removes items with invalid UUIDs', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Metrics', [
      createMetricItem('m1', 'Metric 1'),
      createMetricItem('m2', 'Metric 2'),
    ]),
  ] as DatasourceFolder[];

  const validUuids = new Set(['m1']);
  const filtered = filterFoldersByValidUuids(folders, validUuids);

  expect(filtered).toHaveLength(1);
  expect(filtered[0].children).toHaveLength(1);
  expect(filtered[0].children![0].uuid).toBe('m1');
});

test('filterFoldersByValidUuids preserves folders even when empty', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Metrics', [createMetricItem('m1', 'Metric 1')]),
  ] as DatasourceFolder[];

  const validUuids = new Set<string>();
  const filtered = filterFoldersByValidUuids(folders, validUuids);

  expect(filtered).toHaveLength(1);
  expect(filtered[0].uuid).toBe('f1');
  expect(filtered[0].children).toHaveLength(0);
});

test('filterFoldersByValidUuids handles nested folders', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Root', [
      createFolderItem('f2', 'Nested', [
        createMetricItem('m1', 'Metric 1'),
        createColumnItem('c1', 'Column 1'),
      ]),
      createColumnItem('c2', 'Column 2'),
    ]),
  ] as DatasourceFolder[];

  const validUuids = new Set(['m1', 'c2']);
  const filtered = filterFoldersByValidUuids(folders, validUuids);

  expect(filtered).toHaveLength(1);
  expect(filtered[0].children).toHaveLength(2);

  const nestedFolder = filtered[0].children![0] as DatasourceFolder;
  expect(nestedFolder.uuid).toBe('f2');
  expect(nestedFolder.children).toHaveLength(1);
  expect(nestedFolder.children![0].uuid).toBe('m1');

  expect(filtered[0].children![1].uuid).toBe('c2');
});

test('filterFoldersByValidUuids keeps all items when all UUIDs are valid', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Metrics', [
      createMetricItem('m1', 'Metric 1'),
      createMetricItem('m2', 'Metric 2'),
    ]),
  ] as DatasourceFolder[];

  const validUuids = new Set(['m1', 'm2']);
  const filtered = filterFoldersByValidUuids(folders, validUuids);

  expect(filtered).toHaveLength(1);
  expect(filtered[0].children).toHaveLength(2);
});

test('filterFoldersByValidUuids returns same reference when nothing changed', () => {
  const folders: DatasourceFolder[] = [
    createFolderItem('f1', 'Root', [
      createFolderItem('f2', 'Nested', [createMetricItem('m1', 'Metric 1')]),
      createColumnItem('c1', 'Column 1'),
    ]),
  ] as DatasourceFolder[];

  const validUuids = new Set(['m1', 'c1']);
  const filtered = filterFoldersByValidUuids(folders, validUuids);

  expect(filtered).toBe(folders);
});
