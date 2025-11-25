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
  createFolder,
  resetToDefault,
  filterItemsBySearch,
  renameFolder,
  canDropItems,
  validateFolders,
  isDefaultFolder,
  ensureDefaultFolders,
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
} from './folderUtils';
import { FoldersEditorItemType } from '../types';

// Mock window.crypto.randomUUID
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: jest.fn(
      () => 'mocked-uuid-' + Math.random().toString(36).substring(7),
    ),
  },
});

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

    test('should detect unnamed folders', () => {
      const folders = [createFolder('')];
      const result = validateFolders(folders);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Folder must have a name');
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
});
