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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import { cloneDeep } from 'lodash';
import { FlattenedItem, Folder } from './types';
import DatasourcePanelItem from './DatasourcePanelItem';

const BORDER_WIDTH = 2;
const HEADER_ITEM_HEIGHT = 50;
const METRIC_OR_COLUMN_ITEM_HEIGHT = 32;
const DIVIDER_ITEM_HEIGHT = 16;

const flattenFolderStructure = (
  folders: Folder[],
  depth = 0,
  folderMap: Map<string, Folder> = new Map(),
): { flattenedItems: FlattenedItem[]; folderMap: Map<string, Folder> } => {
  const flattenedItems: FlattenedItem[] = [];

  folders.forEach((folder, idx) => {
    folderMap.set(folder.id, folder);

    flattenedItems.push({
      type: 'header',
      folderId: folder.id,
      depth,
      height: HEADER_ITEM_HEIGHT,
    });

    if (!folder.isCollapsed) {
      folder.items.forEach((item, idx) => {
        flattenedItems.push({
          type: 'item',
          folderId: folder.id,
          index: idx,
          depth,
          item,
          height: METRIC_OR_COLUMN_ITEM_HEIGHT,
        });
      });

      if (folder.subFolders && folder.subFolders.length > 0) {
        const { flattenedItems: subItems } = flattenFolderStructure(
          folder.subFolders,
          depth + 1,
          folderMap,
        );

        flattenedItems.push(...subItems);
      }
    }
    if (depth === 0 && idx !== folders.length - 1) {
      flattenedItems.push({
        type: 'divider',
        folderId: folder.id,
        depth,
        height: DIVIDER_ITEM_HEIGHT,
      });
    }
  });

  return { flattenedItems, folderMap };
};

interface DatasourceItemsProps {
  width: number;
  height: number;
  folders: Folder[];
}
export const DatasourceItems = ({
  width,
  height,
  folders,
}: DatasourceItemsProps) => {
  const [folderStructure, setFolderStructure] = useState<Folder[]>(folders);

  useEffect(() => {
    setFolderStructure(prev => (prev !== folders ? folders : prev));
  }, [folders]);

  const { flattenedItems, folderMap } = useMemo(
    () => flattenFolderStructure(folderStructure),
    [folderStructure],
  );

  const handleToggleCollapse = useCallback((folderId: string) => {
    setFolderStructure(prevFolders => {
      const updatedFolders = cloneDeep(prevFolders);

      const updateFolder = (folders: Folder[] | undefined): boolean => {
        if (!folders) {
          return false;
        }
        for (let i = 0; i < folders.length; i += 1) {
          if (folders[i].id === folderId) {
            // eslint-disable-next-line no-param-reassign
            folders[i].isCollapsed = !folders[i].isCollapsed;
            return true;
          }

          if (folders[i].subFolders && updateFolder(folders[i].subFolders)) {
            return true;
          }
        }
        return false;
      };

      updateFolder(updatedFolders);
      return updatedFolders;
    });
  }, []);

  const getItemSize = useCallback(
    (index: number) => flattenedItems[index].height,
    [flattenedItems],
  );

  return (
    <List
      width={width - BORDER_WIDTH}
      height={height}
      itemSize={getItemSize}
      itemCount={flattenedItems.length}
      itemData={{
        flattenedItems,
        folderMap,
        width,
        onToggleCollapse: handleToggleCollapse,
      }}
      overscanCount={5}
    >
      {DatasourcePanelItem}
    </List>
  );
};
