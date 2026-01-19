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
  getChildCount,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, pointerSensorOptions));

  const fullFlattenedItems = useMemo(() => flattenTree(items), [items]);

  const collapsedFolderIds = useMemo(
    () =>
      fullFlattenedItems.reduce<UniqueIdentifier[]>(
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
      ),
    [fullFlattenedItems, collapsedIds],
  );

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
    draggedItemIds,
    dragOverlayWidth,
    flattenedItems,
    dragOverlayItems,
    forbiddenDropFolderIds,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDragHandlers({
    items,
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
      const item = fullFlattenedItems.find(i => i.uuid === id);
      return item && item.type !== FoldersEditorItemType.Folder;
    });
    return (
      selectableItems.length > 0 &&
      selectableItems.every(id => selectedItemIds.has(id))
    );
  }, [fullFlattenedItems, visibleItemIds, selectedItemIds]);

  const handleSelectAll = () => {
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
    flattenedItems.forEach(item => {
      if (item.type === FoldersEditorItemType.Folder) {
        counts.set(item.uuid, getChildCount(items, item.uuid));
      }
    });
    return counts;
  }, [flattenedItems, items]);

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
