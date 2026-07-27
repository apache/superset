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
import { FoldersEditorItemType } from 'src/components/Datasource/types';
import { DndItemType } from '../DndItemType';
import { DatasourcePanelDndItem, Folder, FolderItem } from './types';

/**
 * Map a single folder entry to the drag-item shape used by the control drop
 * targets. Metrics become `DndItemType.Metric`, everything else a column.
 */
function toDndItem(item: FolderItem): DatasourcePanelDndItem {
  return {
    type:
      item.type === FoldersEditorItemType.Metric
        ? DndItemType.Metric
        : DndItemType.Column,
    // The runtime object carries the full ColumnMeta/Metric (see
    // transformDatasourceWithFolders spreading `...column`/`...metric`), which
    // is what the drop handlers expect.
    value: item as ColumnMeta | Metric,
  };
}

/**
 * Flatten a folder into the list of draggable columns/metrics it contains,
 * descending into subfolders so dragging a parent folder brings everything
 * nested under it.
 */
export function collectFolderDragItems(
  folder: Folder,
): DatasourcePanelDndItem[] {
  const items = folder.items.map(toDndItem);
  folder.subFolders?.forEach(subFolder => {
    items.push(...collectFolderDragItems(subFolder));
  });
  return items;
}
