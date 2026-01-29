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

import { useCallback, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core';
import {
  UniqueIdentifier,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { FoldersEditorItemType } from '../../types';
import {
  isDefaultFolder,
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
  TreeItem as TreeItemType,
  FlattenedTreeItem,
  DRAG_INDENTATION_WIDTH,
} from '../constants';
import { buildTree, getProjection, serializeForAPI } from '../treeUtils';

interface UseDragHandlersProps {
  items: TreeItemType[];
  setItems: React.Dispatch<React.SetStateAction<TreeItemType[]>>;
  computeFlattenedItems: (
    activeId: UniqueIdentifier | null,
  ) => FlattenedTreeItem[];
  fullFlattenedItems: FlattenedTreeItem[];
  selectedItemIds: Set<string>;
  onChange: (folders: ReturnType<typeof serializeForAPI>) => void;
  addWarningToast: (message: string) => void;
}

export function useDragHandlers({
  items,
  setItems,
  computeFlattenedItems,
  fullFlattenedItems,
  selectedItemIds,
  onChange,
  addWarningToast,
}: UseDragHandlersProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const offsetLeftRef = useRef(0);
  // Track current drop target - use state so virtualized items can render correctly
  const [currentDropTargetId, setCurrentDropTargetId] = useState<string | null>(
    null,
  );
  const [draggedItemIds, setDraggedItemIds] = useState<Set<string>>(new Set());

  // Store the flattened items at drag start to keep them stable during drag
  // This prevents react-window from re-rendering due to flattenedItems reference changes
  const dragStartFlattenedItemsRef = useRef<FlattenedTreeItem[] | null>(null);

  // Compute flattened items, but during drag use the stable snapshot from drag start
  // This prevents react-window from re-rendering/re-measuring when flattenedItems changes
  const computedFlattenedItems = useMemo(
    () => computeFlattenedItems(activeId),
    [computeFlattenedItems, activeId],
  );

  // Use stable items during drag to prevent scroll jumping
  // Memoize to avoid creating new array references on every render
  const flattenedItems = useMemo(
    () =>
      activeId && dragStartFlattenedItemsRef.current
        ? dragStartFlattenedItemsRef.current
        : computedFlattenedItems,
    [activeId, computedFlattenedItems],
  );

  const flattenedItemsIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    flattenedItems.forEach((item, index) => {
      map.set(item.uuid, index);
    });
    return map;
  }, [flattenedItems]);

  const resetDragState = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    offsetLeftRef.current = 0;
    setCurrentDropTargetId(null);
    setDraggedItemIds(new Set());
    setDragOverlayWidth(null);
    // Clear the stable snapshot so next render uses fresh computed items
    dragStartFlattenedItemsRef.current = null;
  }, []);

  const handleDragStart = ({ active }: DragStartEvent) => {
    // Capture the current flattened items BEFORE setting activeId
    // This ensures the list stays stable during the entire drag operation
    dragStartFlattenedItemsRef.current = computeFlattenedItems(null);

    setActiveId(active.id);

    const element = active.rect.current.initial;
    if (element) {
      setDragOverlayWidth(element.width);
    }

    if (selectedItemIds.has(active.id as string)) {
      setDraggedItemIds(new Set(selectedItemIds));
    } else {
      setDraggedItemIds(new Set([active.id as string]));
    }
  };

  const handleDragMove = useCallback(
    ({ delta }: DragMoveEvent) => {
      offsetLeftRef.current = delta.x;

      if (activeId && overId) {
        if (typeof overId === 'string' && overId.endsWith('-empty')) {
          const folderId = overId.replace('-empty', '');
          setCurrentDropTargetId(folderId);
          return;
        }

        const projection = getProjection(
          flattenedItems,
          activeId,
          overId,
          delta.x,
          DRAG_INDENTATION_WIDTH,
          flattenedItemsIndexMap,
        );
        const newParentId = projection?.parentId ?? null;
        setCurrentDropTargetId(newParentId);
      }
    },
    [
      activeId,
      overId,
      flattenedItems,
      flattenedItemsIndexMap,
      setCurrentDropTargetId,
    ],
  );

  const handleDragOver = useCallback(
    ({ over }: DragOverEvent) => {
      setOverId(over?.id ?? null);

      if (activeId && over) {
        if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
          const folderId = over.id.replace('-empty', '');
          setCurrentDropTargetId(folderId);
          return;
        }

        const projection = getProjection(
          flattenedItems,
          activeId,
          over.id,
          offsetLeftRef.current,
          DRAG_INDENTATION_WIDTH,
          flattenedItemsIndexMap,
        );
        const newParentId = projection?.parentId ?? null;
        setCurrentDropTargetId(newParentId);
      } else {
        setCurrentDropTargetId(null);
      }
    },
    [activeId, flattenedItems, flattenedItemsIndexMap, setCurrentDropTargetId],
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const itemsBeingDragged = Array.from(draggedItemIds);
    const finalOffsetLeft = offsetLeftRef.current;
    resetDragState();

    if (!over || itemsBeingDragged.length === 0) {
      return;
    }

    let targetOverId = over.id;
    let isEmptyDrop = false;
    if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
      targetOverId = over.id.replace('-empty', '');
      isEmptyDrop = true;

      if (itemsBeingDragged.includes(targetOverId as string)) {
        return;
      }
    }

    const activeIndex = fullFlattenedItems.findIndex(
      ({ uuid }) => uuid === active.id,
    );
    const overIndex = fullFlattenedItems.findIndex(
      ({ uuid }) => uuid === targetOverId,
    );

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    const draggedItems = fullFlattenedItems.filter((item: FlattenedTreeItem) =>
      itemsBeingDragged.includes(item.uuid),
    );

    let projectedPosition = getProjection(
      flattenedItems,
      active.id,
      targetOverId,
      finalOffsetLeft,
      DRAG_INDENTATION_WIDTH,
    );

    if (isEmptyDrop) {
      const targetFolder = fullFlattenedItems[overIndex];
      projectedPosition = {
        depth: targetFolder.depth + 1,
        maxDepth: targetFolder.depth + 1,
        minDepth: targetFolder.depth + 1,
        parentId: targetOverId as string,
      };
    }

    const activeItem = fullFlattenedItems[activeIndex];
    if (active.id === targetOverId) {
      const newParentId = projectedPosition?.parentId ?? null;
      const currentParentId = activeItem.parentId;
      if (newParentId === currentParentId) {
        return;
      }
    }

    const hasNonFolderItems = draggedItems.some(
      item => item.type !== FoldersEditorItemType.Folder,
    );
    if (hasNonFolderItems) {
      if (!projectedPosition || !projectedPosition.parentId) {
        return;
      }
    }

    if (projectedPosition && projectedPosition.parentId) {
      const targetFolder = fullFlattenedItems.find(
        ({ uuid }) => uuid === projectedPosition.parentId,
      );

      if (targetFolder && isDefaultFolder(targetFolder.uuid)) {
        const isDefaultMetricsFolder =
          targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID;
        const isDefaultColumnsFolder =
          targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID;

        for (const draggedItem of draggedItems) {
          if (draggedItem.type === FoldersEditorItemType.Folder) {
            addWarningToast(t('Cannot nest folders in default folders'));
            return;
          }
          if (
            isDefaultMetricsFolder &&
            draggedItem.type === FoldersEditorItemType.Column
          ) {
            addWarningToast(t('This folder only accepts metrics'));
            return;
          }
          if (
            isDefaultColumnsFolder &&
            draggedItem.type === FoldersEditorItemType.Metric
          ) {
            addWarningToast(t('This folder only accepts columns'));
            return;
          }
        }
      }
    }

    const hasDraggedDefaultFolder = draggedItems.some(
      item =>
        item.type === FoldersEditorItemType.Folder &&
        isDefaultFolder(item.uuid),
    );
    if (hasDraggedDefaultFolder && projectedPosition?.parentId) {
      addWarningToast(t('Default folders cannot be nested'));
      return;
    }

    let newItems = fullFlattenedItems;

    if (projectedPosition) {
      const depthChange = projectedPosition.depth - activeItem.depth;

      const itemsToUpdate = new Map<
        string,
        { depth: number; parentId: string | null | undefined }
      >();

      draggedItems.forEach((item: FlattenedTreeItem) => {
        if (item.uuid === active.id) {
          itemsToUpdate.set(item.uuid, {
            depth: projectedPosition.depth,
            parentId: projectedPosition.parentId,
          });
        } else {
          itemsToUpdate.set(item.uuid, {
            depth: item.depth + depthChange,
            parentId: projectedPosition.parentId,
          });
        }
      });

      const collectDescendants = (
        parentId: string,
        parentDepthChange: number,
      ) => {
        fullFlattenedItems.forEach((item: FlattenedTreeItem) => {
          if (item.parentId === parentId && !itemsToUpdate.has(item.uuid)) {
            itemsToUpdate.set(item.uuid, {
              depth: item.depth + parentDepthChange,
              parentId: undefined,
            });
            if (item.type === FoldersEditorItemType.Folder) {
              collectDescendants(item.uuid, parentDepthChange);
            }
          }
        });
      };

      draggedItems.forEach((item: FlattenedTreeItem) => {
        if (item.type === FoldersEditorItemType.Folder) {
          collectDescendants(item.uuid, depthChange);
        }
      });

      newItems = fullFlattenedItems.map((item: FlattenedTreeItem) => {
        const update = itemsToUpdate.get(item.uuid);
        if (update) {
          const newParentId =
            update.parentId === undefined ? item.parentId : update.parentId;
          return {
            ...item,
            depth: update.depth,
            parentId: newParentId,
          };
        }
        return item;
      });
    }

    const itemsToMoveIds = new Set(itemsBeingDragged);

    const collectDescendantIds = (parentId: string) => {
      fullFlattenedItems.forEach((item: FlattenedTreeItem) => {
        if (item.parentId === parentId && !itemsToMoveIds.has(item.uuid)) {
          itemsToMoveIds.add(item.uuid);
          if (item.type === FoldersEditorItemType.Folder) {
            collectDescendantIds(item.uuid);
          }
        }
      });
    };

    draggedItems.forEach((item: FlattenedTreeItem) => {
      if (item.type === FoldersEditorItemType.Folder) {
        collectDescendantIds(item.uuid);
      }
    });

    const itemsToMoveIndices: number[] = [];
    fullFlattenedItems.forEach((item: FlattenedTreeItem, idx: number) => {
      if (itemsToMoveIds.has(item.uuid)) {
        itemsToMoveIndices.push(idx);
      }
    });
    itemsToMoveIndices.sort((a, b) => a - b);

    const subtree = itemsToMoveIndices.map(idx => newItems[idx]);
    const remaining = newItems.filter(
      (_: FlattenedTreeItem, idx: number) => !itemsToMoveIndices.includes(idx),
    );

    let insertionIndex = 0;

    if (projectedPosition && projectedPosition.parentId) {
      const parentIndex = remaining.findIndex(
        item => item.uuid === projectedPosition.parentId,
      );

      if (parentIndex !== -1) {
        if (isEmptyDrop) {
          insertionIndex = parentIndex + 1;
        } else {
          const overItemInRemaining = remaining.findIndex(
            item => item.uuid === targetOverId,
          );

          if (overItemInRemaining !== -1) {
            const overItem = remaining[overItemInRemaining];

            if (overItem.parentId === projectedPosition.parentId) {
              if (activeIndex < overIndex) {
                insertionIndex = overItemInRemaining + 1;
              } else {
                insertionIndex = overItemInRemaining;
              }
            } else if (projectedPosition.depth > overItem.depth) {
              insertionIndex = overItemInRemaining + 1;
            } else {
              insertionIndex = overItemInRemaining + 1;
            }
          } else {
            insertionIndex = parentIndex + 1;
          }
        }
      }
    } else {
      let adjustedOverIndex = overIndex;
      itemsToMoveIndices.forEach((idx: number) => {
        if (idx < overIndex) {
          adjustedOverIndex -= 1;
        }
      });
      insertionIndex = adjustedOverIndex;
    }

    const sortedItems = [
      ...remaining.slice(0, insertionIndex),
      ...subtree,
      ...remaining.slice(insertionIndex),
    ];

    // Safety check: verify all items are preserved after sorting
    if (sortedItems.length !== fullFlattenedItems.length) {
      // If items were lost, don't apply the change
      return;
    }

    const newTree = buildTree(sortedItems);
    setItems(newTree);
    onChange(serializeForAPI(newTree));
  };

  const handleDragCancel = () => {
    resetDragState();
  };

  const dragOverlayItems = useMemo(() => {
    if (!activeId || draggedItemIds.size === 0) return [];

    const draggedItems = fullFlattenedItems.filter((item: FlattenedTreeItem) =>
      draggedItemIds.has(item.uuid),
    );

    return draggedItems.slice(0, 3);
  }, [activeId, draggedItemIds, fullFlattenedItems]);

  const forbiddenDropFolderIds = useMemo(() => {
    const forbidden = new Set<string>();
    if (draggedItemIds.size === 0) {
      return forbidden;
    }

    const draggedTypes = new Set<FoldersEditorItemType>();
    let hasDraggedDefaultFolder = false;
    draggedItemIds.forEach((id: string) => {
      const item = fullFlattenedItems.find(
        (i: FlattenedTreeItem) => i.uuid === id,
      );
      if (item) {
        draggedTypes.add(item.type);
        if (
          item.type === FoldersEditorItemType.Folder &&
          isDefaultFolder(item.uuid)
        ) {
          hasDraggedDefaultFolder = true;
        }
      }
    });

    fullFlattenedItems.forEach((item: FlattenedTreeItem) => {
      if (item.type !== FoldersEditorItemType.Folder) {
        return;
      }

      const itemIsDefaultFolder = isDefaultFolder(item.uuid);

      if (hasDraggedDefaultFolder && !itemIsDefaultFolder) {
        forbidden.add(item.uuid);
        return;
      }

      const isDefaultMetricsFolder =
        item.uuid === DEFAULT_METRICS_FOLDER_UUID && itemIsDefaultFolder;
      const isDefaultColumnsFolder =
        item.uuid === DEFAULT_COLUMNS_FOLDER_UUID && itemIsDefaultFolder;

      if (
        (isDefaultMetricsFolder || isDefaultColumnsFolder) &&
        draggedTypes.has(FoldersEditorItemType.Folder)
      ) {
        forbidden.add(item.uuid);
        return;
      }

      if (
        isDefaultMetricsFolder &&
        draggedTypes.has(FoldersEditorItemType.Column)
      ) {
        forbidden.add(item.uuid);
        return;
      }
      if (
        isDefaultColumnsFolder &&
        draggedTypes.has(FoldersEditorItemType.Metric)
      ) {
        forbidden.add(item.uuid);
      }
    });

    return forbidden;
  }, [draggedItemIds, fullFlattenedItems]);

  return {
    isDragging: activeId !== null,
    activeId,
    draggedItemIds,
    dragOverlayWidth,
    flattenedItems,
    dragOverlayItems,
    forbiddenDropFolderIds,
    currentDropTargetId,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
