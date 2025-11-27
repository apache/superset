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

import { useCallback, useMemo, useState, useRef } from 'react';
import { t } from '@superset-ui/core';
import { Button, Input, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { debounce } from 'lodash';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FoldersEditorItemType } from '../types';
import {
  createFolder,
  resetToDefault,
  ensureDefaultFolders,
  isDefaultFolder,
  filterItemsBySearch,
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from './folderUtils';
import {
  flattenTree,
  buildTree,
  removeChildrenOf,
  getProjection,
  getChildCount,
  serializeForAPI,
  TreeItem as TreeItemType,
  DRAG_INDENTATION_WIDTH,
} from './utilities';
import { pointerSensorOptions, measuringConfig } from './sensors';
import { TreeItem } from './TreeItem';
import {
  FoldersContainer,
  FoldersToolbar,
  FoldersSearch,
  FoldersActions,
  FoldersContent,
  DragOverlayStack,
  DragOverlayItem,
} from './styles';
import { FoldersEditorProps } from './types';
import { useToasts } from 'src/components/MessageToasts/withToasts';

export default function FoldersEditor({
  folders: initialFolders,
  metrics,
  columns,
  onChange,
}: FoldersEditorProps) {
  const { addWarningToast } = useToasts();

  // Initialize state
  const [items, setItems] = useState<TreeItemType[]>(() => {
    const ensured = ensureDefaultFolders(initialFolders, metrics, columns);
    return ensured;
  });

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const offsetLeftRef = useRef(0);
  const [projectedParentId, setProjectedParentId] = useState<string | null>(
    null,
  );
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [draggedItemIds, setDraggedItemIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sensors
  const sensors = useSensors(useSensor(PointerSensor, pointerSensorOptions));

  // Memoize the full flattened tree (used in multiple places)
  const fullFlattenedItems = useMemo(() => flattenTree(items), [items]);

  // Flatten tree with collapsed items filtered out (for display)
  const flattenedItems = useMemo(() => {
    const collapsedItems = fullFlattenedItems.reduce<UniqueIdentifier[]>(
      (acc, { uuid, type, children }) => {
        if (
          type === FoldersEditorItemType.Folder &&
          collapsedIds.has(uuid) &&
          children?.length
        ) {
          return [...acc, uuid];
        }
        return acc;
      },
      [],
    );

    return removeChildrenOf(
      fullFlattenedItems,
      activeId != null ? [activeId, ...collapsedItems] : collapsedItems,
    );
  }, [fullFlattenedItems, collapsedIds, activeId]);

  // Filter for search
  const visibleItemIds = useMemo(() => {
    if (!searchTerm) {
      const allIds = new Set<string>();
      metrics.forEach(m => allIds.add(m.uuid));
      columns.forEach(c => allIds.add(c.uuid));
      return allIds;
    }
    const allItems = [...metrics, ...columns];
    return filterItemsBySearch(searchTerm, allItems);
  }, [searchTerm, metrics, columns]);

  // Create lookup maps for metrics and columns by uuid
  const metricsMap = useMemo(
    () => new Map(metrics.map(m => [m.uuid, m])),
    [metrics],
  );
  const columnsMap = useMemo(
    () => new Map(columns.map(c => [c.uuid, c])),
    [columns],
  );

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
    }, 300),
    [],
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // Toolbar actions
  const handleAddFolder = () => {
    const newFolder = createFolder('');
    const updatedItems = [newFolder, ...items];
    setItems(updatedItems);
    setEditingFolderId(newFolder.uuid);
    onChange(serializeForAPI(updatedItems));
  };

  // Compute whether all visible items are selected
  const allVisibleSelected = useMemo(() => {
    const selectableItems = Array.from(visibleItemIds).filter(id => {
      const item = fullFlattenedItems.find(i => i.uuid === id);
      return item && item.type !== FoldersEditorItemType.Folder;
    });
    return (
      selectableItems.length > 0 &&
      selectableItems.every(id => selectedItemIds.has(id))
    );
  }, [fullFlattenedItems, visibleItemIds, selectedItemIds]);

  const handleSelectAll = () => {
    // Only select metrics and columns (not folders)
    const itemsToSelect = new Set(
      Array.from(visibleItemIds).filter(id => {
        const item = fullFlattenedItems.find(i => i.uuid === id);
        return item && item.type !== FoldersEditorItemType.Folder;
      }),
    );

    if (allVisibleSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(itemsToSelect);
    }
  };

  const handleResetToDefault = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    const resetFolders = resetToDefault(metrics, columns);
    setItems(resetFolders);
    setSelectedItemIds(new Set());
    setEditingFolderId(null);
    setShowResetConfirm(false);
    onChange(serializeForAPI(resetFolders));
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  // Drag handlers
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

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    offsetLeftRef.current = delta.x;

    // Calculate projected parent for visual feedback
    if (activeId && overId) {
      // Handle empty folder drop zones
      let targetOverId = overId;
      if (typeof overId === 'string' && overId.endsWith('-empty')) {
        // For empty drops, the parent is the folder itself
        const folderId = overId.replace('-empty', '');
        setProjectedParentId(prev => (prev === folderId ? prev : folderId));
        return;
      }

      const projection = getProjection(
        flattenedItems,
        activeId,
        targetOverId,
        delta.x,
        DRAG_INDENTATION_WIDTH,
      );
      const newParentId = projection?.parentId ?? null;
      setProjectedParentId(prev => (prev === newParentId ? prev : newParentId));
    }
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over?.id ?? null);

    // Recalculate projection when over target changes
    if (activeId && over) {
      let targetOverId = over.id;
      if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
        const folderId = over.id.replace('-empty', '');
        setProjectedParentId(prev => (prev === folderId ? prev : folderId));
        return;
      }

      const projection = getProjection(
        flattenedItems,
        activeId,
        targetOverId,
        offsetLeftRef.current,
        DRAG_INDENTATION_WIDTH,
      );
      const newParentId = projection?.parentId ?? null;
      setProjectedParentId(prev => (prev === newParentId ? prev : newParentId));
    } else {
      setProjectedParentId(prev => (prev === null ? prev : null));
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const itemsBeingDragged = Array.from(draggedItemIds);
    // Save offsetLeft before resetting state - needed for projection calculation
    const finalOffsetLeft = offsetLeftRef.current;
    resetDragState();

    if (!over) {
      return;
    }

    // Handle drops on empty folder zones (id format: "folderId-empty")
    let overId = over.id;
    let isEmptyDrop = false;
    if (typeof over.id === 'string' && over.id.endsWith('-empty')) {
      overId = over.id.replace('-empty', '');
      isEmptyDrop = true;

      // Prevent dropping a folder into its own empty state
      if (itemsBeingDragged.includes(overId as string)) {
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
      ({ uuid }) => uuid === overId,
    );

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Get all items being dragged
    const draggedItems = fullFlattenedItems.filter(item =>
      itemsBeingDragged.includes(item.uuid),
    );

    // Recalculate projection using the full flattened tree (not the filtered one)
    // The projected value from state uses flattenedItems which excludes active item's children
    // We need to recalculate using fullFlattenedItems for accurate positioning
    let projectedPosition = getProjection(
      fullFlattenedItems,
      active.id,
      overId,
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
        parentId: overId as string,
      };
    }

    // Check if this is a no-op: same position AND same parent (no actual change)
    const activeItem = fullFlattenedItems[activeIndex];
    if (active.id === overId) {
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
      draggedItems.forEach(item => {
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
        fullFlattenedItems.forEach(item => {
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

      draggedItems.forEach(item => {
        if (item.type === FoldersEditorItemType.Folder) {
          collectDescendants(item.uuid, depthChange);
        }
      });

      // Update depths and parentIds
      newItems = fullFlattenedItems.map(item => {
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
    const itemsToMoveIndices: number[] = [];
    const itemsToMoveIds = new Set(itemsBeingDragged);

    // Collect all descendants of dragged folders
    const collectDescendantIds = (parentId: string) => {
      fullFlattenedItems.forEach(item => {
        if (item.parentId === parentId && !itemsToMoveIds.has(item.uuid)) {
          itemsToMoveIds.add(item.uuid);
          if (item.type === FoldersEditorItemType.Folder) {
            collectDescendantIds(item.uuid);
          }
        }
      });
    };

    draggedItems.forEach(item => {
      if (item.type === FoldersEditorItemType.Folder) {
        collectDescendantIds(item.uuid);
      }
    });

    // Find indices of all items to move
    fullFlattenedItems.forEach((item, idx) => {
      if (itemsToMoveIds.has(item.uuid)) {
        itemsToMoveIndices.push(idx);
      }
    });
    itemsToMoveIndices.sort((a, b) => a - b); // Sort to maintain order

    // Remove items to move from the array
    const subtree = itemsToMoveIndices.map(idx => newItems[idx]);
    const remaining = newItems.filter(
      (_, idx) => !itemsToMoveIndices.includes(idx),
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
            item => item.uuid === overId,
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
      itemsToMoveIndices.forEach(idx => {
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

  const resetDragState = () => {
    setActiveId(null);
    setOverId(null);
    offsetLeftRef.current = 0;
    setProjectedParentId(null);
    setDraggedItemIds(new Set());
    setDragOverlayWidth(null);
  };

  // Tree item handlers - memoized to prevent unnecessary re-renders
  const handleToggleCollapse = useCallback((folderId: string) => {
    setCollapsedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleSelect = useCallback((itemId: string, selected: boolean) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const handleStartEdit = useCallback((folderId: string) => {
    setEditingFolderId(folderId);
  }, []);

  const handleFinishEdit = useCallback(
    (folderId: string, newName: string) => {
      if (newName.trim() && newName !== folderId) {
        setItems(prevItems => {
          const flatItems = flattenTree(prevItems);
          const updatedItems = flatItems.map(item => {
            if (item.uuid === folderId) {
              return { ...item, name: newName };
            }
            return item;
          });
          const newTree = buildTree(updatedItems);
          onChange(serializeForAPI(newTree));
          return newTree;
        });
      }
      setEditingFolderId(null);
    },
    [onChange],
  );

  // Get items for drag overlay (max 3 items for stacked display)
  const dragOverlayItems = useMemo(() => {
    if (!activeId || draggedItemIds.size === 0) return [];

    // Get all dragged items in their original order
    const items = fullFlattenedItems.filter(item =>
      draggedItemIds.has(item.uuid),
    );

    // Return max 3 items for stacked display
    return items.slice(0, 3);
  }, [activeId, draggedItemIds, fullFlattenedItems]);

  // Determine which items are the last child of their parent folder
  const lastChildIds = useMemo(() => {
    const lastChildren = new Set<string>();

    // Group items by their parentId
    const childrenByParent = new Map<string | null, string[]>();

    flattenedItems.forEach(item => {
      const parentKey = item.parentId;
      if (!childrenByParent.has(parentKey)) {
        childrenByParent.set(parentKey, []);
      }
      childrenByParent.get(parentKey)!.push(item.uuid);
    });

    // For each parent, mark the last child
    childrenByParent.forEach(children => {
      if (children.length > 0) {
        lastChildren.add(children[children.length - 1]);
      }
    });

    return lastChildren;
  }, [flattenedItems]);

  // Pre-calculate which folders are forbidden drop targets for the current drag
  const forbiddenDropFolderIds = useMemo(() => {
    const forbidden = new Set<string>();
    if (draggedItemIds.size === 0) {
      return forbidden;
    }

    // Get the types of items being dragged
    const draggedTypes = new Set<FoldersEditorItemType>();
    let hasDraggedDefaultFolder = false;
    draggedItemIds.forEach(id => {
      const item = fullFlattenedItems.find(i => i.uuid === id);
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
    fullFlattenedItems.forEach(item => {
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

  // Memoize sortable item IDs for SortableContext
  const sortableItemIds = useMemo(
    () => flattenedItems.map(({ uuid }) => uuid),
    [flattenedItems],
  );

  // Pre-calculate child counts for all folders to avoid calling getChildCount in render loop
  const folderChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    flattenedItems.forEach(item => {
      if (item.type === FoldersEditorItemType.Folder) {
        counts.set(item.uuid, getChildCount(items, item.uuid));
      }
    });
    return counts;
  }, [flattenedItems, items]);

  return (
    <FoldersContainer>
      {/* Reset confirmation modal */}
      <Modal
        title={t('Reset to default folders?')}
        show={showResetConfirm}
        onHide={handleCancelReset}
        onHandledPrimaryAction={handleConfirmReset}
        primaryButtonName={t('Reset')}
        primaryButtonStyle="danger"
      >
        {t(
          'This will reorganize all metrics and columns into default folders. Any custom folders will be removed.',
        )}
      </Modal>
      {/* Toolbar */}
      <FoldersToolbar>
        <FoldersSearch>
          <Input
            placeholder={t('Search all metrics & columns')}
            onChange={handleSearch}
            allowClear
            prefix={<Icons.SearchOutlined />}
          />
        </FoldersSearch>
        <FoldersActions>
          <Button
            buttonStyle="link"
            onClick={handleAddFolder}
            icon={<Icons.PlusOutlined />}
          >
            {t('Add folder')}
          </Button>
          <Button
            buttonStyle="link"
            onClick={handleSelectAll}
            icon={<Icons.CheckOutlined />}
          >
            {allVisibleSelected ? t('Deselect all') : t('Select all')}
          </Button>
          <Button
            buttonStyle="link"
            onClick={handleResetToDefault}
            icon={<Icons.HistoryOutlined />}
          >
            {t('Reset all folders to default')}
          </Button>
        </FoldersActions>
      </FoldersToolbar>

      {/* Content */}
      <FoldersContent>
        <DndContext
          sensors={sensors}
          measuring={measuringConfig}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={sortableItemIds}
            strategy={verticalListSortingStrategy}
          >
            {flattenedItems.map(item => {
              const isFolder = item.type === FoldersEditorItemType.Folder;
              const childCount = isFolder
                ? (folderChildCounts.get(item.uuid) ?? 0)
                : 0;
              const showEmptyState = isFolder && childCount === 0;

              // Hide items that don't match search (unless they're folders)
              if (!isFolder && searchTerm && !visibleItemIds.has(item.uuid)) {
                return null;
              }

              return (
                <TreeItem
                  key={item.uuid}
                  id={item.uuid}
                  type={item.type}
                  name={item.name}
                  depth={item.depth}
                  isFolder={isFolder}
                  isCollapsed={collapsedIds.has(item.uuid)}
                  isSelected={selectedItemIds.has(item.uuid)}
                  isEditing={editingFolderId === item.uuid}
                  isDefaultFolder={isDefaultFolder(item.uuid)}
                  isLastChild={lastChildIds.has(item.uuid)}
                  showEmptyState={showEmptyState}
                  isDropTarget={isFolder && item.uuid === projectedParentId}
                  isForbiddenDrop={
                    isFolder && forbiddenDropFolderIds.has(item.uuid)
                  }
                  onToggleCollapse={isFolder ? handleToggleCollapse : undefined}
                  onSelect={isFolder ? undefined : handleSelect}
                  onStartEdit={isFolder ? handleStartEdit : undefined}
                  onFinishEdit={isFolder ? handleFinishEdit : undefined}
                  metric={metricsMap.get(item.uuid)}
                  column={columnsMap.get(item.uuid)}
                />
              );
            })}
          </SortableContext>

          {/* Drag overlay - stacked items when dragging multiple */}
          <DragOverlay>
            {dragOverlayItems.length > 0 && (
              <DragOverlayStack width={dragOverlayWidth ?? undefined}>
                {/* Render back-to-front: last items first (behind), active item last (front) */}
                {/* This ensures proper DOM order for z-index stacking */}
                {[...dragOverlayItems].reverse().map((item, index) => {
                  // index 0 = last item (back), index n-1 = first item (front)
                  const stackIndex = dragOverlayItems.length - 1 - index;
                  return (
                    <DragOverlayItem
                      key={item.uuid}
                      stackIndex={stackIndex}
                      totalItems={dragOverlayItems.length}
                    >
                      <TreeItem
                        id={item.uuid}
                        type={item.type}
                        name={item.name}
                        depth={0}
                        isFolder={item.type === FoldersEditorItemType.Folder}
                        isOverlay
                        isSelected={selectedItemIds.has(item.uuid)}
                        metric={metricsMap.get(item.uuid)}
                        column={columnsMap.get(item.uuid)}
                      />
                    </DragOverlayItem>
                  );
                })}
              </DragOverlayStack>
            )}
          </DragOverlay>
        </DndContext>
      </FoldersContent>
    </FoldersContainer>
  );
}
