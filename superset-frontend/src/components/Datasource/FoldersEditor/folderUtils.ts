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
import { t } from '@superset-ui/core';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Column } from './types';
import { FoldersEditorItemType } from '../types';

export const DEFAULT_METRICS_FOLDER_UUID = 'default-metric-folder-uuid';
export const DEFAULT_COLUMNS_FOLDER_UUID = 'default-column-folder-uuid';

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const createFolder = (name: string): DatasourceFolder => ({
  uuid: generateUUID(),
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
  columns: Column[],
): DatasourceFolder[] => {
  const metricsFolder: DatasourceFolder = {
    uuid: DEFAULT_METRICS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Metrics',
    children: metrics.map(m => ({
      type: FoldersEditorItemType.Metric as const,
      uuid: m.uuid,
      name: m.metric_name || '',
    })),
  };

  const columnsFolder: DatasourceFolder = {
    uuid: DEFAULT_COLUMNS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Columns',
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
  items: Array<Metric | Column>,
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
  if (draggedFolder && isDefaultFolder(draggedFolder.name)) {
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
  columns: Column[],
): boolean => {
  const targetFolder = findFolderById(targetFolderId, folders);
  if (!targetFolder) return false;

  if (targetFolder.name === 'Metrics') {
    return itemIds.every(id => metrics.some(m => m.uuid === id));
  }

  if (targetFolder.name === 'Columns') {
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

      if (folder.name === 'Metrics' && folder.children) {
        const hasColumns = folder.children.some(
          child => child.type === 'column',
        );
        if (hasColumns) {
          errors.push(t('Metrics folder can only contain metric items'));
        }
      }

      if (folder.name === 'Columns' && folder.children) {
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
        if (folder.name === 'Metrics' || folder.name === 'Columns') {
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

export const isDefaultFolder = (folderName: string): boolean =>
  folderName === 'Metrics' || folderName === 'Columns';

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

export const ensureDefaultFolders = (
  folders: DatasourceFolder[],
  metrics: Metric[],
  columns: Column[],
): DatasourceFolder[] => {
  if (folders.length === 0) {
    return resetToDefault(metrics, columns);
  }

  const hasMetricsFolder = folders.some(
    f => f.uuid === DEFAULT_METRICS_FOLDER_UUID,
  );
  const hasColumnsFolder = folders.some(
    f => f.uuid === DEFAULT_COLUMNS_FOLDER_UUID,
  );

  const result = [...folders];

  if (!hasMetricsFolder) {
    const unassignedMetrics = metrics.filter(m => {
      const isInFolder = folders.some(
        f =>
          f.children &&
          f.children.some(c => c.type === 'metric' && c.uuid === m.uuid),
      );
      return !isInFolder;
    });

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
    const unassignedColumns = columns.filter(c => {
      const isInFolder = folders.some(
        f =>
          f.children &&
          f.children.some(
            child =>
              child.type === FoldersEditorItemType.Column &&
              child.uuid === c.uuid,
          ),
      );
      return !isInFolder;
    });

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
