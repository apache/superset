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
import { useCallback, useRef, useState } from 'react';
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
  CollisionDetection,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import {
  DatasourceFolder,
  DatasourceFolderItem,
} from 'src/explore/components/DatasourcePanel/types';
import { canDropFolder, canDropItems } from './folderUtils';
import { DragState } from './types';

interface UseDragAndDropProps {
  folders: DatasourceFolder[];
  setFolders: React.Dispatch<React.SetStateAction<DatasourceFolder[]>>;
  folderIds: UniqueIdentifier[];
  selectedItemIds: Set<string>;
  metrics: Metric[];
  columns: ColumnMeta[];
  onChange: (folders: DatasourceFolder[]) => void;
}

export const useDragAndDrop = ({
  folders,
  setFolders,
  folderIds,
  selectedItemIds,
  metrics,
  columns,
  onChange,
}: UseDragAndDropProps) => {
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    draggedType: null,
    draggedItems: [],
    overId: null,
  });

  const canAcceptCurrentDrag = useCallback(
    (folderId: string) => {
      if (!dragState.activeId) {
        return false;
      }
      if (dragState.draggedType === 'folder') {
        return canDropFolder(dragState.activeId, folderId, folders);
      }
      if (dragState.draggedType === 'item') {
        return canDropItems(
          dragState.draggedItems,
          folderId,
          folders,
          metrics,
          columns,
        );
      }
      return false;
    },
    [dragState, folders, metrics, columns],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    const activeData = active.data.current;

    if (activeData?.type === 'folder') {
      setDragState({
        activeId,
        draggedType: 'folder',
        draggedItems: [],
        overId: null,
      });
    } else {
      const itemsToMove = selectedItemIds.has(activeId)
        ? Array.from(selectedItemIds)
        : [activeId];

      setDragState({
        activeId,
        draggedType: 'item',
        draggedItems: itemsToMove,
        overId: null,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;

    if (overId === null) {
      return;
    }

    // Handle folder reordering
    if (folderIds.includes(active.id) && overId !== active.id) {
      setFolders(prevFolders => {
        const activeIndex = prevFolders.findIndex(f => f.uuid === active.id);
        const overIndex = prevFolders.findIndex(f => f.uuid === overId);
        const newFolders = arrayMove(prevFolders, activeIndex, overIndex);
        return newFolders;
      });
      return;
    }

    const overFolder = folders.find(
      folder =>
        folder.uuid === overId ||
        folder.children?.some(item => item.uuid === overId),
    );
    const activeFolder = folders.find(
      folder =>
        folder.uuid === active.id ||
        folder.children?.some(item => item.uuid === active.id),
    );

    if (
      !overFolder ||
      !activeFolder ||
      !canAcceptCurrentDrag(overFolder.uuid)
    ) {
      return;
    }

    // Update drag state to show visual feedback
    if (overFolder.uuid !== dragState.overId) {
      setDragState(prev => ({
        ...prev,
        overId: overFolder.uuid || null,
      }));
    }

    // Check if the destination folder is currently empty
    const isDestinationEmpty =
      !overFolder.children || overFolder.children.length === 0;

    // Only move items during drag-over if the destination is NOT empty
    if (activeFolder.uuid !== overFolder.uuid && !isDestinationEmpty) {
      setFolders(prevFolders => {
        if (recentlyMovedToNewContainer.current) {
          return prevFolders;
        }

        const draggedItemIds =
          dragState.draggedItems.length > 0
            ? dragState.draggedItems
            : [active.id];

        // Collect the actual item objects from all folders
        const itemsToMove: DatasourceFolderItem[] = [];
        prevFolders.forEach(folder => {
          if (folder.children) {
            folder.children.forEach(child => {
              if (
                child.type !== 'folder' &&
                draggedItemIds.includes(child.uuid)
              ) {
                itemsToMove.push(child as DatasourceFolderItem);
              }
            });
          }
        });

        // Calculate the insertion index
        const overItems = overFolder.children || [];
        const filteredOverItems = overItems.filter(
          item => !draggedItemIds.includes(item.uuid),
        );
        const filteredOverIndex = filteredOverItems.findIndex(
          item => item.uuid === overId,
        );

        let newIndex: number;
        if (overId && folderIds.includes(overId)) {
          newIndex = filteredOverItems.length;
        } else if (filteredOverIndex >= 0) {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top >
              over.rect.top + over.rect.height;
          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = filteredOverIndex + modifier;
        } else {
          newIndex = filteredOverItems.length;
        }
        recentlyMovedToNewContainer.current = true;

        // Update all folders
        const newFolders = prevFolders.map(folder => {
          const filteredChildren =
            folder.children?.filter(
              item => !draggedItemIds.includes(item.uuid),
            ) || [];

          if (folder.uuid === overFolder.uuid) {
            return {
              ...folder,
              children: [
                ...filteredChildren.slice(0, newIndex),
                ...itemsToMove,
                ...filteredChildren.slice(newIndex),
              ],
            };
          }
          return {
            ...folder,
            children: filteredChildren,
          };
        });

        return newFolders;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (folderIds.includes(active.id) && over?.id) {
      onChange(folders);
    }

    const overId = over?.id;

    if (overId == null) {
      setDragState({
        activeId: null,
        draggedType: null,
        draggedItems: [],
        overId: null,
      });
      return;
    }

    const overFolder = folders.find(
      folder =>
        folder.uuid === overId ||
        folder.children?.some(item => item.uuid === overId),
    );
    const activeFolder = folders.find(
      folder =>
        folder.uuid === active.id ||
        folder.children?.some(item => item.uuid === active.id),
    );

    if (!overFolder || !activeFolder) {
      setDragState({
        activeId: null,
        draggedType: null,
        draggedItems: [],
        overId: null,
      });
      return;
    }

    // Check if we need to move items to an empty folder
    const isDestinationEmpty =
      !overFolder.children || overFolder.children.length === 0;

    if (
      isDestinationEmpty &&
      activeFolder.uuid !== overFolder.uuid &&
      canAcceptCurrentDrag(overFolder.uuid)
    ) {
      // Handle dropping into empty folder
      const draggedItemIds =
        dragState.draggedItems.length > 0
          ? dragState.draggedItems
          : [active.id as string];

      // Collect the actual item objects from all folders
      const itemsToMove: DatasourceFolderItem[] = [];
      folders.forEach(folder => {
        if (folder.children) {
          folder.children.forEach(child => {
            if (
              child.type !== 'folder' &&
              draggedItemIds.includes(child.uuid)
            ) {
              itemsToMove.push(child as DatasourceFolderItem);
            }
          });
        }
      });

      const updatedFolders = folders.map(folder => {
        const filteredChildren =
          folder.children?.filter(
            item => !draggedItemIds.includes(item.uuid),
          ) || [];

        if (folder.uuid === overFolder.uuid) {
          return {
            ...folder,
            children: itemsToMove,
          };
        }
        return {
          ...folder,
          children: filteredChildren,
        };
      });

      setFolders(updatedFolders);
      onChange(updatedFolders);
    } else if (activeFolder.uuid === overFolder.uuid) {
      // Reordering within the same folder
      const activeIndex =
        activeFolder.children?.findIndex(item => item.uuid === active.id) ?? -1;
      const overIndex =
        overFolder.children?.findIndex(item => item.uuid === overId) ?? -1;

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const updatedFolders = folders.map(f =>
          f.uuid === overFolder.uuid
            ? {
                ...f,
                children: arrayMove(
                  overFolder.children || [],
                  activeIndex,
                  overIndex,
                ),
              }
            : f,
        );
        setFolders(updatedFolders);
        onChange(updatedFolders);
      } else {
        onChange(folders);
      }
    } else {
      // Items were already moved during drag-over for non-empty folders
      onChange(folders);
    }

    setDragState({
      activeId: null,
      draggedType: null,
      draggedItems: [],
      overId: null,
    });
  };

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    args => {
      if (dragState.activeId && folderIds.includes(dragState.activeId)) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(container =>
            folderIds.includes(container.id),
          ),
        });
      }

      // Start by finding any intersecting droppable
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        if (folderIds.includes(overId)) {
          const folderItems =
            folders.find(f => f.uuid === overId)?.children || [];

          if (folderItems.length > 0) {
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                container =>
                  container.id !== overId &&
                  folderItems.find(item => item.uuid === container.id),
              ),
            })[0]?.id;
          }
        }

        lastOverId.current = overId;

        return [{ id: overId }];
      }

      // Handle recently moved container
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = dragState.activeId;
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [dragState.activeId, folders, folderIds],
  );

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    collisionDetectionStrategy,
    canAcceptCurrentDrag,
    recentlyMovedToNewContainer,
  };
};
