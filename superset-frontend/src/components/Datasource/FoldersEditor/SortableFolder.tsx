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
import { Input, Icons } from '@superset-ui/core/components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isDefaultFolder } from './folderUtils';
import {
  FolderContainer,
  FolderHeader,
  FolderTitle,
  ItemCount,
  DragHandle,
} from './styles';
import { SortableFolderProps } from './types';

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

export default SortableFolder;
