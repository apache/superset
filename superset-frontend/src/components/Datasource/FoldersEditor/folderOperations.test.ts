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

import { Metric } from '@superset-ui/chart-controls';
import { ColumnObject } from 'src/features/datasets/types';
import {
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
  isDefaultFolder,
} from './constants';
import {
  createFolder,
  deleteFolder,
  resetToDefault,
  filterItemsBySearch,
  renameFolder,
  nestFolder,
  reorderFolders,
  moveItems,
  cleanupFolders,
  getAllSelectedItems,
  areAllVisibleItemsSelected,
  ensureDefaultFolders,
} from './folderOperations';
import {
  canDropItems,
  canDropFolder,
  getFolderDescendants,
  findFolderById,
  validateFolders,
} from './folderValidation';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import { FoldersEditorItemType } from '../types';

describe('folderUtils', () => {
  const mockMetrics: Metric[] = [
    {
      id: 1,
      uuid: 'metric-1',
      metric_name: 'Test Metric 1',
      metric_type: 'count',
      expression: 'COUNT(*)',
    } as Metric,
    {
      id: 2,
      uuid: 'metric-2',
      metric_name: 'Test Metric 2',
      metric_type: 'sum',
      expression: 'SUM(value)',
    } as Metric,
  ];

  const mockColumns: (ColumnObject & { uuid: string })[] = [
    {
      id: 1,
      uuid: 'column-1',
      column_name: 'Test Column 1',
      type: 'VARCHAR',
      filterable: true,
      groupby: true,
      is_active: true,
      is_dttm: false,
    },
    {
      id: 2,
      uuid: 'column-2',
      column_name: 'Test Column 2',
      type: 'INTEGER',
      filterable: true,
      groupby: true,
      is_active: true,
      is_dttm: false,
    },
  ];

  describe('createFolder', () => {
    test('should create a folder with correct properties', () => {
      const folder = createFolder('Test Folder');

      expect(folder.name).toBe('Test Folder');
      expect(folder.type).toBe(FoldersEditorItemType.Folder);
      expect(folder.children).toEqual([]);
      expect(folder.uuid).toBeDefined();
    });
  });

  describe('resetToDefault', () => {
    test('should create default folders with correct structure', () => {
      const result = resetToDefault(mockMetrics, mockColumns);

      expect(result).toHaveLength(2);

      const metricsFolder = result.find(
        f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
      );
      const columnsFolder = result.find(
        f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
      );

      expect(metricsFolder).toBeDefined();
      expect(metricsFolder?.name).toBe('Metrics');
      expect(metricsFolder?.children).toHaveLength(2);

      expect(columnsFolder).toBeDefined();
      expect(columnsFolder?.name).toBe('Columns');
      expect(columnsFolder?.children).toHaveLength(2);
    });
  });

  describe('filterItemsBySearch', () => {
    test('should filter items by search term', () => {
      const allItems = [...mockMetrics, ...mockColumns];
      const result = filterItemsBySearch('Test Metric', allItems);

      expect(result.size).toBe(2);
      expect(result.has('metric-1')).toBe(true);
      expect(result.has('metric-2')).toBe(true);
    });

    test('should return all items for empty search', () => {
      const allItems = [...mockMetrics, ...mockColumns];
      const result = filterItemsBySearch('', allItems);

      expect(result.size).toBe(4);
    });
  });

  describe('renameFolder', () => {
    test('should rename folder correctly', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = renameFolder(
        DEFAULT_METRICS_FOLDER_UUID,
        'Custom Metrics',
        folders,
      );

      const renamedFolder = result.find(
        f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
      );
      expect(renamedFolder?.name).toBe('Custom Metrics');
    });
  });

  describe('canDropItems', () => {
    test('should allow dropping metrics in Metrics folder', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = canDropItems(
        ['metric-1'],
        DEFAULT_METRICS_FOLDER_UUID,
        folders,
        mockMetrics,
        mockColumns,
      );

      expect(result).toBe(true);
    });

    test('should not allow dropping columns in Metrics folder', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = canDropItems(
        ['column-1'],
        DEFAULT_METRICS_FOLDER_UUID,
        folders,
        mockMetrics,
        mockColumns,
      );

      expect(result).toBe(false);
    });

    test('should allow dropping any items in custom folders', () => {
      const customFolder = createFolder('Custom Folder');
      const folders = [customFolder];

      const metricResult = canDropItems(
        ['metric-1'],
        customFolder.uuid,
        folders,
        mockMetrics,
        mockColumns,
      );
      const columnResult = canDropItems(
        ['column-1'],
        customFolder.uuid,
        folders,
        mockMetrics,
        mockColumns,
      );

      expect(metricResult).toBe(true);
      expect(columnResult).toBe(true);
    });
  });

  describe('isDefaultFolder', () => {
    test('should identify default folders by UUID', () => {
      expect(isDefaultFolder(DEFAULT_METRICS_FOLDER_UUID)).toBe(true);
      expect(isDefaultFolder(DEFAULT_COLUMNS_FOLDER_UUID)).toBe(true);
      expect(isDefaultFolder('custom-folder-uuid')).toBe(false);
    });
  });

  describe('validateFolders', () => {
    test('should validate folders successfully', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = validateFolders(folders);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should allow empty folders without names', () => {
      // Empty folders without names are valid (they get filtered out anyway)
      const folders = [createFolder('')];
      const result = validateFolders(folders);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect folders with content but no name', () => {
      const folder = createFolder('');
      folder.children = [
        { uuid: 'metric-1', type: FoldersEditorItemType.Metric, name: 'Test' },
      ];
      const folders = [folder];
      const result = validateFolders(folders);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Folder with content must have a name');
    });

    test('should detect duplicate folder names', () => {
      const folder1 = createFolder('My Folder');
      const folder2 = createFolder('My Folder');
      const folders = [folder1, folder2];
      const result = validateFolders(folders);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('my folder'))).toBe(true);
    });

    test('should detect duplicate folder names case-insensitively', () => {
      const folder1 = createFolder('Test Folder');
      const folder2 = createFolder('test folder');
      const folders = [folder1, folder2];
      const result = validateFolders(folders);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('test folder'))).toBe(true);
    });
  });

  describe('ensureDefaultFolders', () => {
    test('should create default folders when none exist', () => {
      const result = ensureDefaultFolders([], mockMetrics, mockColumns);

      expect(result).toHaveLength(2);

      const metricsFolder = result.find(
        f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
      );
      const columnsFolder = result.find(
        f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
      );

      expect(metricsFolder).toBeDefined();
      expect(columnsFolder).toBeDefined();
    });

    test('should preserve existing folders', () => {
      const existingFolders = [createFolder('Custom Folder')];
      const result = ensureDefaultFolders(
        existingFolders,
        mockMetrics,
        mockColumns,
      );

      expect(result.length).toBeGreaterThan(2);
      expect(result.find(f => f.name === 'Custom Folder')).toBeDefined();
    });
  });

  describe('deleteFolder', () => {
    test('should delete a folder by id', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = deleteFolder(DEFAULT_METRICS_FOLDER_UUID, folders);

      expect(result).toHaveLength(1);
      expect(
        result.find(f => f.uuid === DEFAULT_METRICS_FOLDER_UUID),
      ).toBeUndefined();
      expect(
        result.find(f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID),
      ).toBeDefined();
    });

    test('should delete nested folders', () => {
      const parentFolder: DatasourceFolder = {
        uuid: 'parent',
        type: FoldersEditorItemType.Folder,
        name: 'Parent',
        children: [
          {
            uuid: 'child',
            type: FoldersEditorItemType.Folder,
            name: 'Child',
            children: [],
          } as DatasourceFolder,
        ],
      };
      const folders = [parentFolder];
      const result = deleteFolder('child', folders);

      expect(result).toHaveLength(1);
      expect(
        (result[0].children as DatasourceFolder[]).find(
          c => c.uuid === 'child',
        ),
      ).toBeUndefined();
    });

    test('should return unchanged array if folder not found', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = deleteFolder('nonexistent', folders);

      expect(result).toHaveLength(2);
    });
  });

  describe('nestFolder', () => {
    test('should nest a folder inside another folder', () => {
      const folder1: DatasourceFolder = {
        uuid: 'folder1',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 1',
        children: [],
      };
      const folder2: DatasourceFolder = {
        uuid: 'folder2',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 2',
        children: [],
      };
      const folders = [folder1, folder2];

      const result = nestFolder('folder2', 'folder1', folders);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('folder1');
      expect(result[0].children).toHaveLength(1);
      expect((result[0].children as DatasourceFolder[])[0].uuid).toBe(
        'folder2',
      );
    });

    test('should return unchanged if folder to move not found', () => {
      const folder1: DatasourceFolder = {
        uuid: 'folder1',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 1',
        children: [],
      };
      const folders = [folder1];

      const result = nestFolder('nonexistent', 'folder1', folders);

      expect(result).toEqual(folders);
    });
  });

  describe('reorderFolders', () => {
    test('should reorder folders at root level', () => {
      const folder1: DatasourceFolder = {
        uuid: 'folder1',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 1',
        children: [],
      };
      const folder2: DatasourceFolder = {
        uuid: 'folder2',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 2',
        children: [],
      };
      const folder3: DatasourceFolder = {
        uuid: 'folder3',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 3',
        children: [],
      };
      const folders = [folder1, folder2, folder3];

      const result = reorderFolders('folder3', 0, folders);

      expect(result[0].uuid).toBe('folder3');
      expect(result[1].uuid).toBe('folder1');
      expect(result[2].uuid).toBe('folder2');
    });

    test('should return unchanged if folder not found', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = reorderFolders('nonexistent', 0, folders);

      expect(result).toEqual(folders);
    });
  });

  describe('moveItems', () => {
    test('should move items from one folder to another', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'folder1',
          type: FoldersEditorItemType.Folder,
          name: 'Folder 1',
          children: [
            {
              uuid: 'metric-1',
              type: FoldersEditorItemType.Metric,
              name: 'Metric 1',
            },
            {
              uuid: 'metric-2',
              type: FoldersEditorItemType.Metric,
              name: 'Metric 2',
            },
          ],
        },
        {
          uuid: 'folder2',
          type: FoldersEditorItemType.Folder,
          name: 'Folder 2',
          children: [],
        },
      ];

      const result = moveItems(['metric-1'], 'folder2', folders);

      expect(result[0].children).toHaveLength(1);
      expect(result[1].children).toHaveLength(1);
      expect(result[1].children![0].uuid).toBe('metric-1');
    });

    test('should move multiple items at once', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'folder1',
          type: FoldersEditorItemType.Folder,
          name: 'Folder 1',
          children: [
            {
              uuid: 'metric-1',
              type: FoldersEditorItemType.Metric,
              name: 'Metric 1',
            },
            {
              uuid: 'metric-2',
              type: FoldersEditorItemType.Metric,
              name: 'Metric 2',
            },
          ],
        },
        {
          uuid: 'folder2',
          type: FoldersEditorItemType.Folder,
          name: 'Folder 2',
          children: [],
        },
      ];

      const result = moveItems(['metric-1', 'metric-2'], 'folder2', folders);

      expect(result[0].children).toHaveLength(0);
      expect(result[1].children).toHaveLength(2);
    });
  });

  describe('canDropFolder', () => {
    test('should prevent dropping folder on itself', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const result = canDropFolder('folder1', 'folder1', folders);

      expect(result).toBe(false);
    });

    test('should prevent dropping folder on its descendants', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'parent',
          type: FoldersEditorItemType.Folder,
          name: 'Parent',
          children: [
            {
              uuid: 'child',
              type: FoldersEditorItemType.Folder,
              name: 'Child',
              children: [
                {
                  uuid: 'grandchild',
                  type: FoldersEditorItemType.Folder,
                  name: 'Grandchild',
                  children: [],
                } as DatasourceFolder,
              ],
            } as DatasourceFolder,
          ],
        },
      ];

      expect(canDropFolder('parent', 'child', folders)).toBe(false);
      expect(canDropFolder('parent', 'grandchild', folders)).toBe(false);
    });

    test('should prevent dropping default folders into other folders', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const customFolder = createFolder('Custom');
      folders.push(customFolder);

      expect(
        canDropFolder(DEFAULT_METRICS_FOLDER_UUID, customFolder.uuid, folders),
      ).toBe(false);
      expect(
        canDropFolder(DEFAULT_COLUMNS_FOLDER_UUID, customFolder.uuid, folders),
      ).toBe(false);
    });

    test('should allow valid folder drops', () => {
      const folder1: DatasourceFolder = {
        uuid: 'folder1',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 1',
        children: [],
      };
      const folder2: DatasourceFolder = {
        uuid: 'folder2',
        type: FoldersEditorItemType.Folder,
        name: 'Folder 2',
        children: [],
      };
      const folders = [folder1, folder2];

      expect(canDropFolder('folder1', 'folder2', folders)).toBe(true);
    });
  });

  describe('getFolderDescendants', () => {
    test('should return all descendant folder IDs', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'parent',
          type: FoldersEditorItemType.Folder,
          name: 'Parent',
          children: [
            {
              uuid: 'child1',
              type: FoldersEditorItemType.Folder,
              name: 'Child 1',
              children: [
                {
                  uuid: 'grandchild',
                  type: FoldersEditorItemType.Folder,
                  name: 'Grandchild',
                  children: [],
                } as DatasourceFolder,
              ],
            } as DatasourceFolder,
            {
              uuid: 'child2',
              type: FoldersEditorItemType.Folder,
              name: 'Child 2',
              children: [],
            } as DatasourceFolder,
          ],
        },
      ];

      const descendants = getFolderDescendants('parent', folders);

      expect(descendants).toContain('child1');
      expect(descendants).toContain('child2');
      expect(descendants).toContain('grandchild');
      expect(descendants).toHaveLength(3);
    });

    test('should return empty array for non-existent folder', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const descendants = getFolderDescendants('nonexistent', folders);

      expect(descendants).toHaveLength(0);
    });
  });

  describe('findFolderById', () => {
    test('should find folder at root level', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const found = findFolderById(DEFAULT_METRICS_FOLDER_UUID, folders);

      expect(found).toBeDefined();
      expect(found?.uuid).toBe(DEFAULT_METRICS_FOLDER_UUID);
    });

    test('should find nested folder', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'parent',
          type: FoldersEditorItemType.Folder,
          name: 'Parent',
          children: [
            {
              uuid: 'child',
              type: FoldersEditorItemType.Folder,
              name: 'Child',
              children: [],
            } as DatasourceFolder,
          ],
        },
      ];

      const found = findFolderById('child', folders);

      expect(found).toBeDefined();
      expect(found?.uuid).toBe('child');
    });

    test('should return null for non-existent folder', () => {
      const folders = resetToDefault(mockMetrics, mockColumns);
      const found = findFolderById('nonexistent', folders);

      expect(found).toBeNull();
    });
  });

  describe('cleanupFolders', () => {
    test('should remove empty non-default folders', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: 'empty-folder',
          type: FoldersEditorItemType.Folder,
          name: 'Empty Folder',
          children: [],
        },
        {
          uuid: 'non-empty-folder',
          type: FoldersEditorItemType.Folder,
          name: 'Non-Empty Folder',
          children: [
            {
              uuid: 'metric-1',
              type: FoldersEditorItemType.Metric,
              name: 'Metric 1',
            },
          ],
        },
      ];

      const result = cleanupFolders(folders);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('non-empty-folder');
    });

    test('should preserve empty default folders', () => {
      const folders: DatasourceFolder[] = [
        {
          uuid: DEFAULT_METRICS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder,
          name: 'Metrics',
          children: [],
        },
        {
          uuid: DEFAULT_COLUMNS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder,
          name: 'Columns',
          children: [],
        },
      ];

      const result = cleanupFolders(folders);

      expect(result).toHaveLength(2);
    });
  });

  describe('getAllSelectedItems', () => {
    test('should return only visible items that are selected', () => {
      const selectedItemIds = new Set(['item1', 'item2', 'item3']);
      const visibleItemIds = ['item1', 'item3', 'item4'];

      const result = getAllSelectedItems(selectedItemIds, visibleItemIds);

      expect(result).toHaveLength(2);
      expect(result).toContain('item1');
      expect(result).toContain('item3');
      expect(result).not.toContain('item2');
    });

    test('should return empty array if no items are selected', () => {
      const selectedItemIds = new Set<string>();
      const visibleItemIds = ['item1', 'item2'];

      const result = getAllSelectedItems(selectedItemIds, visibleItemIds);

      expect(result).toHaveLength(0);
    });
  });

  describe('areAllVisibleItemsSelected', () => {
    test('should return true when all visible items are selected', () => {
      const selectedItemIds = new Set(['item1', 'item2', 'item3']);
      const visibleItemIds = ['item1', 'item2'];

      expect(areAllVisibleItemsSelected(selectedItemIds, visibleItemIds)).toBe(
        true,
      );
    });

    test('should return false when some visible items are not selected', () => {
      const selectedItemIds = new Set(['item1']);
      const visibleItemIds = ['item1', 'item2'];

      expect(areAllVisibleItemsSelected(selectedItemIds, visibleItemIds)).toBe(
        false,
      );
    });

    test('should return false when visible items is empty', () => {
      const selectedItemIds = new Set(['item1']);
      const visibleItemIds: string[] = [];

      expect(areAllVisibleItemsSelected(selectedItemIds, visibleItemIds)).toBe(
        false,
      );
    });
  });
});
