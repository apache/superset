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

import { t } from '@apache-superset/core';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import {
  ValidationResult,
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
} from './constants';

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
