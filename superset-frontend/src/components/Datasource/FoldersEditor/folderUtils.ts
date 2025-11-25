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
import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import {
  DatasourceFolder,
  DatasourceFolderItem,
} from 'src/explore/components/DatasourcePanel/types';
import { UniqueIdentifier } from '@dnd-kit/core';
import { FoldersEditorItemType } from '../types';

export const DEFAULT_METRICS_FOLDER_UUID = 'default-metric-folder-uuid';
export const DEFAULT_COLUMNS_FOLDER_UUID = 'default-column-folder-uuid';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const createFolder = (name: string): DatasourceFolder => ({
  uuid: window.crypto.randomUUID(),
  type: FoldersEditorItemType.Folder,
  name,
  children: [],
});

export const deleteFolder = (
  folderId: string,
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  const deleteFolderRecursive = (
    items: DatasourceFolder[],
  ): DatasourceFolder[] =>
    items
      .filter(item => item.uuid !== folderId)
      .map(item => ({
        ...item,
        children: item.children
          ? deleteFolderRecursive(item.children as DatasourceFolder[])
          : item.children,
      }));

  return deleteFolderRecursive(folders);
};

export const renameFolder = (
  folderId: string,
  newName: string,
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  const renameFolderRecursive = (
    items: DatasourceFolder[],
  ): DatasourceFolder[] =>
    items.map(item => {
      if (item.uuid === folderId) {
        return { ...item, name: newName };
      }
      if (item.children && item.type === 'folder') {
        return {
          ...item,
          children: renameFolderRecursive(item.children as DatasourceFolder[]),
        };
      }
      return item;
    });

  return renameFolderRecursive(folders);
};

export const nestFolder = (
  folderId: string,
  parentId: string,
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  let folderToMove: DatasourceFolder | null = null;

  const findAndRemoveFolder = (items: DatasourceFolder[]): DatasourceFolder[] =>
    items
      .filter(item => {
        if (item.uuid === folderId) {
          folderToMove = item;
          return false;
        }
        return true;
      })
      .map(item => ({
        ...item,
        children:
          item.children && item.type === 'folder'
            ? findAndRemoveFolder(item.children as DatasourceFolder[])
            : item.children,
      }));

  const foldersWithoutTarget = findAndRemoveFolder(folders);

  if (!folderToMove) return folders;

  const addToParent = (items: DatasourceFolder[]): DatasourceFolder[] =>
    items.map(item => {
      if (item.uuid === parentId) {
        return {
          ...item,
          children: [...(item.children || []), folderToMove!],
        };
      }
      if (item.children && item.type === 'folder') {
        return {
          ...item,
          children: addToParent(item.children as DatasourceFolder[]),
        };
      }
      return item;
    });

  return addToParent(foldersWithoutTarget);
};

export const reorderFolders = (
  folderId: string,
  newIndex: number,
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  const currentIndex = folders.findIndex(f => f.uuid === folderId);
  if (currentIndex === -1) return folders;

  const result = [...folders];
  const [removed] = result.splice(currentIndex, 1);
  result.splice(newIndex, 0, removed);
  return result;
};

export const moveItems = (
  itemIds: string[],
  targetFolderId: string,
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  const itemsToMove: Array<{
    type: FoldersEditorItemType.Metric | FoldersEditorItemType.Column;
    uuid: string;
    name: string;
  }> = [];

  const removeItems = (items: DatasourceFolder[]): DatasourceFolder[] =>
    items.map(folder => ({
      ...folder,
      children: folder.children
        ? folder.children.filter(child => {
            if (
              child.type !== FoldersEditorItemType.Folder &&
              itemIds.includes(child.uuid)
            ) {
              itemsToMove.push({
                type: child.type,
                uuid: child.uuid,
                name: child.name || '',
              });
              return false;
            }
            return true;
          })
        : folder.children,
    }));

  const foldersWithoutItems = removeItems(folders);

  const addItems = (items: DatasourceFolder[]): DatasourceFolder[] =>
    items.map(folder => {
      if (folder.uuid === targetFolderId) {
        return {
          ...folder,
          children: [...(folder.children || []), ...itemsToMove],
        };
      }
      return folder;
    });

  return addItems(foldersWithoutItems);
};

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
    if (name?.toLowerCase().includes(lowerSearch)) {
      matchingIds.add(item.uuid);
    }
  });

  return matchingIds;
};

export const canDropFolder = (
  folderId: UniqueIdentifier,
  targetId: UniqueIdentifier,
  folders: DatasourceFolder[],
): boolean => {
  if (folderId === targetId) return false;

  // Prevent dropping a folder into its own descendants (circular reference)
  const descendants = getFolderDescendants(folderId, folders);
  if (descendants.includes(targetId)) {
    return false;
  }
  // Prevent dropping default folders (Metrics/Columns) into other folders
  const draggedFolder = findFolderById(folderId, folders);
  if (draggedFolder && isDefaultFolder(draggedFolder.uuid)) {
    return false;
  }

  // Allow nesting in any other case
  return true;
};

export const canDropItems = (
  itemIds: string[],
  targetFolderId: string,
  folders: DatasourceFolder[],
  metrics: Metric[],
  columns: ColumnMeta[],
): boolean => {
  const targetFolder = findFolderById(targetFolderId, folders);
  if (!targetFolder) return false;

  if (targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID) {
    return itemIds.every(id => metrics.some(m => m.uuid === id));
  }

  if (targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID) {
    return itemIds.every(id => columns.some(c => c.uuid === id));
  }

  return true;
};

