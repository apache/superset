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

import { CSSProperties, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { styled, t } from '@superset-ui/core';
import { Checkbox, Input, Icons } from '@superset-ui/core/components';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { FoldersEditorItemType } from '../types';

const INDENTATION_WIDTH = 32;

interface TreeItemProps {
  id: string;
  type: FoldersEditorItemType;
  name: string;
  depth: number;
  isCollapsed?: boolean;
  isFolder?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  childCount?: number;
  onToggleCollapse?: () => void;
  onSelect?: (selected: boolean) => void;
  onStartEdit?: () => void;
  onFinishEdit?: (newName: string) => void;
  isDefaultFolder?: boolean;
  showEmptyState?: boolean;
}

const TreeItemContainer = styled.div<{
  depth: number;
  isDragging: boolean;
  isOver: boolean;
}>`
  ${({ theme, depth, isDragging, isOver }) => `
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    padding-left: ${depth * INDENTATION_WIDTH + theme.paddingMD}px;
    display: flex;
    align-items: center;
    gap: ${theme.paddingSM}px;
    border-radius: ${theme.borderRadius}px;
    transition: background 0.15s ease-in-out;
    cursor: pointer;
    opacity: ${isDragging ? 0.4 : 1};
    user-select: none;
    background: ${isOver ? theme.colorPrimaryBg : 'transparent'};
    border: 2px solid ${isOver ? theme.colorPrimary : 'transparent'};

    &:hover {
      background: ${theme.colorBgTextHover};
    }
  `}
`;

const DragHandle = styled.span`
  ${({ theme }) => `
    cursor: grab;
    color: ${theme.colorTextTertiary};
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

const CollapseButton = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    cursor: pointer;
    color: ${theme.colorTextSecondary};

    &:hover {
      color: ${theme.colorText};
    }
  `}
`;

const ItemIcon = styled.span<{ isFolder?: boolean }>`
  ${({ theme, isFolder }) => `
    display: inline-flex;
    align-items: center;
    color: ${isFolder ? theme.colorPrimary : theme.colorTextSecondary};
    font-size: 16px;
  `}
`;

const ItemName = styled.span<{ isFolder?: boolean }>`
  ${({ theme, isFolder }) => `
    flex: 1;
    font-weight: ${isFolder ? 500 : 400};
  `}
`;

const ItemCount = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const EmptyFolderDropZone = styled.div<{
  depth: number;
  isOver: boolean;
}>`
  ${({ theme, depth, isOver }) => `
    margin-left: ${(depth + 1) * INDENTATION_WIDTH + theme.paddingMD}px;
    margin-top: ${theme.paddingXS}px;
    padding: ${theme.paddingLG * 2}px ${theme.paddingLG}px;
    border: 2px dashed ${isOver ? theme.colorPrimary : theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    background: ${isOver ? theme.colorPrimaryBg : theme.colorBgTextHover};
    text-align: center;
    transition: all 0.2s ease-in-out;
    cursor: default;

    &:hover {
      border-color: ${theme.colorPrimary};
      background: ${theme.colorPrimaryBg};
    }
  `}
`;

const EmptyFolderIcon = styled.div`
  ${({ theme }) => `
    font-size: 48px;
    color: ${theme.colorTextTertiary};
    margin-bottom: ${theme.paddingSM}px;
  `}
`;

const EmptyFolderText = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export function TreeItem({
  id,
  type,
  name,
  depth,
  isCollapsed = false,
  isFolder = false,
  isSelected = false,
  isEditing = false,
  childCount = 0,
  onToggleCollapse,
  onSelect,
  onStartEdit,
  onFinishEdit,
  isDefaultFolder = false,
  showEmptyState = false,
}: TreeItemProps) {
  const [editValue, setEditValue] = useState(name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    data: {
      type,
      isFolder,
    },
  });

  // Separate droppable for empty state
  const { setNodeRef: setDroppableRef, isOver: isOverEmpty } = useDroppable({
    id: `${id}-empty`,
    data: {
      type,
      isFolder,
      parentId: id,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onFinishEdit?.(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(name);
      onFinishEdit?.(name);
    }
  };

  const handleEditBlur = () => {
    if (editValue.trim()) {
      onFinishEdit?.(editValue);
    } else {
      setEditValue(name);
      onFinishEdit?.(name);
    }
  };

  const renderIcon = () => {
    if (isFolder) {
      // Use FolderOutlined for both collapsed and expanded states
      return <Icons.FolderOutlined />;
    }
    // For metrics and columns, we can add specific icons later if needed
    return null;
  };

  return (
    <>
      <TreeItemContainer
        ref={setNodeRef}
        style={style}
        depth={depth}
        isDragging={isDragging}
        isOver={isOver}
      >
        {/* Drag handle */}
        <DragHandle {...attributes} {...listeners}>
          <Icons.Drag />
        </DragHandle>

        {/* Checkbox for selection */}
        {onSelect && (
          <Checkbox
            checked={isSelected}
            onChange={(e: CheckboxChangeEvent) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
          />
        )}

        {/* Collapse/expand button for folders */}
        {isFolder && onToggleCollapse && (
          <CollapseButton
            onClick={e => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            {isCollapsed ? <Icons.RightOutlined /> : <Icons.DownOutlined />}
          </CollapseButton>
        )}

        {/* Icon */}
        <ItemIcon isFolder={isFolder}>{renderIcon()}</ItemIcon>

        {/* Name (editable for non-default folders) */}
        {isEditing && !isDefaultFolder ? (
          <Input
            value={editValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditValue(e.target.value)
            }
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
            autoFocus
            onClick={(e: React.MouseEvent<HTMLInputElement>) =>
              e.stopPropagation()
            }
            style={{ flex: 1 }}
          />
        ) : (
          <ItemName
            isFolder={isFolder}
            onClick={e => {
              if (isFolder && !isDefaultFolder && onStartEdit) {
                e.stopPropagation();
                onStartEdit();
              }
            }}
          >
            {name}
          </ItemName>
        )}

        {/* Child count for folders */}
        {isFolder && childCount > 0 && <ItemCount>({childCount})</ItemCount>}
      </TreeItemContainer>

      {/* Empty state drop zone for folders with no children */}
      {isFolder && showEmptyState && !isCollapsed && (
        <EmptyFolderDropZone
          ref={setDroppableRef}
          depth={depth}
          isOver={isOverEmpty}
        >
          <EmptyFolderIcon>
            <Icons.FolderAddOutlined />
          </EmptyFolderIcon>
          <EmptyFolderText>{t('Drop items here')}</EmptyFolderText>
        </EmptyFolderDropZone>
      )}
    </>
  );
}
