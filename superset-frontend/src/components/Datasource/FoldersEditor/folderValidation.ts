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
 * Validation and constraint checking for folder operations.
 * Determines what actions are allowed based on folder structure and types.
 */

import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import { UniqueIdentifier } from '@dnd-kit/core';
import { FoldersEditorItemType } from '../types';
import {
  FlattenedTreeItem,
  TreeItem,
  ValidationResult,
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
  isDefaultFolder,
} from './constants';
import { getDescendantIds } from './treeUtils';

export const canAcceptDrop = (
  targetFolder: FlattenedTreeItem,
  draggedItems: FlattenedTreeItem[],
): boolean => {
  const isDefaultMetricsFolder =
    targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID;
  const isDefaultColumnsFolder =
    targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID;

  if (isDefaultMetricsFolder) {
    return draggedItems.every(
      item => item.type === FoldersEditorItemType.Metric,
    );
  }

  if (isDefaultColumnsFolder) {
    return draggedItems.every(
      item => item.type === FoldersEditorItemType.Column,
    );
  }

  return true;
};

export const canNestFolder = (
  items: TreeItem[],
  movingFolderId: string,
  targetFolderId: string,
): boolean => {
  if (movingFolderId === targetFolderId) {
    return false;
  }

  const descendants = getDescendantIds(items, movingFolderId);
  return !descendants.includes(targetFolderId);
};

export const canDropFolder = (
  folderId: UniqueIdentifier,
  targetId: UniqueIdentifier,
  folders: DatasourceFolder[],
): boolean => {
  if (folderId === targetId) return false;

  const descendants = getFolderDescendants(folderId, folders);
  if (descendants.includes(targetId)) {
    return false;
  }

  const draggedFolder = findFolderById(folderId, folders);
  if (draggedFolder && isDefaultFolder(draggedFolder.uuid)) {
    return false;
  }

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
  const folderNames: string[] = [];

  const collectFolderNames = (items: DatasourceFolder[]) => {
    items.forEach(folder => {
      if (folder.name?.trim()) {
        folderNames.push(folder.name.trim().toLowerCase());
      }

      if (folder.children && folder.type === 'folder') {
        const childFolders = folder.children.filter(
          c => c.type === 'folder',
        ) as DatasourceFolder[];
        collectFolderNames(childFolders);
      }
    });
  };

  const validateRecursive = (items: DatasourceFolder[]) => {
    items.forEach(folder => {
      const hasContent = folder.children && folder.children.length > 0;
      const hasNoTitle = !folder.name?.trim();

      if (hasContent && hasNoTitle) {
        errors.push(t('Folder with content must have a name'));
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

  collectFolderNames(folders);

  const nameCounts = new Map<string, number>();
  folderNames.forEach(name => {
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  });
  nameCounts.forEach((count, name) => {
    if (count > 1) {
      errors.push(t('Duplicate folder name: %s', name));
    }
  });

  validateRecursive(folders);

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
};
