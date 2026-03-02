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

/**
 * Folder CRUD operations and data mutations.
 * Handles creating, deleting, renaming, moving folders and items.
 */

import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core';
import { v4 as uuidv4 } from 'uuid';
import {
  DatasourceFolder,
  DatasourceFolderItem,
} from 'src/explore/components/DatasourcePanel/types';
import { FoldersEditorItemType } from '../types';
import {
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
} from './constants';

export const createFolder = (name: string): DatasourceFolder => ({
  uuid: uuidv4(),
  type: FoldersEditorItemType.Folder,
  name,
  children: [],
});

export const resetToDefault = (
  metrics: Metric[],
  columns: ColumnMeta[],
): DatasourceFolder[] => {
  const metricsFolder: DatasourceFolder = {
    uuid: DEFAULT_METRICS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: t('Metrics'),
    children: metrics.map(m => ({
      type: FoldersEditorItemType.Metric as const,
      uuid: m.uuid,
      name: m.metric_name || '',
    })),
  };

  const columnsFolder: DatasourceFolder = {
    uuid: DEFAULT_COLUMNS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: t('Columns'),
    children: columns.map(c => ({
      type: FoldersEditorItemType.Column as const,
      uuid: c.uuid,
      name: c.column_name || '',
    })),
  };

  return [metricsFolder, columnsFolder];
};

export const filterItemsBySearch = (
  searchTerm: string,
  items: Array<Metric | ColumnMeta>,
): Set<string> => {
  const lowerSearch = searchTerm.toLowerCase();
  const matchingIds = new Set<string>();

  items.forEach(item => {
    const name = 'metric_name' in item ? item.metric_name : item.column_name;
    const { verbose_name: verboseName, expression } = item;

    if (
      name?.toLowerCase().includes(lowerSearch) ||
      verboseName?.toLowerCase().includes(lowerSearch) ||
      expression?.toLowerCase().includes(lowerSearch)
    ) {
      matchingIds.add(item.uuid);
    }
  });

  return matchingIds;
};

/**
 * Enrich folder children with names from metrics/columns arrays
 * API returns {uuid} only, we need to add {type, name} for display
 */
const enrichFolderChildren = (
  folders: DatasourceFolder[],
  metrics: Metric[],
  columns: ColumnMeta[],
): DatasourceFolder[] => {
  const metricMap = new Map(metrics.map(m => [m.uuid, m]));
  const columnMap = new Map(columns.map(c => [c.uuid, c]));

  const enrichChildren = (
    children: (DatasourceFolder | DatasourceFolderItem)[] | undefined,
  ): (DatasourceFolder | DatasourceFolderItem)[] => {
    if (!children) return [];

    return children.map(child => {
      // If it's a folder, recursively enrich its children
      if (child.type === FoldersEditorItemType.Folder && 'children' in child) {
        return {
          ...child,
          children: enrichChildren(child.children),
        } as DatasourceFolder;
      }

      // If it's a metric/column that needs enrichment (missing name or type)
      const needsEnrichment =
        !('name' in child) || !child.name || !('type' in child);

      if (needsEnrichment) {
        // Try to find in metrics first
        const metric = metricMap.get(child.uuid);
        if (metric) {
          return {
            uuid: child.uuid,
            type: FoldersEditorItemType.Metric,
            name: metric.metric_name || '',
          } as DatasourceFolderItem;
        }

        // Then try columns
        const column = columnMap.get(child.uuid);
        if (column) {
          return {
            uuid: child.uuid,
            type: FoldersEditorItemType.Column,
            name: column.column_name || '',
          } as DatasourceFolderItem;
        }
      }

      return child;
    });
  };

  return folders.map(folder => ({
    ...folder,
    children: enrichChildren(folder.children),
  }));
};

export const ensureDefaultFolders = (
  folders: DatasourceFolder[],
  metrics: Metric[],
  columns: ColumnMeta[],
): DatasourceFolder[] => {
  if (folders.length === 0) {
    return resetToDefault(metrics, columns);
  }

  const enrichedFolders = enrichFolderChildren(folders, metrics, columns);

  const hasMetricsFolder = enrichedFolders.some(
    f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
  );
  const hasColumnsFolder = enrichedFolders.some(
    f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
  );

  // Build a Set of all assigned UUIDs in a single pass for O(1) lookups
  const assignedIds = new Set<string>();
  const collectAssignedIds = (folder: DatasourceFolder) => {
    if (!folder.children) return;
    for (const child of folder.children) {
      assignedIds.add(child.uuid);
      if (child.type === FoldersEditorItemType.Folder && 'children' in child) {
        collectAssignedIds(child as DatasourceFolder);
      }
    }
  };
  enrichedFolders.forEach(collectAssignedIds);

  const unassignedMetrics = metrics
    .filter(m => !assignedIds.has(m.uuid))
    .map(m => ({
      type: FoldersEditorItemType.Metric as const,
      uuid: m.uuid,
      name: m.metric_name || '',
    }));
  const unassignedColumns = columns
    .filter(c => !assignedIds.has(c.uuid))
    .map(c => ({
      type: FoldersEditorItemType.Column as const,
      uuid: c.uuid,
      name: c.column_name || '',
    }));

  // Add unassigned items to existing default folders (handles new items added after last save)
  const result = enrichedFolders.map(folder => {
    if (
      folder.uuid === DEFAULT_METRICS_FOLDER_UUID &&
      unassignedMetrics.length > 0
    ) {
      return {
        ...folder,
        children: [...(folder.children || []), ...unassignedMetrics],
      };
    }
    if (
      folder.uuid === DEFAULT_COLUMNS_FOLDER_UUID &&
      unassignedColumns.length > 0
    ) {
      return {
        ...folder,
        children: [...(folder.children || []), ...unassignedColumns],
      };
    }
    return folder;
  });

  // If default folders don't exist at all, add them at the end (backward compatibility)
  if (!hasMetricsFolder) {
    result.push({
      uuid: DEFAULT_METRICS_FOLDER_UUID,
      type: FoldersEditorItemType.Folder,
      name: t('Metrics'),
      children: unassignedMetrics,
    });
  }

  if (!hasColumnsFolder) {
    result.push({
      uuid: DEFAULT_COLUMNS_FOLDER_UUID,
      type: FoldersEditorItemType.Folder,
      name: t('Columns'),
      children: unassignedColumns,
    });
  }

  return result;
};
