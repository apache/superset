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

import { CSSProperties, memo } from 'react';
import type { ListChildComponentProps } from 'react-window';
import { useDroppable } from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { FoldersEditorItemType } from '../types';
import type { FlattenedTreeItem } from './constants';
import { isDefaultFolder } from './constants';
import { TreeItem } from './TreeItem';

// Invisible placeholder that keeps the droppable area for horizontal drag depth changes
interface DragPlaceholderProps {
  id: string;
  style: CSSProperties;
  type: FoldersEditorItemType;
  isFolder: boolean;
}

const DragPlaceholder = memo(function DragPlaceholder({
  id,
  style,
  type,
  isFolder,
}: DragPlaceholderProps) {
  const { setNodeRef } = useDroppable({
    id,
    data: { type, isFolder },
  });

  return <div ref={setNodeRef} style={{ ...style, visibility: 'hidden' }} />;
});

export interface VirtualizedTreeItemData {
  flattenedItems: FlattenedTreeItem[];
  collapsedIds: Set<string>;
  selectedItemIds: Set<string>;
  editingFolderId: string | null;
  folderChildCounts: Map<string, number>;
  itemSeparatorInfo: Map<string, 'visible' | 'transparent'>;
  visibleItemIds: Set<string>;
  searchTerm: string;
  metricsMap: Map<string, Metric>;
  columnsMap: Map<string, ColumnMeta>;
  activeId: UniqueIdentifier | null;
  draggedFolderChildIds: Set<string>;
  forbiddenDropFolderIds: Set<string>;
  currentDropTargetId: string | null;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string, selected: boolean, shiftKey?: boolean) => void;
  onStartEdit: (id: string) => void;
  onFinishEdit: (id: string, newName: string) => void;
}

// Inner component that receives state as props for proper memoization
interface TreeItemWrapperProps {
  item: FlattenedTreeItem;
  style: CSSProperties;
  isFolder: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  isEditing: boolean;
  showEmptyState: boolean;
  separatorType?: 'visible' | 'transparent';
  isForbiddenDrop: boolean;
  isDropTarget: boolean;
  metric?: Metric;
  column?: ColumnMeta;
  onToggleCollapse?: (id: string) => void;
  onSelect?: (id: string, selected: boolean, shiftKey?: boolean) => void;
  onStartEdit?: (id: string) => void;
  onFinishEdit?: (id: string, newName: string) => void;
}

const TreeItemWrapper = memo(function TreeItemWrapper({
  item,
  style,
  isFolder,
  isCollapsed,
  isSelected,
  isEditing,
  showEmptyState,
  separatorType,
  isForbiddenDrop,
  isDropTarget,
  metric,
  column,
  onToggleCollapse,
  onSelect,
  onStartEdit,
  onFinishEdit,
}: TreeItemWrapperProps) {
  return (
    <div style={style}>
      <TreeItem
        id={item.uuid}
        type={item.type}
        name={item.name}
        depth={item.depth}
        isFolder={isFolder}
        isCollapsed={isCollapsed}
        isSelected={isSelected}
        isEditing={isEditing}
        isDefaultFolder={isDefaultFolder(item.uuid)}
        showEmptyState={showEmptyState}
        separatorType={separatorType}
        isForbiddenDrop={isForbiddenDrop}
        isDropTarget={isDropTarget}
        onToggleCollapse={onToggleCollapse}
        onSelect={onSelect}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        metric={metric}
        column={column}
      />
    </div>
  );
});

function VirtualizedTreeItemComponent({
  index,
  style,
  data,
}: ListChildComponentProps<VirtualizedTreeItemData>) {
  const {
    flattenedItems,
    collapsedIds,
    selectedItemIds,
    editingFolderId,
    folderChildCounts,
    itemSeparatorInfo,
    visibleItemIds,
    searchTerm,
    metricsMap,
    columnsMap,
    activeId,
    draggedFolderChildIds,
    forbiddenDropFolderIds,
    currentDropTargetId,
    onToggleCollapse,
    onSelect,
    onStartEdit,
    onFinishEdit,
  } = data;

  const item = flattenedItems[index];

  if (!item) {
    return null;
  }

  const isFolder = item.type === FoldersEditorItemType.Folder;

  // Hide items that don't match search (unless they're folders)
  if (!isFolder && searchTerm && !visibleItemIds.has(item.uuid)) {
    return null;
  }

  // Render invisible placeholder for active dragged item - keeps droppable area
  // for horizontal drag depth changes while visual is in DragOverlay
  if (activeId === item.uuid) {
    return (
      <DragPlaceholder
        id={item.uuid}
        style={style}
        type={item.type}
        isFolder={isFolder}
      />
    );
  }

  // Hidden descendants of the dragged folder — not droppable.
  // handleDragEnd uses lastValidOverIdRef when dropping in this dead zone.
  if (draggedFolderChildIds.has(item.uuid)) {
    return <div style={{ ...style, visibility: 'hidden' }} />;
  }

  const childCount = isFolder ? (folderChildCounts.get(item.uuid) ?? 0) : 0;
  const showEmptyState = isFolder && childCount === 0;

  // isForbiddenDrop is calculated from props (changes when dragged items change)
  const isForbiddenDrop = isFolder && forbiddenDropFolderIds.has(item.uuid);

  // isDropTarget indicates this folder is the current drop target
  const isDropTarget = isFolder && currentDropTargetId === item.uuid;

  return (
    <TreeItemWrapper
      key={item.uuid}
      item={item}
      style={style}
      isFolder={isFolder}
      isCollapsed={collapsedIds.has(item.uuid)}
      isSelected={selectedItemIds.has(item.uuid)}
      isEditing={editingFolderId === item.uuid}
      showEmptyState={showEmptyState}
      separatorType={itemSeparatorInfo.get(item.uuid)}
      isForbiddenDrop={isForbiddenDrop}
      isDropTarget={isDropTarget}
      metric={metricsMap.get(item.uuid)}
      column={columnsMap.get(item.uuid)}
      onToggleCollapse={isFolder ? onToggleCollapse : undefined}
      onSelect={isFolder ? undefined : onSelect}
      onStartEdit={isFolder ? onStartEdit : undefined}
      onFinishEdit={isFolder ? onFinishEdit : undefined}
    />
  );
}

export const VirtualizedTreeItem = memo(VirtualizedTreeItemComponent);
