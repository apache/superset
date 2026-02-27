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
  MAX_DEPTH,
} from '../constants';
import { buildTree, getProjection, serializeForAPI } from '../treeUtils';

interface UseDragHandlersProps {
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

  // Shared lookup maps for O(1) access - used by handleDragEnd and forbiddenDropFolderIds
  const fullItemsByUuid = useMemo(() => {
    const map = new Map<string, FlattenedTreeItem>();
    fullFlattenedItems.forEach(item => {
      map.set(item.uuid, item);
    });
    return map;
  }, [fullFlattenedItems]);

  const fullItemsIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    fullFlattenedItems.forEach((item, index) => {
      map.set(item.uuid, index);
    });
    return map;
  }, [fullFlattenedItems]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, FlattenedTreeItem[]>();
    fullFlattenedItems.forEach(item => {
      if (item.parentId) {
        const children = map.get(item.parentId) ?? [];
        children.push(item);
        map.set(item.parentId, children);
      }
    });
    return map;
  }, [fullFlattenedItems]);

  // Shared helper to calculate max folder descendant depth
  // Only counts folder depths, not items (columns/metrics)
  const getMaxFolderDescendantDepth = useCallback(
    (parentId: string, baseDepth: number): number => {
      const children = childrenByParentId.get(parentId);
      if (!children || children.length === 0) {
        return baseDepth;
      }
      let maxDepth = baseDepth;
      for (const child of children) {
        if (child.type === FoldersEditorItemType.Folder) {
          maxDepth = Math.max(maxDepth, child.depth);
          maxDepth = Math.max(
            maxDepth,
            getMaxFolderDescendantDepth(child.uuid, child.depth),
          );
        }
      }
      return maxDepth;
    },
    [childrenByParentId],
  );

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
    [activeId, overId, flattenedItems, flattenedItemsIndexMap],
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
    [activeId, flattenedItems, flattenedItemsIndexMap],
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

    const activeIndex = fullItemsIndexMap.get(active.id as string) ?? -1;
    const overIndex = fullItemsIndexMap.get(targetOverId as string) ?? -1;

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Use Set for O(1) lookup instead of Array.includes
    const itemsBeingDraggedSet = new Set(itemsBeingDragged);
    const draggedItems = fullFlattenedItems.filter((item: FlattenedTreeItem) =>
      itemsBeingDraggedSet.has(item.uuid),
    );

    let projectedPosition = getProjection(
      flattenedItems,
      active.id,
      targetOverId,
      finalOffsetLeft,
      DRAG_INDENTATION_WIDTH,
      flattenedItemsIndexMap,
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

    // Single pass to gather info about dragged items
    let hasNonFolderItems = false;
    let hasDraggedFolder = false;
    let hasDraggedDefaultFolder = false;
    let hasDraggedColumn = false;
    let hasDraggedMetric = false;
    for (const item of draggedItems) {
      if (item.type === FoldersEditorItemType.Folder) {
        hasDraggedFolder = true;
        if (isDefaultFolder(item.uuid)) {
          hasDraggedDefaultFolder = true;
        }
      } else {
        hasNonFolderItems = true;
        if (item.type === FoldersEditorItemType.Column) {
          hasDraggedColumn = true;
        }
        if (item.type === FoldersEditorItemType.Metric) {
          hasDraggedMetric = true;
        }
      }
    }

    if (hasNonFolderItems) {
      if (!projectedPosition || !projectedPosition.parentId) {
        if (hasDraggedColumn && hasDraggedMetric) {
          addWarningToast(t('Columns and metrics should be inside folders'));
        } else if (hasDraggedColumn) {
          addWarningToast(t('Columns should be inside folders'));
        } else {
          addWarningToast(t('Metrics should be inside folders'));
        }
        return;
      }
    }

    if (projectedPosition && projectedPosition.parentId) {
      const targetFolder = fullItemsByUuid.get(projectedPosition.parentId);

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
            addWarningToast(t('This folder only supports metrics'));
            return;
          }
          if (
            isDefaultColumnsFolder &&
            draggedItem.type === FoldersEditorItemType.Metric
          ) {
            addWarningToast(t('This folder only supports columns'));
            return;
          }
        }
      }
    }

    if (hasDraggedDefaultFolder && projectedPosition?.parentId) {
      addWarningToast(t('Default folders cannot be nested'));
      return;
    }

    // Check max depth for folders
    if (hasDraggedFolder && projectedPosition) {
      for (const draggedItem of draggedItems) {
        if (draggedItem.type === FoldersEditorItemType.Folder) {
          const currentDepth = draggedItem.depth;
          const maxFolderDescendantDepth = getMaxFolderDescendantDepth(
            draggedItem.uuid,
            currentDepth,
          );
          const descendantDepthOffset = maxFolderDescendantDepth - currentDepth;
          const newDepth = projectedPosition.depth;
          const newMaxDescendantDepth = newDepth + descendantDepthOffset;

          // MAX_DEPTH is 3, meaning we allow depths 0, 1, 2 (3 levels total)
          if (newMaxDescendantDepth >= MAX_DEPTH) {
            addWarningToast(t('Maximum folder nesting depth reached'));
            return;
          }
        }
      }
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
        const children = childrenByParentId.get(parentId);
        if (!children) return;
        for (const item of children) {
          if (!itemsToUpdate.has(item.uuid)) {
            itemsToUpdate.set(item.uuid, {
              depth: item.depth + parentDepthChange,
              parentId: undefined,
            });
            if (item.type === FoldersEditorItemType.Folder) {
              collectDescendants(item.uuid, parentDepthChange);
            }
          }
        }
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
      const children = childrenByParentId.get(parentId);
      if (!children) return;
      for (const item of children) {
        if (!itemsToMoveIds.has(item.uuid)) {
          itemsToMoveIds.add(item.uuid);
          if (item.type === FoldersEditorItemType.Folder) {
            collectDescendantIds(item.uuid);
          }
        }
      }
    };

    draggedItems.forEach((item: FlattenedTreeItem) => {
      if (item.type === FoldersEditorItemType.Folder) {
        collectDescendantIds(item.uuid);
      }
    });

    // Indices are already in ascending order since we iterate fullFlattenedItems sequentially
    const itemsToMoveIndices: number[] = [];
    fullFlattenedItems.forEach((item: FlattenedTreeItem, idx: number) => {
      if (itemsToMoveIds.has(item.uuid)) {
        itemsToMoveIndices.push(idx);
      }
    });

    const subtree = itemsToMoveIndices.map(idx => newItems[idx]);
    const itemsToMoveIndicesSet = new Set(itemsToMoveIndices);
    const remaining = newItems.filter(
      (_: FlattenedTreeItem, idx: number) => !itemsToMoveIndicesSet.has(idx),
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
    let maxDraggedFolderDescendantOffset = 0;

    draggedItemIds.forEach((id: string) => {
      const item = fullItemsByUuid.get(id);
      if (item) {
        draggedTypes.add(item.type);
        if (
          item.type === FoldersEditorItemType.Folder &&
          isDefaultFolder(item.uuid)
        ) {
          hasDraggedDefaultFolder = true;
        }
        // Track the deepest folder descendant offset for dragged folders
        if (item.type === FoldersEditorItemType.Folder) {
          const maxDescendantDepth = getMaxFolderDescendantDepth(
            item.uuid,
            item.depth,
          );
          const descendantOffset = maxDescendantDepth - item.depth;
          maxDraggedFolderDescendantOffset = Math.max(
            maxDraggedFolderDescendantOffset,
            descendantOffset,
          );
        }
      }
    });

    const hasDraggedFolder = draggedTypes.has(FoldersEditorItemType.Folder);

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
        hasDraggedFolder
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
        return;
      }

      // Check max depth for folders: dropping into this folder would put the item at depth + 1
      // If that would exceed MAX_DEPTH - 1 (accounting for descendants), forbid it
      if (hasDraggedFolder) {
        const newFolderDepth = item.depth + 1;
        const newMaxDescendantDepth =
          newFolderDepth + maxDraggedFolderDescendantOffset;
        if (newMaxDescendantDepth >= MAX_DEPTH) {
          forbidden.add(item.uuid);
        }
      }
    });

    return forbidden;
  }, [
    draggedItemIds,
    fullFlattenedItems,
    fullItemsByUuid,
    getMaxFolderDescendantDepth,
  ]);

  return {
    isDragging: activeId !== null,
    activeId,
    draggedItemIds,
    dragOverlayWidth,
    flattenedItems,
    dragOverlayItems,
    forbiddenDropFolderIds,
    currentDropTargetId,
    fullItemsByUuid,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
