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

import { useCallback, useMemo, useState } from 'react';
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
} from './utilities';
import { pointerSensorOptions, measuringConfig } from './sensors';
import { TreeItem } from './TreeItem';
import {
  FoldersContainer,
  FoldersToolbar,
  FoldersSearch,
  FoldersActions,
  FoldersContent,
} from './styles';
import { FoldersEditorProps } from './types';
import { useToasts } from 'src/components/MessageToasts/withToasts';

const INDENTATION_WIDTH = 32;

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
  const [offsetLeft, setOffsetLeft] = useState(0);
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

    // If dragging a selected item, drag all selected items
    // Otherwise, just drag the single item
    if (selectedItemIds.has(active.id as string)) {
      setDraggedItemIds(new Set(selectedItemIds));
    } else {
      setDraggedItemIds(new Set([active.id as string]));
    }
  };

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    // This handler is kept for potential future use (e.g., visual feedback during drag)
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const itemsBeingDragged = Array.from(draggedItemIds);
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
    }

    if (active.id === overId) {
      return;
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
      offsetLeft,
      INDENTATION_WIDTH,
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
      if (targetFolder) {
        const isDefaultMetricsFolder =
          targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID;
        const isDefaultColumnsFolder =
          targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID;

        // Validate type restrictions for default folders
        // Check if any dragged item violates the folder type restriction
        for (const draggedItem of draggedItems) {
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

    // Use projected depth and parent if available
    let newItems = fullFlattenedItems;

    // Update depth and parent based on projection for all dragged items
    if (projectedPosition) {
      const activeItem = fullFlattenedItems[activeIndex];
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
    setOffsetLeft(0);
    setDraggedItemIds(new Set());
  };

  // Tree item handlers
  const handleToggleCollapse = (folderId: string) => {
    setCollapsedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleSelect = (itemId: string, selected: boolean) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleStartEdit = (folderId: string) => {
    setEditingFolderId(folderId);
  };

  const handleFinishEdit = (folderId: string, newName: string) => {
    if (newName.trim() && newName !== folderId) {
      const updatedItems = flattenedItems.map(item => {
        if (item.uuid === folderId) {
          return { ...item, name: newName };
        }
        return item;
      });
      const newTree = buildTree(updatedItems);
      setItems(newTree);
      onChange(serializeForAPI(newTree));
    }
    setEditingFolderId(null);
  };

  // Get active item for drag overlay
  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return flattenedItems.find(({ uuid }) => uuid === activeId);
  }, [activeId, flattenedItems]);

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

  // Get the types of items being dragged (for forbidden drop visual feedback)
  const draggedItemTypes = useMemo(() => {
    if (draggedItemIds.size === 0) {
      return new Set<FoldersEditorItemType>();
    }
    const types = new Set<FoldersEditorItemType>();
    draggedItemIds.forEach(id => {
      const item = fullFlattenedItems.find(i => i.uuid === id);
      if (item) {
        types.add(item.type);
      }
    });
    return types;
  }, [draggedItemIds, fullFlattenedItems]);

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
            items={flattenedItems.map(({ uuid }) => uuid)}
            strategy={verticalListSortingStrategy}
          >
            {flattenedItems.map(item => {
              const isFolder = item.type === FoldersEditorItemType.Folder;
              const childCount = isFolder ? getChildCount(items, item.uuid) : 0;
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
                  onToggleCollapse={() => handleToggleCollapse(item.uuid)}
                  onSelect={
                    isFolder
                      ? undefined
                      : selected => handleSelect(item.uuid, selected)
                  }
                  onStartEdit={() => handleStartEdit(item.uuid)}
                  onFinishEdit={newName => handleFinishEdit(item.uuid, newName)}
                  metric={metricsMap.get(item.uuid)}
                  column={columnsMap.get(item.uuid)}
                  draggedItemTypes={draggedItemTypes}
                />
              );
            })}
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {activeItem && (
              <div style={{ position: 'relative' }}>
                <TreeItem
                  id={activeItem.uuid}
                  type={activeItem.type}
                  name={
                    draggedItemIds.size > 1
                      ? `${activeItem.name} +${draggedItemIds.size - 1} more`
                      : activeItem.name
                  }
                  depth={0}
                  isFolder={activeItem.type === FoldersEditorItemType.Folder}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </FoldersContent>
    </FoldersContainer>
  );
}
