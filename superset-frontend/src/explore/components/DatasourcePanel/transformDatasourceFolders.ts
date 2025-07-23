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
import { Metric, t } from '@superset-ui/core';
import {
  ColumnItem,
  DatasourceFolder,
  DatasourcePanelColumn,
  Folder,
  MetricItem,
} from './types';

const transformToFolderStructure = (
  metricsToDisplay: MetricItem[],
  columnsToDisplay: ColumnItem[],
  folderConfig: DatasourceFolder[] | undefined,
  allMetrics: Metric[],
  allColumns: DatasourcePanelColumn[],
): Folder[] => {
  const metricsMap = new Map<string, MetricItem>();
  const columnsMap = new Map<string, ColumnItem>();

  metricsToDisplay.forEach(metric => {
    metricsMap.set(metric.uuid, metric);
  });

  columnsToDisplay.forEach(column => {
    columnsMap.set(column.uuid, column);
  });

  let metricsInFolders = 0;
  let columnsInFolders = 0;
  const processFolder = (
    datasourceFolder: DatasourceFolder,
    parentId?: string,
  ): Folder => {
    const folder: Folder = {
      id: datasourceFolder.uuid,
      name: datasourceFolder.name,
      description: datasourceFolder.description,
      isCollapsed: false,
      items: [],
      totalItems: 0,
      showingItems: 0,
      parentId,
    };

    if (datasourceFolder.children && datasourceFolder.children.length > 0) {
      if (!folder.subFolders) {
        folder.subFolders = [];
      }

      datasourceFolder.children.forEach(child => {
        if (child.type === 'folder') {
          const subFolder = processFolder(child as DatasourceFolder, folder.id);
          folder.subFolders!.push(subFolder);
          folder.totalItems += subFolder.totalItems;
          folder.showingItems += subFolder.showingItems;
        } else if (child.type === 'metric') {
          folder.totalItems += 1;
          metricsInFolders += 1;
          const metric = metricsMap.get(child.uuid);
          if (metric) {
            folder.items.push(metric);
            metricsMap.delete(metric.uuid);
            folder.showingItems += 1;
          }
        } else if (child.type === 'column') {
          folder.totalItems += 1;
          columnsInFolders += 1;
          const column = columnsMap.get(child.uuid);
          if (column) {
            folder.items.push(column);
            columnsMap.delete(column.uuid);
            folder.showingItems += 1;
          }
        }
      });
    }

    return folder;
  };

  if (!folderConfig) {
    return [
      {
        id: 'metrics-default',
        name: t('Metrics'),
        isCollapsed: false,
        items: metricsToDisplay,
        totalItems: allMetrics.length,
        showingItems: metricsToDisplay.length,
      },
      {
        id: 'columns-default',
        name: t('Columns'),
        isCollapsed: false,
        items: columnsToDisplay,
        totalItems: allColumns.length,
        showingItems: columnsToDisplay.length,
      },
    ];
  }

  const folders = folderConfig.map(config => processFolder(config));

  const unassignedMetrics = metricsToDisplay.filter(metric =>
    metricsMap.has(metric.uuid),
  );
  const unassignedColumns = columnsToDisplay.filter(column =>
    columnsMap.has(column.uuid),
  );

  if (unassignedMetrics.length > 0) {
    folders.push({
      id: 'metrics-default',
      name: t('Metrics'),
      isCollapsed: false,
      items: unassignedMetrics,
      totalItems: allMetrics.length - metricsInFolders,
      showingItems: unassignedMetrics.length,
    });
  }

  if (unassignedColumns.length > 0) {
    folders.push({
      id: 'columns-default',
      name: t('Columns'),
      isCollapsed: false,
      items: unassignedColumns,
      totalItems: allColumns.length - columnsInFolders,
      showingItems: unassignedColumns.length,
    });
  }

  return folders;
};

export const transformDatasourceWithFolders = (
  metricsToDisplay: Metric[],
  columnsToDisplay: DatasourcePanelColumn[],
  folderConfig: DatasourceFolder[] | undefined,
  allMetrics: Metric[],
  allColumns: DatasourcePanelColumn[],
): Folder[] => {
  const metricsWithType: MetricItem[] = metricsToDisplay.map(metric => ({
    ...metric,
    type: 'metric',
  }));
  const columnsWithType: ColumnItem[] = columnsToDisplay.map(column => ({
    ...column,
    type: 'column',
  }));

  return transformToFolderStructure(
    metricsWithType,
    columnsWithType,
    folderConfig,
    allMetrics,
    allColumns,
  );
};
