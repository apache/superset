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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { Button, Input, Modal, Icons } from '@superset-ui/core/components';
import { debounce } from 'lodash';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import {
  createFolder,
  resetToDefault,
  renameFolder,
  filterItemsBySearch,
  ensureDefaultFolders,
  isDefaultFolder,
} from './folderUtils';
import { useDragAndDrop } from './useDragAndDrop';
import SortableItem from './SortableItem';
import SortableFolder from './SortableFolder';
import DragOverlayComponent from './DragOverlayComponent';
import {
  FoldersContainer,
  FoldersToolbar,
  FoldersSearch,
  FoldersActions,
  FoldersContent,
  FolderContent,
  EmptyFolderState,
  FolderIcon,
  EmptyFolderMainText,
  EmptyFolderSubText,
} from './styles';
import { FoldersEditorProps } from './types';

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

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(folders.map(f => f.uuid)),
  );
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    collisionDetectionStrategy,
    canAcceptCurrentDrag,
    recentlyMovedToNewContainer,
  } = useDragAndDrop({
    folders,
    setFolders,
    folderIds,
    selectedItemIds,
    metrics,
    columns,
    onChange,
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
  }, [folders, recentlyMovedToNewContainer]);

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
                    <FolderContent isDragging={!!dragState.activeId}>
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
                        <EmptyFolderState isDragging={!!dragState.activeId}>
                          {isDragOver && canAccept ? (
                            <div style={{ padding: '20px 0' }}>
                              <Icons.FolderOutlined
                                style={{
                                  fontSize: '32px',
                                  color: 'var(--ant-color-primary)',
                                }}
                              />
                              <div
                                style={{
                                  marginTop: '8px',
                                  color: 'var(--ant-color-primary)',
                                }}
                              >
                                {t('Drop items here')}
                              </div>
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
                        </EmptyFolderState>
                      )}
                    </FolderContent>
                  )}
                </SortableFolder>
              );
            })}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            <DragOverlayComponent
              dragState={dragState}
              folders={folders}
              metrics={metrics}
              columns={columns}
            />
          </DragOverlay>
        </DndContext>
      </FoldersContent>
    </FoldersContainer>
  );
};

export default FoldersEditor;
