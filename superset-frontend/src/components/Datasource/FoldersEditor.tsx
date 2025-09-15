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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { styled, t, css } from '@superset-ui/core';
import {
  Button,
  Input,
  Modal,
  Checkbox,
  Icons,
} from '@superset-ui/core/components';
import { Metric } from '@superset-ui/chart-controls';
import { debounce } from 'lodash';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  CollisionDetection,
  getFirstCollision,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import {
  createFolder,
  resetToDefault,
  moveItems,
  renameFolder,
  nestFolder,
  filterItemsBySearch,
  canDropFolder,
  canDropItems,
  ensureDefaultFolders,
  isDefaultFolder,
} from './folderUtils';

const FoldersContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 600px;
  position: relative;
`;

const FoldersToolbar = styled.div`
  ${({ theme }) => `
    position: sticky;
    top: 0;
    z-index: 10;
    background: ${theme.colorBgContainer};
    padding: ${theme.paddingLG}px;
    border-bottom: 1px solid ${theme.colorBorder};
    display: flex;
    flex-direction: column;
    gap: ${theme.paddingLG}px;
  `}
`;

const FoldersSearch = styled.div`
  width: 100%;
`;

const FoldersActions = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.paddingSM}px;
  `}
`;

const FoldersContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.paddingLG}px;
`;

const FolderContainer = styled.div<{ isNested?: boolean }>`
  margin-bottom: ${({ theme }) => theme.paddingLG}px;
  ${({ isNested, theme }) =>
    isNested &&
    css`
      margin-left: ${theme.paddingLG}px;
      margin-bottom: ${theme.paddingMD}px;
    `}
`;

const FolderHeader = styled.div<{
  isEditable: boolean;
  isDragOver?: boolean;
  isDragging?: boolean;
  canAcceptDrop?: boolean;
}>`
  ${({ theme, isEditable, isDragOver, isDragging, canAcceptDrop }) => css`
    padding: ${theme.paddingSM}px ${theme.paddingMD}px;
    background: ${theme.colorBgContainerDisabled};
    border-radius: ${theme.borderRadius}px;
    margin-bottom: ${theme.paddingSM}px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition:
      background 0.15s ease-in-out,
      border 0.15s ease-in-out;
    user-select: none;
    border: 2px solid transparent;
    opacity: ${isDragging ? 0.5 : 1};

    &:hover {
      background: ${theme.colorBgTextHover};
    }

    ${isDragOver &&
    canAcceptDrop &&
    css`
      background: ${theme.colorPrimaryBg};
      border-color: ${theme.colorPrimary};
      box-shadow: 0 0 0 1px ${theme.colorPrimary};
    `}

    ${isDragOver &&
    !canAcceptDrop &&
    css`
      background: ${theme.colorErrorBg};
      border-color: ${theme.colorError};
      opacity: 0.5;
    `}
  `}
`;

const FolderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.paddingSM}px;
`;

const FolderContent = styled.div`
  margin-left: ${({ theme }) => theme.paddingLG}px;
  min-height: 20px;
`;

const FolderItem = styled.div<{ isDraggable?: boolean; isDragging?: boolean }>`
  ${({ theme, isDraggable, isDragging }) => css`
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    display: flex;
    align-items: center;
    gap: ${theme.paddingSM}px;
    border-radius: ${theme.borderRadius}px;
    transition: background 0.15s ease-in-out;
    cursor: ${isDraggable ? 'grab' : 'default'};
    opacity: ${isDragging ? 0.5 : 1};
    user-select: none;

    &:hover {
      background: ${theme.colorBgTextHover};
    }

    &:active {
      cursor: ${isDraggable ? 'grabbing' : 'default'};
    }
  `}
`;

const EmptyFolderState = styled.div`
  ${({ theme }) => css`
    padding: ${theme.paddingLG}px;
    text-align: center;
    color: ${theme.colorTextTertiary};
  `}
`;

const FolderIcon = styled.div`
  font-size: 48px;
  margin-bottom: ${({ theme }) => theme.paddingSM}px;
  color: ${({ theme }) => theme.colorTextTertiary};
