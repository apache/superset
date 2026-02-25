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
import { debounce } from 'lodash';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FoldersEditorItemType } from '../types';
import { TreeItem as TreeItemType } from './constants';
import {
  flattenTree,
  buildTree,
  removeChildrenOf,
  serializeForAPI,
} from './treeUtils';
import {
  createFolder,
  resetToDefault,
  ensureDefaultFolders,
  filterItemsBySearch,
} from './folderOperations';
import {
  pointerSensorOptions,
  measuringConfig,
  autoScrollConfig,
} from './sensors';
import { FoldersContainer, FoldersContent } from './styles';
import { FoldersEditorProps } from './types';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useDragHandlers } from './hooks/useDragHandlers';
import { useItemHeights } from './hooks/useItemHeights';
import { useHeightCache } from './hooks/useHeightCache';
import {
  FoldersToolbarComponent,
  ResetConfirmModal,
  DragOverlayContent,
} from './components';
import { VirtualizedTreeList } from './VirtualizedTreeList';

export default function FoldersEditor({
  folders: initialFolders,
  metrics,
  columns,
  onChange,
}: FoldersEditorProps) {
  const { addWarningToast } = useToasts();
  const itemHeights = useItemHeights();
  const heightCache = useHeightCache();

  const [items, setItems] = useState<TreeItemType[]>(() => {
    const ensured = ensureDefaultFolders(initialFolders, metrics, columns);
    return ensured;
  });

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const lastSelectedItemIdRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, pointerSensorOptions));

  const fullFlattenedItems = useMemo(() => flattenTree(items), [items]);

  const collapsedFolderIds = useMemo(() => {
    const result: UniqueIdentifier[] = [];
    for (const { uuid, type, children } of fullFlattenedItems) {
      if (
        type === FoldersEditorItemType.Folder &&
        collapsedIds.has(uuid) &&
        children?.length
      ) {
        result.push(uuid);
      }
    }
    return result;
  }, [fullFlattenedItems, collapsedIds]);

  const computeFlattenedItems = useCallback(
    (activeId: UniqueIdentifier | null) =>
      removeChildrenOf(
        fullFlattenedItems,
        activeId != null
          ? [activeId, ...collapsedFolderIds]
          : collapsedFolderIds,
      ),
    [fullFlattenedItems, collapsedFolderIds],
  );

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

  const metricsMap = useMemo(
    () => new Map(metrics.map(m => [m.uuid, m])),
    [metrics],
  );
  const columnsMap = useMemo(
    () => new Map(columns.map(c => [c.uuid, c])),
    [columns],
  );

  const {
    isDragging,
    activeId,
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
  } = useDragHandlers({
    setItems,
    computeFlattenedItems,
    fullFlattenedItems,
    selectedItemIds,
    onChange,
    addWarningToast,
  });

  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
    }, 300),
    [],
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleAddFolder = () => {
    const newFolder = createFolder('');
    const updatedItems = [newFolder, ...items];
    setItems(updatedItems);
    setEditingFolderId(newFolder.uuid);
    onChange(serializeForAPI(updatedItems));
  };

  const allVisibleSelected = useMemo(() => {
    const selectableItems = Array.from(visibleItemIds).filter(id => {
      const item = fullItemsByUuid.get(id);
      return item && item.type !== FoldersEditorItemType.Folder;
    });
    return (
      selectableItems.length > 0 &&
      selectableItems.every(id => selectedItemIds.has(id))
    );
  }, [fullItemsByUuid, visibleItemIds, selectedItemIds]);

  const handleSelectAll = useCallback(() => {
    const itemsToSelect = new Set(
      Array.from(visibleItemIds).filter(id => {
        const item = fullItemsByUuid.get(id);
        return item && item.type !== FoldersEditorItemType.Folder;
      }),
    );

    if (allVisibleSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(itemsToSelect);
    }
  }, [visibleItemIds, fullItemsByUuid, allVisibleSelected]);

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

  const handleSelect = useCallback(
    (itemId: string, selected: boolean, shiftKey?: boolean) => {
      // Capture ref value before setState to avoid timing issues with React 18 batching
      const lastSelectedId = lastSelectedItemIdRef.current;

      // Update ref immediately for next interaction
      if (selected) {
        lastSelectedItemIdRef.current = itemId;
      }

      setSelectedItemIds(prev => {
        const newSet = new Set(prev);

        // Range selection when shift is held and we have a previous selection
        if (shiftKey && selected && lastSelectedId) {
          const selectableItems = flattenedItems.filter(
            item =>
              item.type !== FoldersEditorItemType.Folder &&
              visibleItemIds.has(item.uuid),
          );

          const currentIndex = selectableItems.findIndex(
            item => item.uuid === itemId,
          );
          const lastIndex = selectableItems.findIndex(
            item => item.uuid === lastSelectedId,
          );

          if (currentIndex !== -1 && lastIndex !== -1) {
            const startIndex = Math.min(currentIndex, lastIndex);
            const endIndex = Math.max(currentIndex, lastIndex);

            for (let i = startIndex; i <= endIndex; i += 1) {
              newSet.add(selectableItems[i].uuid);
            }
          }
        } else if (selected) {
          newSet.add(itemId);
        } else {
          newSet.delete(itemId);
        }

        return newSet;
      });
    },
    [flattenedItems, visibleItemIds],
  );

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

  const lastChildIds = useMemo(() => {
    const lastChildren = new Set<string>();
    const childrenByParent = new Map<string | null, string[]>();

    flattenedItems.forEach(item => {
      const parentKey = item.parentId;
      if (!childrenByParent.has(parentKey)) {
        childrenByParent.set(parentKey, []);
      }
      childrenByParent.get(parentKey)!.push(item.uuid);
    });

    childrenByParent.forEach(children => {
      if (children.length > 0) {
        lastChildren.add(children[children.length - 1]);
      }
    });

    return lastChildren;
  }, [flattenedItems]);

  const itemSeparatorInfo = useMemo(() => {
    const separators = new Map<string, 'visible' | 'transparent'>();

    flattenedItems.forEach((item, index) => {
      if (item.type === FoldersEditorItemType.Folder) {
        return;
      }

      if (!lastChildIds.has(item.uuid)) {
        return;
      }

      const nextItem = flattenedItems[index + 1];
      if (!nextItem) {
        return;
      }

      // Case 1: Next item is a top-level folder (depth 0)
      // This means current item is the last descendant of the previous top-level folder
      // -> Full-width colored separator
      if (
        nextItem.type === FoldersEditorItemType.Folder &&
        nextItem.depth === 0
      ) {
        separators.set(item.uuid, 'visible');
        return;
      }

      // Case 2: Last item of a nested folder followed by a sibling item (not a folder)
      // -> Transparent separator for spacing
      if (
        item.depth > 1 &&
        nextItem.depth < item.depth &&
        nextItem.type !== FoldersEditorItemType.Folder
      ) {
        separators.set(item.uuid, 'transparent');
      }

      // Case 3: Nested folder followed by another nested folder -> no separator
    });

    return separators;
  }, [flattenedItems, lastChildIds]);

  const sortableItemIds = useMemo(
    () => flattenedItems.map(({ uuid }) => uuid),
    [flattenedItems],
  );

  const folderChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    // Initialize all folders with 0
    for (const item of flattenedItems) {
      if (item.type === FoldersEditorItemType.Folder) {
        counts.set(item.uuid, 0);
      }
    }
    // Single pass: count children by parentId
    for (const item of flattenedItems) {
      if (item.parentId && counts.has(item.parentId)) {
        counts.set(item.parentId, counts.get(item.parentId)! + 1);
      }
    }
    return counts;
  }, [flattenedItems]);

  return (
    <FoldersContainer>
      <ResetConfirmModal
        show={showResetConfirm}
        onCancel={handleCancelReset}
        onConfirm={handleConfirmReset}
      />
      <FoldersToolbarComponent
        onSearch={handleSearch}
        onAddFolder={handleAddFolder}
        onSelectAll={handleSelectAll}
        onResetToDefault={handleResetToDefault}
        allVisibleSelected={allVisibleSelected}
      />
      <FoldersContent>
        <DndContext
          sensors={sensors}
          measuring={measuringConfig}
          autoScroll={autoScrollConfig}
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
            <AutoSizer>
              {({ height, width }) => (
                <VirtualizedTreeList
                  width={width}
                  height={height}
                  flattenedItems={flattenedItems}
                  itemHeights={itemHeights}
                  heightCache={heightCache}
                  collapsedIds={collapsedIds}
                  selectedItemIds={selectedItemIds}
                  editingFolderId={editingFolderId}
                  folderChildCounts={folderChildCounts}
                  itemSeparatorInfo={itemSeparatorInfo}
                  visibleItemIds={visibleItemIds}
                  searchTerm={searchTerm}
                  metricsMap={metricsMap}
                  columnsMap={columnsMap}
                  isDragging={isDragging}
                  activeId={activeId}
                  forbiddenDropFolderIds={forbiddenDropFolderIds}
                  currentDropTargetId={currentDropTargetId}
                  onToggleCollapse={handleToggleCollapse}
                  onSelect={handleSelect}
                  onStartEdit={handleStartEdit}
                  onFinishEdit={handleFinishEdit}
                />
              )}
            </AutoSizer>
          </SortableContext>

          <DragOverlay>
            <DragOverlayContent
              dragOverlayItems={dragOverlayItems}
              dragOverlayWidth={dragOverlayWidth}
              selectedItemIds={selectedItemIds}
              metricsMap={metricsMap}
              columnsMap={columnsMap}
            />
          </DragOverlay>
        </DndContext>
      </FoldersContent>
    </FoldersContainer>
  );
}
