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
import { t } from '@superset-ui/core';
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
} from '../folderUtils';
import {
  buildTree,
  getProjection,
  serializeForAPI,
  TreeItem as TreeItemType,
  FlattenedTreeItem,
  DRAG_INDENTATION_WIDTH,
} from '../utilities';

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
  const [projectedParentId, setProjectedParentId] = useState<string | null>(
    null,
  );
  const [draggedItemIds, setDraggedItemIds] = useState<Set<string>>(new Set());

  // RAF-based batching for projectedParentId updates
  const pendingParentIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const scheduleProjectedParentUpdate = useCallback(
    (newParentId: string | null) => {
      pendingParentIdRef.current = newParentId;

      // Only schedule if not already scheduled
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          setProjectedParentId(prev =>
            prev === pendingParentIdRef.current
              ? prev
              : pendingParentIdRef.current,
          );
        });
      }
    },
    [],
  );

  // Compute flattened items for display (excludes dragged item's children)
  const flattenedItems = useMemo(
    () => computeFlattenedItems(activeId),
    [computeFlattenedItems, activeId],
  );

  // Build index map for O(1) lookups during drag operations
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
    setProjectedParentId(null);
    setDraggedItemIds(new Set());
    setDragOverlayWidth(null);
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingParentIdRef.current = null;
  }, []);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id);

    // Capture width of the dragged element for the overlay
    const element = active.rect.current.initial;
    if (element) {
      setDragOverlayWidth(element.width);
    }

    // If dragging a selected item, drag all selected items
    // Otherwise, just drag the single item
    if (selectedItemIds.has(active.id as string)) {
      setDraggedItemIds(new Set(selectedItemIds));
    } else {
      setDraggedItemIds(new Set([active.id as string]));
    }
  };

  const handleDragMove = useCallback(
    ({ delta }: DragMoveEvent) => {
      offsetLeftRef.current = delta.x;

      // Calculate projected parent for visual feedback
      if (activeId && overId) {
        // Handle empty folder drop zones
        if (typeof overId === 'string' && overId.endsWith('-empty')) {
          // For empty drops, the parent is the folder itself
          const folderId = overId.replace('-empty', '');
          scheduleProjectedParentUpdate(folderId);
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
        scheduleProjectedParentUpdate(newParentId);
      }
    },
    [
      activeId,
      overId,
      flattenedItems,
      flattenedItemsIndexMap,
      scheduleProjectedParentUpdate,
    ],
  );

  const handleDragOver = useCallback(
    ({ over }: DragOverEvent) => {
      setOverId(over?.id ?? null);

      // Recalculate projection when over target changes
      if (activeId && over) {
        if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
          const folderId = over.id.replace('-empty', '');
          scheduleProjectedParentUpdate(folderId);
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
        scheduleProjectedParentUpdate(newParentId);
      } else {
        scheduleProjectedParentUpdate(null);
      }
    },
    [activeId, flattenedItems, flattenedItemsIndexMap, scheduleProjectedParentUpdate],
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const itemsBeingDragged = Array.from(draggedItemIds);
    // Save offsetLeft before resetting state - needed for projection calculation
    const finalOffsetLeft = offsetLeftRef.current;
    resetDragState();

    if (!over) {
      return;
    }

    // Handle drops on empty folder zones (id format: "folderId-empty")
    let targetOverId = over.id;
    let isEmptyDrop = false;
    if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
      targetOverId = over.id.replace('-empty', '');
      isEmptyDrop = true;

      // Prevent dropping a folder into its own empty state
      if (itemsBeingDragged.includes(targetOverId as string)) {
        return;
      }
    }

    // Use fullFlattenedItems (memoized full tree)
    // The filtered flattenedItems excludes children of active/collapsed items for display
    // But we need all items to properly rebuild the tree
    const activeIndex = fullFlattenedItems.findIndex(
      ({ uuid }) => uuid === active.id,
    );
    const overIndex = fullFlattenedItems.findIndex(
      ({ uuid }) => uuid === targetOverId,
    );

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Get all items being dragged
    const draggedItems = fullFlattenedItems.filter((item: FlattenedTreeItem) =>
      itemsBeingDragged.includes(item.uuid),
    );

    // Recalculate projection using the full flattened tree (not the filtered one)
    // The projected value from state uses flattenedItems which excludes active item's children
    // We need to recalculate using fullFlattenedItems for accurate positioning
    let projectedPosition = getProjection(
      fullFlattenedItems,
      active.id,
      targetOverId,
      finalOffsetLeft,
      DRAG_INDENTATION_WIDTH,
    );

    // If dropping on empty state, force it to be a child of that folder
    if (isEmptyDrop) {
      const targetFolder = fullFlattenedItems[overIndex];
      projectedPosition = {
        depth: targetFolder.depth + 1,
        maxDepth: targetFolder.depth + 1,
        minDepth: targetFolder.depth + 1,
        parentId: targetOverId as string,
      };
    }

    // Check if this is a no-op: same position AND same parent (no actual change)
    const activeItem = fullFlattenedItems[activeIndex];
    if (active.id === targetOverId) {
      // Horizontal drag only - check if parent actually changed
      const newParentId = projectedPosition?.parentId ?? null;
      const currentParentId = activeItem.parentId;
      if (newParentId === currentParentId) {
        // No change in position or parent - nothing to do
        return;
      }
    }

    // Only allow folders at root level - items must be inside folders
    // Check if any of the dragged items is not a folder
    const hasNonFolderItems = draggedItems.some(
      item => item.type !== FoldersEditorItemType.Folder,
    );
    if (hasNonFolderItems) {
      // Check if dropping at root (no parent)
      if (!projectedPosition || !projectedPosition.parentId) {
        // Items can't be dropped at root level
        return;
      }
    }

    // Validate drop based on target folder type restrictions
    if (projectedPosition && projectedPosition.parentId) {
      const targetFolder = fullFlattenedItems.find(
        ({ uuid }) => uuid === projectedPosition.parentId,
      );

      // Check if target is a default folder with type restrictions
      if (targetFolder && isDefaultFolder(targetFolder.uuid)) {
        const isDefaultMetricsFolder =
          targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID;
        const isDefaultColumnsFolder =
          targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID;

        // Validate type restrictions for default folders
        // Check if any dragged item violates the folder type restriction
        for (const draggedItem of draggedItems) {
          // Default folders cannot contain other folders
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

    // Prevent default folders from being nested into other folders
    const hasDraggedDefaultFolder = draggedItems.some(
      item =>
        item.type === FoldersEditorItemType.Folder &&
        isDefaultFolder(item.uuid),
    );
    if (hasDraggedDefaultFolder && projectedPosition?.parentId) {
      addWarningToast(t('Default folders cannot be nested'));
      return;
    }

    // Use projected depth and parent if available
    let newItems = fullFlattenedItems;

    // Update depth and parent based on projection for all dragged items
    if (projectedPosition) {
      const depthChange = projectedPosition.depth - activeItem.depth;

      // Build a set of all items to update (dragged items + their descendants)
      // parentId: null means root level, undefined means don't change parentId
      const itemsToUpdate = new Map<
        string,
        { depth: number; parentId: string | null | undefined }
      >();

      // First, mark all dragged items for update
      draggedItems.forEach((item: FlattenedTreeItem) => {
        if (item.uuid === active.id) {
          // The active item gets the projected position
          // Use null explicitly for root level (parentId: null means root)
          itemsToUpdate.set(item.uuid, {
            depth: projectedPosition.depth,
            parentId: projectedPosition.parentId,
          });
        } else {
          // Other dragged items get the same depth change and parent as active item
          itemsToUpdate.set(item.uuid, {
            depth: item.depth + depthChange,
            parentId: projectedPosition.parentId,
          });
        }
      });

      // Collect descendants of any folders being dragged
      // Descendants keep their existing parentId (only depth changes)
      const collectDescendants = (
        parentId: string,
        parentDepthChange: number,
      ) => {
        fullFlattenedItems.forEach((item: FlattenedTreeItem) => {
          if (item.parentId === parentId && !itemsToUpdate.has(item.uuid)) {
            itemsToUpdate.set(item.uuid, {
              depth: item.depth + parentDepthChange,
              parentId: undefined, // Keep existing parentId
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

      // Update depths and parentIds
      newItems = fullFlattenedItems.map((item: FlattenedTreeItem) => {
        const update = itemsToUpdate.get(item.uuid);
        if (update) {
          // parentId: null means root level, undefined means keep existing parentId
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

    // Extract all items being moved (dragged items + their descendants)
    // IMPORTANT: We need to collect descendants from the ORIGINAL fullFlattenedItems array
    // because newItems may have updated parentIds that break the parent-child relationships
    const itemsToMoveIds = new Set(itemsBeingDragged);

    // Collect all descendants of dragged folders
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

    // Find indices of all items to move
    const itemsToMoveIndices: number[] = [];
    fullFlattenedItems.forEach((item: FlattenedTreeItem, idx: number) => {
      if (itemsToMoveIds.has(item.uuid)) {
        itemsToMoveIndices.push(idx);
      }
    });
    itemsToMoveIndices.sort((a, b) => a - b); // Sort to maintain order

    // Remove items to move from the array
    const subtree = itemsToMoveIndices.map(idx => newItems[idx]);
    const remaining = newItems.filter(
      (_: FlattenedTreeItem, idx: number) => !itemsToMoveIndices.includes(idx),
    );

    // Find the correct insertion point in the remaining items
    // We need to find where to insert based on the projected position
    let insertionIndex = 0;

    if (projectedPosition && projectedPosition.parentId) {
      // Dropping inside a folder - find position within that folder's children
      const parentIndex = remaining.findIndex(
        item => item.uuid === projectedPosition.parentId,
      );

      if (parentIndex !== -1) {
        // For empty drops, insert right after the parent folder
        if (isEmptyDrop) {
          insertionIndex = parentIndex + 1;
        } else {
          // Find where the overItem is in the remaining items
          const overItemInRemaining = remaining.findIndex(
            item => item.uuid === targetOverId,
          );

          if (overItemInRemaining !== -1) {
            const overItem = remaining[overItemInRemaining];

            // Check if we're trying to position relative to a sibling in the same parent
            if (overItem.parentId === projectedPosition.parentId) {
              // Same parent - the projection used arrayMove which places item AT overIndex
              // After removing the active item, we need to insert at the position
              // that matches what arrayMove did
              // If dragging down (activeIndex < overIndex), item goes after overItem
              // If dragging up (activeIndex > overIndex), item goes before overItem
              if (activeIndex < overIndex) {
                // Dragging down - insert after the overItem
                insertionIndex = overItemInRemaining + 1;
              } else {
                // Dragging up - insert before the overItem
                insertionIndex = overItemInRemaining;
              }
            } else if (projectedPosition.depth > overItem.depth) {
              // Nesting deeper - insert after to become child
              insertionIndex = overItemInRemaining + 1;
            } else {
              // Different parent or depth - insert after
              insertionIndex = overItemInRemaining + 1;
            }
          } else {
            // Over item was part of the subtree we removed, insert after parent
            insertionIndex = parentIndex + 1;
          }
        }
      }
    } else {
      // Dropping at root level
      // Calculate adjusted overIndex (accounting for removed items)
      let adjustedOverIndex = overIndex;
      itemsToMoveIndices.forEach((idx: number) => {
        if (idx < overIndex) {
          adjustedOverIndex -= 1;
        }
      });
      insertionIndex = adjustedOverIndex;
    }

    // Insert subtree at calculated position
    const sortedItems = [
      ...remaining.slice(0, insertionIndex),
      ...subtree,
      ...remaining.slice(insertionIndex),
    ];

    // Rebuild tree
    const newTree = buildTree(sortedItems);
    setItems(newTree);
    onChange(serializeForAPI(newTree));
  };

  const handleDragCancel = () => {
    resetDragState();
  };

  // Get items for drag overlay (max 3 items for stacked display)
  const dragOverlayItems = useMemo(() => {
    if (!activeId || draggedItemIds.size === 0) return [];

    // Get all dragged items in their original order
    const draggedItems = fullFlattenedItems.filter((item: FlattenedTreeItem) =>
      draggedItemIds.has(item.uuid),
    );

    // Return max 3 items for stacked display
    return draggedItems.slice(0, 3);
  }, [activeId, draggedItemIds, fullFlattenedItems]);

  // Pre-calculate which folders are forbidden drop targets for the current drag
  const forbiddenDropFolderIds = useMemo(() => {
    const forbidden = new Set<string>();
    if (draggedItemIds.size === 0) {
      return forbidden;
    }

    // Get the types of items being dragged
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

    // Check each folder to see if it's a forbidden drop target
    fullFlattenedItems.forEach((item: FlattenedTreeItem) => {
      if (item.type !== FoldersEditorItemType.Folder) {
        return;
      }

      const itemIsDefaultFolder = isDefaultFolder(item.uuid);

      // If dragging a default folder, it cannot be nested into any other folder
      if (hasDraggedDefaultFolder && !itemIsDefaultFolder) {
        forbidden.add(item.uuid);
        return;
      }

      const isDefaultMetricsFolder =
        item.uuid === DEFAULT_METRICS_FOLDER_UUID && itemIsDefaultFolder;
      const isDefaultColumnsFolder =
        item.uuid === DEFAULT_COLUMNS_FOLDER_UUID && itemIsDefaultFolder;

      // Default folders cannot accept any folders
      if (
        (isDefaultMetricsFolder || isDefaultColumnsFolder) &&
        draggedTypes.has(FoldersEditorItemType.Folder)
      ) {
        forbidden.add(item.uuid);
        return;
      }

      // Check if any dragged item violates the folder type restriction
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
    dragOverlayWidth,
    projectedParentId,
    flattenedItems,
    dragOverlayItems,
    forbiddenDropFolderIds,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
