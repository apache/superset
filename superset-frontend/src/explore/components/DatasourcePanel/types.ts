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
import { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { DndItemType } from '../DndItemType';

export type DndItemValue = ColumnMeta | Metric;

export interface DatasourcePanelDndItem {
  value: DndItemValue;
  type: DndItemType;
}

export function isDatasourcePanelDndItem(
  item: any,
): item is DatasourcePanelDndItem {
  return item?.value && item?.type;
}

export function isSavedMetric(item: any): item is Metric {
  return item?.metric_name;
}

export type DatasourcePanelColumn = {
  uuid: string;
  id?: number;
  is_dttm?: boolean | null;
  description?: string | null;
  expression?: string | null;
  is_certified?: number | null;
  column_name?: string | null;
  name?: string | null;
  type?: string;
};

export type DatasourceFolder = {
  uuid: string;
  type: 'folder';
  name: string;
  description?: string;
  children?: (
    | DatasourceFolder
    | { type: 'metric'; uuid: string; name: string }
    | { type: 'column'; uuid: string; name: string }
  )[];
};

export type MetricItem = Metric & {
  type: 'metric';
};

export type ColumnItem = DatasourcePanelColumn & {
  type: 'column';
};

export type FolderItem = MetricItem | ColumnItem;

export interface Folder {
  id: string;
  name: string;
  description?: string;
  isCollapsed: boolean;
  items: FolderItem[];
  subFolders?: Folder[];
  parentId?: string;
  totalItems: number;
  showingItems: number; // items shown after filtering
}

export interface FlattenedItem {
  type: 'header' | 'item' | 'divider' | 'subtitle';
  folderId: string;
  depth: number;
  item?: FolderItem;
  height: number;
  totalItems?: number;
  showingItems?: number;
}