`;

const ItemCount = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const DragHandle = styled.span`
  ${({ theme }) => css`
    cursor: grab;
    color: ${theme.colorTextTertiary};
    margin-right: ${theme.paddingXS}px;
    display: inline-flex;
    align-items: center;

    &:hover {
      color: ${theme.colorText};
    }

    &:active {
      cursor: grabbing;
    }
  `}
`;

const DragOverlayContent = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBgContainer};
    border: 2px solid ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    display: flex;
    align-items: center;
    gap: ${theme.paddingSM}px;
    pointer-events: none;
    z-index: 9999;
  `}
`;

const DragBadge = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorPrimary};
    color: ${theme.colorBgContainer};
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${theme.fontSizeXS}px;
    font-weight: 600;
    margin-left: ${theme.paddingSM}px;
  `}
`;

const EmptyFolderSubText = styled.div`
  ${({ theme }) => css`
    margin-top: 8px;
    font-size: ${theme.fontSizeXS}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const EmptyFolderMainText = styled.div`
  font-weight: 500;
`;

export interface Column {
  uuid: string;
  column_name: string;
  description?: string | null;
  type?: string;
  expression?: string | null;
  is_dttm?: boolean | null;
  is_certified?: number | null;
}

export interface FoldersEditorProps {
  folders: DatasourceFolder[];
  metrics: Metric[];
  columns: Column[];
  onChange: (folders: DatasourceFolder[]) => void;
  isEditMode: boolean;
}

interface DragState {
  activeId: UniqueIdentifier | null;
  draggedType: 'folder' | 'item' | null;
  draggedItems: string[];
  overId: UniqueIdentifier | null;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
  onSelect: (selected: boolean) => void;
  isSelected: boolean;
}

const SortableItem = ({
  id,
  children,
  isDragging,
  onSelect,
  isSelected,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      data: {
        type: 'item',
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FolderItem isDraggable isDragging={isDragging}>
        <Checkbox
          checked={isSelected}
          onChange={(e: any) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          onClick={(e: any) => e.stopPropagation()}
        />
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {children}
        </div>
      </FolderItem>
    </div>
  );
};

interface SortableFolderProps {
  folder: DatasourceFolder;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onNameChange: (name: string) => void;
  isDragOver: boolean;
  canAcceptDrop: boolean;
  visibleItemIds: Set<string>;
  children: React.ReactNode;
  isNested?: boolean;
}

const SortableFolder = ({
  folder,
  isExpanded,
  isEditing,
  onToggle,
  onEdit,
  onNameChange,
  isDragOver,
  canAcceptDrop,
  visibleItemIds,
  children,
  isNested,
}: SortableFolderProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: folder.uuid,
    data: {
      type: 'folder',
      children: folder.children,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <FolderContainer ref={setNodeRef} style={style} isNested={isNested}>
      <FolderHeader
        isEditable={!isDefaultFolder(folder.name)}
        isDragOver={isDragOver}
        isDragging={isDragging}
        canAcceptDrop={canAcceptDrop}
        onClick={onToggle}
      >
        <FolderTitle>
          <DragHandle
            {...attributes}
            {...listeners}
            title="Drag to reorder or nest"
            onClick={(e: any) => e.stopPropagation()}
          >
            ≡
          </DragHandle>
          {isExpanded ? (
            <Icons.CaretDownOutlined />
          ) : (
            <Icons.CaretRightOutlined />
          )}
          <Icons.FolderOutlined />
          {isEditing ? (
            <Input
              size="small"
              defaultValue={folder.name}
              onPressEnter={(e: any) => onNameChange(e.target.value)}
              onBlur={(e: any) => onNameChange(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  onNameChange(folder.name);
                }
              }}
              onClick={(e: any) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              role="button"
              tabIndex={isDefaultFolder(folder.name) ? -1 : 0}
              onClick={e => {
                e.stopPropagation();
                if (!isDefaultFolder(folder.name)) {
                  onEdit();
                }
              }}
              onKeyDown={e => {
                if (
                  (e.key === 'Enter' || e.key === ' ') &&
                  !isDefaultFolder(folder.name)
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }
              }}
            >
              {folder.name}
            </span>
          )}
        </FolderTitle>
        <ItemCount>
          {folder.children?.filter(child => visibleItemIds.has(child.uuid))
            .length || 0}{' '}
          items
        </ItemCount>
      </FolderHeader>
      {children}
    </FolderContainer>
  );
};

const FoldersEditor = ({
  folders: initialFolders,
  metrics,
  columns,
  onChange,
}: FoldersEditorProps) => {
  const [folders, setFolders] = useState<DatasourceFolder[]>(() =>
    ensureDefaultFolders(initialFolders, metrics, columns),
  );

  const folderIds = useMemo(
    () => folders.map(folder => folder.uuid as UniqueIdentifier),
    [folders],
  );
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(folders.map(f => f.uuid)),
  );
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    draggedType: null,
    draggedItems: [],
    overId: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [folders]);

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
    const newFolder = createFolder(t('New Folder'));
    const updatedFolders = [newFolder, ...folders];
    setFolders(updatedFolders);
    setExpandedFolderIds(prev => new Set([...prev, newFolder.uuid]));
    setEditingFolderId(newFolder.uuid);
    onChange(updatedFolders);
  };

  const handleSelectAll = () => {
    const itemsToSelect = new Set(visibleItemIds);
    const allVisibleSelected = Array.from(itemsToSelect).every(id =>
      selectedItemIds.has(id),
    );

    if (allVisibleSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(itemsToSelect);
    }
  };

  const handleResetToDefault = () => {
    Modal.confirm({
      title: t('Reset all folders to default?'),
      content: t(
        'This will reorganize all metrics and columns into their default folders and remove all custom folders.',
      ),
      onOk: () => {
        const defaultFolders = resetToDefault(metrics, columns);
        setFolders(defaultFolders);
        setExpandedFolderIds(new Set(defaultFolders.map(f => f.uuid)));
        setSelectedItemIds(new Set());
        onChange([]);
      },
    });
  };

  const handleFolderToggle = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleFolderEdit = (folderId: string) => {
    setEditingFolderId(folderId);
  };

  const handleFolderNameChange = (folderId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setEditingFolderId(null);
      return;
    }

    const updatedFolders = renameFolder(folderId, trimmedName, folders);
    setFolders(updatedFolders);
    setEditingFolderId(null);
    onChange(updatedFolders);
  };

  const handleItemSelect = (itemId: string, selected: boolean) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    const activeData = active.data.current;

    // Check if dragging a folder
    if (activeData?.type === 'folder') {
      setDragState({
        activeId,
        draggedType: 'folder',
        draggedItems: [],
        overId: null,
      });
    } else {
      // Dragging items
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

    if (activeFolder.uuid !== overFolder.uuid) {
      setFolders(prevFolders => {
        if (recentlyMovedToNewContainer.current) {
          return prevFolders;
        }
        if (overFolder.uuid !== dragState.overId) {
          setDragState(prev => ({
            ...prev,
            overId: overFolder.uuid || null,
          }));
        }
        const activeItems = activeFolder.children || [];
        const overItems = overFolder.children || [];
        const overIndex = overItems.findIndex(item => item.uuid === overId);
        const activeIndex = activeItems.findIndex(
          item => item.uuid === active.id,
        );

        let newIndex: number;
        if (overId && folderIds.includes(overId)) {
          newIndex = overItems.length;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top >
              over.rect.top + over.rect.height;
          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
        }
        recentlyMovedToNewContainer.current = true;
        const newFolders = [...prevFolders];
        newFolders[newFolders.findIndex(f => f.uuid === activeFolder.uuid)] = {
          ...activeFolder,
          children: activeItems.filter(item => item.uuid !== active.id),
        };
        newFolders[newFolders.findIndex(f => f.uuid === overFolder.uuid)] = {
          ...overFolder,
          children: [
            ...overItems.slice(0, newIndex),
            activeItems[activeIndex],
            ...overItems.slice(newIndex),
          ],
        };
        return newFolders;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (folderIds.includes(active.id) && over?.id) {
      onChange(folders);
    }

    const activeContainer = folders.find(
      folder =>
        folder.uuid === active.id ||
        folder.children?.some(item => item.uuid === active.id),
    );

    if (!activeContainer) {
      setDragState({
        activeId: null,
        draggedType: null,
        draggedItems: [],
        overId: null,
      });
      return;
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

    const overContainer = folders.find(
      folder =>
        folder.uuid === overId ||
        folder.children?.some(item => item.uuid === overId),
    );

    if (overContainer) {
      const activeIndex =
        activeContainer.children?.findIndex(item => item.uuid === active.id) ??
        -1;
      const overIndex =
        overContainer.children?.length === 0
          ? 0
          : overContainer.children?.findIndex(item => item.uuid === overId) ||
            0;

      if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
        const updatedFolders = folders.map(f =>
          f.uuid === overContainer.uuid
            ? {
                ...f,
                children: arrayMove(
                  overContainer.children || [],
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
    }

    setDragState({
      activeId: null,
      draggedType: null,
      draggedItems: [],
      overId: null,
    });
  };

  // Check if a folder can accept the current drag
  const canAcceptCurrentDrag = (folderId: string) => {
    if (dragState.draggedType === 'folder') {
      return canDropFolder(dragState.activeId!, folderId, folders);
    } else if (dragState.draggedType === 'item') {
      return canDropItems(
        dragState.draggedItems,
        folderId,
        folders,
        metrics,
        columns,
      );
    }
    return false;
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

      // When a draggable item moves to a new container, the layout may shift
      // and the `overId` may become `null`. We manually set the cached `lastOverId`
      // to the id of the draggable item that was moved to the new container, otherwise
      // the previous `overId` will be returned which can cause items to incorrectly shift positions
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = dragState.activeId;
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [dragState.activeId, folders, folderIds],
  );

  const renderDragOverlay = () => {
    if (!dragState.activeId) return null;

    if (dragState.draggedType === 'folder') {
      const folder = folders.find(f => f.uuid === dragState.activeId);
      if (folder) {
        return (
          <DragOverlayContent>
            <Icons.FolderOutlined />
            <span>{folder.name}</span>
          </DragOverlayContent>
        );
      }
    }

    if (dragState.draggedType === 'item' && dragState.draggedItems.length > 0) {
      const itemId = dragState.draggedItems[0];
      const metric = metrics.find(m => m.uuid === itemId);
      const column = columns.find(c => c.uuid === itemId);

      if (metric) {
        return (
          <DragOverlayContent>
            <span style={{ fontStyle: 'italic', fontSize: '14px' }}>ƒₓ</span>
            <span>{metric.metric_name}</span>
            {dragState.draggedItems.length > 1 && (
              <DragBadge>{dragState.draggedItems.length}</DragBadge>
            )}
          </DragOverlayContent>
        );
      }
      if (column) {
        return (
          <DragOverlayContent>
            <Icons.FieldNumberOutlined />
            <span>{column.column_name}</span>
            {dragState.draggedItems.length > 1 && (
              <DragBadge>{dragState.draggedItems.length}</DragBadge>
            )}
          </DragOverlayContent>
        );
      }
    }

    return null;
  };

  return (
    <FoldersContainer>
      <FoldersToolbar>
        <FoldersSearch>
          <Input
            placeholder={t('Search all metrics & columns')}
            onChange={handleSearch}
            allowClear
          />
        </FoldersSearch>
        <FoldersActions>
          <Button
            type="primary"
            onClick={handleAddFolder}
            icon={<Icons.FolderAddOutlined />}
          >
            {t('Add folder')}
          </Button>
          <Button
            onClick={handleSelectAll}
            icon={<Icons.CheckSquareOutlined />}
          >
            {t('Select all')}
          </Button>
          <Button onClick={handleResetToDefault} icon={<Icons.SyncOutlined />}>
            {t('Reset all folders to default')}
          </Button>
        </FoldersActions>
      </FoldersToolbar>
      <FoldersContent>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={folderIds}
            strategy={verticalListSortingStrategy}
          >
            {folders.map(folder => {
              const itemIds = folder.children?.map(c => c.uuid) || [];
              const isDragOver = dragState.overId === folder.uuid;
              const canAccept = isDragOver && canAcceptCurrentDrag(folder.uuid);

              return (
                <SortableFolder
                  folder={folder}
                  isExpanded={expandedFolderIds.has(folder.uuid)}
                  isEditing={editingFolderId === folder.uuid}
                  onToggle={() => handleFolderToggle(folder.uuid)}
                  onEdit={() => handleFolderEdit(folder.uuid)}
                  onNameChange={name =>
                    handleFolderNameChange(folder.uuid, name)
                  }
                  isDragOver={isDragOver}
                  canAcceptDrop={canAccept}
                  visibleItemIds={visibleItemIds}
                  key={folder.uuid}
                >
                  {expandedFolderIds.has(folder.uuid) && (
                    <FolderContent>
                      <SortableContext
                        items={itemIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {folder.children?.map((child: any) => {
                          if (!visibleItemIds.has(child.uuid)) {
                            return null;
                          }

                          if (child.type === 'metric') {
                            const metric = metrics.find(
                              m => m.uuid === child.uuid,
                            );
                            return metric ? (
                              <SortableItem
                                key={child.uuid}
                                id={child.uuid}
                                isDragging={dragState.draggedItems.includes(
                                  child.uuid,
                                )}
                                onSelect={selected =>
                                  handleItemSelect(child.uuid, selected)
                                }
                                isSelected={selectedItemIds.has(child.uuid)}
                              >
                                <span
                                  style={{
                                    fontStyle: 'italic',
                                    fontSize: '14px',
                                  }}
                                >
                                  ƒₓ
                                </span>
                                <span>{metric.metric_name}</span>
                              </SortableItem>
                            ) : null;
                          }
                          if (child.type === 'column') {
                            const column = columns.find(
                              c => c.uuid === child.uuid,
                            );
                            return column ? (
                              <SortableItem
                                key={child.uuid}
                                id={child.uuid}
                                isDragging={dragState.draggedItems.includes(
                                  child.uuid,
                                )}
                                onSelect={selected =>
                                  handleItemSelect(child.uuid, selected)
                                }
                                isSelected={selectedItemIds.has(child.uuid)}
                              >
                                <Icons.FieldNumberOutlined />
                                <span>{column.column_name}</span>
                              </SortableItem>
                            ) : null;
                          }
                          return null;
                        })}
                      </SortableContext>
                      {(!folder.children ||
                        folder.children.length === 0 ||
                        !folder.children.some(child =>
                          visibleItemIds.has(child.uuid),
                        )) && (
                        <EmptyFolderState>
                          <FolderIcon>
                            <Icons.FileOutlined />
                          </FolderIcon>
                          <div>
                            {searchTerm &&
                            folder.children &&
                            folder.children.length > 0 ? (
                              t('No items match your search')
                            ) : folder.name === t('New Folder') ? (
                              <>
                                <EmptyFolderMainText>
                                  {t('This folder is currently empty')}
                                </EmptyFolderMainText>
                                <EmptyFolderSubText>
                                  {t(
                                    'Name your folder and to edit it later, click on the folder name',
                                  )}
                                </EmptyFolderSubText>
                              </>
                            ) : (
                              <>
                                <EmptyFolderMainText>
                                  {t('This folder is currently empty')}
                                </EmptyFolderMainText>
                                {!isDefaultFolder(folder.name) && (
                                  <EmptyFolderSubText>
                                    {t(
                                      "If it stays empty, it won't be saved and will be removed from this list.",
                                    )}
                                  </EmptyFolderSubText>
                                )}
                              </>
                            )}
                          </div>
                        </EmptyFolderState>
                      )}
                    </FolderContent>
                  )}
                </SortableFolder>
              );
            })}
          </SortableContext>
          <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
        </DndContext>
      </FoldersContent>
    </FoldersContainer>
  );
};

export default FoldersEditor;
