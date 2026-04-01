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
  resetToDefault,
  filterItemsBySearch,
  ensureDefaultFolders,
} from './folderOperations';
import { validateFolders } from './folderValidation';
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

    test('should match by verbose_name', () => {
      const metrics: Metric[] = [
        {
          uuid: 'metric-v1',
          metric_name: 'count',
          verbose_name: 'COUNT(*)',
          expression: 'COUNT(*)',
        } as Metric,
      ];
      const result = filterItemsBySearch('COUNT', metrics);

      expect(result.size).toBe(1);
      expect(result.has('metric-v1')).toBe(true);
    });

    test('should match by expression', () => {
      const result = filterItemsBySearch('COUNT(*)', mockMetrics);

      expect(result.size).toBe(1);
      expect(result.has('metric-1')).toBe(true);
    });

    test('should match special characters in search term', () => {
      const metrics: Metric[] = [
        {
          uuid: 'metric-special',
          metric_name: 'count',
          verbose_name: 'COUNT(*)',
          expression: 'COUNT(*)',
        } as Metric,
      ];
      const result = filterItemsBySearch('(*)', metrics);

      expect(result.size).toBe(1);
      expect(result.has('metric-special')).toBe(true);
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

    test('should preserve default folder positions when saved', () => {
      const customFolder = createFolder('Custom');
      customFolder.children = [
        {
          uuid: 'metric-1',
          type: FoldersEditorItemType.Metric,
          name: 'Test Metric 1',
        },
      ];
      const savedFolders = [
        {
          uuid: DEFAULT_METRICS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder as const,
          name: 'Metrics',
          children: [
            {
              uuid: 'metric-2',
              name: 'metric-2',
              type: FoldersEditorItemType.Metric,
            },
          ],
        },
        customFolder,
        {
          uuid: DEFAULT_COLUMNS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder as const,
          name: 'Columns',
          children: [
            {
              uuid: 'column-1',
              name: 'column-1',
              type: FoldersEditorItemType.Column,
            },
            {
              uuid: 'column-2',
              name: 'column-2',
              type: FoldersEditorItemType.Column,
            },
          ],
        },
      ];
      const result = ensureDefaultFolders(
        savedFolders,
        mockMetrics,
        mockColumns,
      );

      expect(result).toHaveLength(3);
      expect(result[0].uuid).toBe(DEFAULT_METRICS_FOLDER_UUID);
      expect(result[1].uuid).toBe(customFolder.uuid);
      expect(result[2].uuid).toBe(DEFAULT_COLUMNS_FOLDER_UUID);
    });

    test('should add unassigned items to existing default folders', () => {
      const savedFolders = [
        {
          uuid: DEFAULT_METRICS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder as const,
          name: 'Metrics',
          children: [
            {
              uuid: 'metric-1',
              name: 'metric-1',
              type: FoldersEditorItemType.Metric,
            },
          ],
        },
        {
          uuid: DEFAULT_COLUMNS_FOLDER_UUID,
          type: FoldersEditorItemType.Folder as const,
          name: 'Columns',
          children: [
            {
              uuid: 'column-1',
              name: 'column-1',
              type: FoldersEditorItemType.Column,
            },
          ],
        },
      ];
      const result = ensureDefaultFolders(
        savedFolders,
        mockMetrics,
        mockColumns,
      );

      const metricsFolder = result.find(
        f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
      );
      const columnsFolder = result.find(
        f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
      );

      // metric-2 was unassigned, should be appended
      expect(metricsFolder?.children).toHaveLength(2);
      expect(metricsFolder?.children?.some(c => c.uuid === 'metric-2')).toBe(
        true,
      );

      // column-2 was unassigned, should be appended
      expect(columnsFolder?.children).toHaveLength(2);
      expect(columnsFolder?.children?.some(c => c.uuid === 'column-2')).toBe(
        true,
      );
    });
  });
});