export const getFolderDescendants = (
  folderId: UniqueIdentifier,
  folders: DatasourceFolder[],
): UniqueIdentifier[] => {
  const descendants: UniqueIdentifier[] = [];

  const collectDescendants = (folder: DatasourceFolder) => {
    if (folder.children) {
      folder.children.forEach(child => {
        if (child.type === 'folder') {
          descendants.push(child.uuid);
          collectDescendants(child as DatasourceFolder);
        }
      });
    }
  };

  const folder = findFolderById(folderId, folders);
  if (folder) {
    collectDescendants(folder);
  }

  return descendants;
};

export const findFolderById = (
  folderId: UniqueIdentifier,
  folders: DatasourceFolder[],
): DatasourceFolder | null => {
  for (const folder of folders) {
    if (folder.uuid === folderId) {
      return folder;
    }
    if (folder.children) {
      const found = findFolderById(
        folderId,
        folder.children.filter(c => c.type === 'folder') as DatasourceFolder[],
      );
      if (found) return found;
    }
  }
  return null;
};

export const validateFolders = (
  folders: DatasourceFolder[],
): ValidationResult => {
  const errors: string[] = [];

  const validateRecursive = (items: DatasourceFolder[]) => {
    items.forEach(folder => {
      if (!folder.name?.trim()) {
        errors.push(t('Folder must have a name'));
      }

      if (folder.uuid === DEFAULT_METRICS_FOLDER_UUID && folder.children) {
        const hasColumns = folder.children.some(
          child => child.type === 'column',
        );
        if (hasColumns) {
          errors.push(t('Metrics folder can only contain metric items'));
        }
      }

      if (folder.uuid === DEFAULT_COLUMNS_FOLDER_UUID && folder.children) {
        const hasMetrics = folder.children.some(
          child => child.type === 'metric',
        );
        if (hasMetrics) {
          errors.push(t('Columns folder can only contain column items'));
        }
      }

      if (folder.children && folder.type === 'folder') {
        const childFolders = folder.children.filter(
          c => c.type === 'folder',
        ) as DatasourceFolder[];
        validateRecursive(childFolders);
      }
    });
  };

  validateRecursive(folders);

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
};

export const cleanupFolders = (
  folders: DatasourceFolder[],
): DatasourceFolder[] => {
  const cleanRecursive = (items: DatasourceFolder[]): DatasourceFolder[] =>
    items
      .filter(folder => {
        if (isDefaultFolder(folder.uuid)) {
          return true;
        }
        return folder.children && folder.children.length > 0;
      })
      .map(folder => ({
        ...folder,
        children:
          folder.children && folder.type === 'folder'
            ? cleanRecursive(
                folder.children.filter(
                  c => c.type === 'folder',
                ) as DatasourceFolder[],
              )
            : folder.children,
      }));

  return cleanRecursive(folders);
};

export const isDefaultFolder = (folderId: string): boolean =>
  folderId === DEFAULT_METRICS_FOLDER_UUID ||
  folderId === DEFAULT_COLUMNS_FOLDER_UUID;

export const getAllSelectedItems = (
  selectedItemIds: Set<string>,
  visibleItemIds: string[],
): string[] => visibleItemIds.filter(id => selectedItemIds.has(id));

export const areAllVisibleItemsSelected = (
  selectedItemIds: Set<string>,
  visibleItemIds: string[],
): boolean =>
  visibleItemIds.length > 0 &&
  visibleItemIds.every(id => selectedItemIds.has(id));

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

  // First, enrich all folder children with names
  const enrichedFolders = enrichFolderChildren(folders, metrics, columns);

  const hasMetricsFolder = enrichedFolders.some(
    f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
  );
  const hasColumnsFolder = enrichedFolders.some(
    f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
  );

  const result = [...enrichedFolders];

  // Helper to check if item is in any folder (including nested)
  const isItemInFolders = (uuid: string): boolean => {
    const checkFolder = (folder: DatasourceFolder): boolean => {
      if (!folder.children) return false;

      return folder.children.some(child => {
        if (child.uuid === uuid) return true;
        if (
          child.type === FoldersEditorItemType.Folder &&
          'children' in child
        ) {
          return checkFolder(child as DatasourceFolder);
        }
        return false;
      });
    };

    return enrichedFolders.some(checkFolder);
  };

  if (!hasMetricsFolder) {
    const unassignedMetrics = metrics.filter(m => !isItemInFolders(m.uuid));

    result.push({
      uuid: DEFAULT_METRICS_FOLDER_UUID,
      type: FoldersEditorItemType.Folder,
      name: t('Metrics'),
      children: unassignedMetrics.map(m => ({
        type: FoldersEditorItemType.Metric,
        uuid: m.uuid,
        name: m.metric_name || '',
      })),
    });
  }

  if (!hasColumnsFolder) {
    const unassignedColumns = columns.filter(c => !isItemInFolders(c.uuid));

    result.push({
      uuid: DEFAULT_COLUMNS_FOLDER_UUID,
      type: FoldersEditorItemType.Folder,
      name: t('Columns'),
      children: unassignedColumns.map(c => ({
        type: FoldersEditorItemType.Column,
        uuid: c.uuid,
        name: c.column_name || '',
      })),
    });
  }

  return result;
};
