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
  metrics: MetricItem[],
  columns: ColumnItem[],
  folderConfig: DatasourceFolder[] | undefined,
): Folder[] => {
  const metricsMap = new Map<string, MetricItem>();
  const columnsMap = new Map<string, ColumnItem>();

  metrics.forEach(metric => {
    metricsMap.set(metric.uuid, metric);
  });

  columns.forEach(column => {
    columnsMap.set(column.uuid, column);
  });

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
      parentId,
    };

    if (datasourceFolder.children && datasourceFolder.children.length > 0) {
      if (!folder.subFolders) {
        folder.subFolders = [];
      }

      datasourceFolder.children.forEach(child => {
        if (child.type === 'folder') {
          folder.subFolders!.push(
            processFolder(child as DatasourceFolder, folder.id),
          );
        } else if (child.type === 'metric') {
          const metric = metricsMap.get(child.uuid);
          if (metric) {
            folder.items.push(metric);
            metricsMap.delete(metric.uuid);
          }
        } else if (child.type === 'column') {
          const column = columnsMap.get(child.uuid);
          if (column) {
            folder.items.push(column);
            columnsMap.delete(column.uuid);
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
        items: metrics,
      },
      {
        id: 'columns-default',
        name: t('Columns'),
        isCollapsed: false,
        items: columns,
      },
    ];
  }

  const folders = folderConfig.map(config => processFolder(config));

  const unassignedMetrics = metrics.filter(metric =>
    metricsMap.has(metric.uuid),
  );
  const unassignedColumns = columns.filter(column =>
    columnsMap.has(column.uuid),
  );

  if (unassignedMetrics.length > 0) {
    folders.push({
      id: 'metrics-default',
      name: t('Metrics'),
      isCollapsed: false,
      items: unassignedMetrics,
    });
  }

  if (unassignedColumns.length > 0) {
    folders.push({
      id: 'columns-default',
      name: t('Columns'),
      isCollapsed: false,
      items: unassignedColumns,
    });
  }

  return folders;
};

export const transformDatasourceWithFolders = (
  metrics: Metric[],
  columns: DatasourcePanelColumn[],
  folderConfig: DatasourceFolder[] | undefined,
): Folder[] => {
  const metricsWithType: MetricItem[] = metrics.map(metric => ({
    ...metric,
    type: 'metric',
  }));
  const columnsWithType: ColumnItem[] = columns.map(column => ({
    ...column,
    type: 'column',
  }));

  return transformToFolderStructure(
    metricsWithType,
    columnsWithType,
    folderConfig,
  );
};
