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

import { Metric } from '@superset-ui/core';
import { transformDatasourceWithFolders } from './transformDatasourceFolders';
import { DatasourceFolder, DatasourcePanelColumn } from './types';
import { FoldersEditorItemType } from 'src/components/Datasource/types';
import {
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
} from 'src/components/Datasource/FoldersEditor/constants';

const mockMetrics: Metric[] = [
  { metric_name: 'metric1', uuid: 'metric1-uuid', expression: 'SUM(col1)' },
  { metric_name: 'metric2', uuid: 'metric2-uuid', expression: 'AVG(col2)' },
  { metric_name: 'metric3', uuid: 'metric3-uuid', expression: 'COUNT(*)' },
];

const mockColumns: DatasourcePanelColumn[] = [
  { column_name: 'column1', uuid: 'column1-uuid', type: 'STRING' },
  { column_name: 'column2', uuid: 'column2-uuid', type: 'NUMERIC' },
  { column_name: 'column3', uuid: 'column3-uuid', type: 'DATETIME' },
];

test('transforms data into default folders when no folder config is provided', () => {
  const result = transformDatasourceWithFolders(
    mockMetrics,
    mockColumns,
    undefined,
    mockMetrics,
    mockColumns,
  );

  expect(result).toHaveLength(2);

  expect(result[0].id).toBe(DEFAULT_METRICS_FOLDER_UUID);
  expect(result[0].name).toBe('Metrics');
  expect(result[0].items).toHaveLength(3);
  expect(result[0].items[0].uuid).toBe('metric1-uuid');
  expect(result[0].items[0].type).toBe(FoldersEditorItemType.Metric);

  expect(result[1].id).toBe(DEFAULT_COLUMNS_FOLDER_UUID);
  expect(result[1].name).toBe('Columns');
  expect(result[1].items).toHaveLength(3);
  expect(result[1].items[0].uuid).toBe('column1-uuid');
  expect(result[1].items[0].type).toBe(FoldersEditorItemType.Column);
});

test('transforms data according to folder configuration', () => {
  const folderConfig: DatasourceFolder[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Important Metrics',
      description: 'Key metrics folder',
      children: [
        {
          type: FoldersEditorItemType.Metric,
          uuid: 'metric1-uuid',
          name: 'metric1',
        },
        {
          type: FoldersEditorItemType.Metric,
          uuid: 'metric2-uuid',
          name: 'metric2',
        },
      ],
    },
    {
      uuid: 'folder2',
      type: FoldersEditorItemType.Folder,
      name: 'Key Dimensions',
      children: [
        {
          type: FoldersEditorItemType.Column,
          uuid: 'column1-uuid',
          name: 'column1',
        },
      ],
    },
  ];

  const result = transformDatasourceWithFolders(
    mockMetrics,
    mockColumns,
    folderConfig,
    mockMetrics,
    mockColumns,
  );

  // We expect 4 folders:
  // 1. Important Metrics (from config)
  // 2. Key Dimensions (from config)
  // 3. Metrics (default for unassigned metrics)
  // 4. Columns (default for unassigned columns)
  expect(result).toHaveLength(4);

  expect(result[0].id).toBe('folder1');
  expect(result[0].name).toBe('Important Metrics');
  expect(result[0].description).toBe('Key metrics folder');
  expect(result[0].items).toHaveLength(2);
  expect(result[0].items[0].uuid).toBe('metric1-uuid');

  expect(result[1].id).toBe('folder2');
  expect(result[1].name).toBe('Key Dimensions');
  expect(result[1].items).toHaveLength(1);
  expect(result[1].items[0].uuid).toBe('column1-uuid');

  expect(result[2].id).toBe(DEFAULT_METRICS_FOLDER_UUID);
  expect(result[2].items).toHaveLength(1);
  expect(result[2].items[0].uuid).toBe('metric3-uuid');

  expect(result[3].id).toBe(DEFAULT_COLUMNS_FOLDER_UUID);
  expect(result[3].items).toHaveLength(2);
});

test('handles nested folder structures', () => {
  const folderConfig: DatasourceFolder[] = [
    {
      uuid: 'parent-folder',
      type: FoldersEditorItemType.Folder,
      name: 'Parent Folder',
      children: [
        {
          uuid: 'child-folder',
          type: FoldersEditorItemType.Folder,
          name: 'Child Folder',
          children: [
            {
              type: FoldersEditorItemType.Metric,
              uuid: 'metric1-uuid',
              name: 'metric1',
            },
          ],
        },
        {
          type: FoldersEditorItemType.Column,
          uuid: 'column1-uuid',
          name: 'column1',
        },
      ],
    },
  ];

  const result = transformDatasourceWithFolders(
    mockMetrics,
    mockColumns,
    folderConfig,
    mockMetrics,
    mockColumns,
  );

  expect(result[0].id).toBe('parent-folder');
  expect(result[0].name).toBe('Parent Folder');
  expect(result[0].items).toHaveLength(1);
  expect(result[0].subFolders).toHaveLength(1);

  const childFolder = result[0].subFolders![0];
  expect(childFolder.id).toBe('child-folder');
  expect(childFolder.name).toBe('Child Folder');
  expect(childFolder.items).toHaveLength(1);
  expect(childFolder.parentId).toBe('parent-folder');
});

test('handles empty children arrays', () => {
  const folderConfig: DatasourceFolder[] = [
    {
      uuid: 'empty-folder',
      type: FoldersEditorItemType.Folder,
      name: 'Empty Folder',
      children: [],
    },
  ];

  const result = transformDatasourceWithFolders(
    mockMetrics,
    mockColumns,
    folderConfig,
    mockMetrics,
    mockColumns,
  );

  expect(result[0].id).toBe('empty-folder');
  expect(result[0].name).toBe('Empty Folder');
  expect(result[0].items).toHaveLength(0);
});

test('handles non-existent metric and column UUIDs in folder config', () => {
  const folderConfig: DatasourceFolder[] = [
    {
      uuid: 'folder1',
      type: FoldersEditorItemType.Folder,
      name: 'Test Folder',
      children: [
        {
          type: FoldersEditorItemType.Metric,
          uuid: 'non-existent-metric',
          name: 'Missing Metric',
        },
        {
          type: FoldersEditorItemType.Column,
          uuid: 'non-existent-column',
          name: 'Missing Column',
        },
        {
          type: FoldersEditorItemType.Metric,
          uuid: 'metric1-uuid',
          name: 'Existing Metric',
        },
      ],
    },
  ];

  const result = transformDatasourceWithFolders(
    mockMetrics,
    mockColumns,
    folderConfig,
    mockMetrics,
    mockColumns,
  );

  expect(result[0].id).toBe('folder1');
  expect(result[0].items).toHaveLength(1);
  expect(result[0].items[0].uuid).toBe('metric1-uuid');
});
