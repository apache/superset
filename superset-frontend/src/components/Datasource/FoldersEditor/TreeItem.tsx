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

import { CSSProperties, useState, memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { styled, css } from '@apache-superset/core/ui';
import { Metric, t } from '@superset-ui/core';
import {
  Checkbox,
  Input,
  Icons,
  EmptyState,
  Tooltip,
} from '@superset-ui/core/components';
import { ColumnMeta, ColumnTypeLabel } from '@superset-ui/chart-controls';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import {
  OptionControlContainer,
  Label,
} from 'src/explore/components/controls/OptionControls';
import { FoldersEditorItemType } from '../types';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from './folderUtils';

const FOLDER_INDENTATION_WIDTH = 24;
const ITEM_INDENTATION_WIDTH = 4;

interface TreeItemProps {
  id: string;
  type: FoldersEditorItemType;
  name: string;
  depth: number;
  isCollapsed?: boolean;
  isFolder?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  // Handlers now receive the item id, allowing parent to pass stable references
  onToggleCollapse?: (id: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  onStartEdit?: (id: string) => void;
  onFinishEdit?: (id: string, newName: string) => void;
  isDefaultFolder?: boolean;
  isLastChild?: boolean;
  showEmptyState?: boolean;
  isDropTarget?: boolean;
  isForbiddenDrop?: boolean;
  metric?: Metric;
  column?: ColumnMeta;
  // When true, renders as a drag overlay item (no sortable hooks, shows checkbox)
  isOverlay?: boolean;
}

const TreeItemContainer = styled.div<{
  depth: number;
  isDragging: boolean;
  isOver: boolean;
  isOverlay?: boolean;
}>`
  ${({ theme, depth, isDragging, isOverlay }) => `
    margin: ${theme.marginXXS}px ${isOverlay ? 0 : theme.marginMD}px;
    margin-left: ${isOverlay ? 0 : (depth - 1) * FOLDER_INDENTATION_WIDTH + ITEM_INDENTATION_WIDTH}px;
    display: flex;
    align-items: center;
    cursor: pointer;
    opacity: ${isDragging ? 0.4 : 1};
    user-select: none;
  `}
`;

const FOLDER_NAME_PLACEHOLDER = t(
  'Name your folder and to edit it later, click on the folder name',
);

const TreeFolderContainer = styled(TreeItemContainer)<{
  isDropTarget?: boolean;
  isForbiddenDropTarget?: boolean;
}>`
  ${({ theme, depth, isDropTarget, isForbiddenDropTarget, isOverlay }) => `
    margin-top: ${isOverlay ? 0 : theme.marginLG}px;
    margin-bottom: ${isOverlay ? 0 : theme.marginLG}px;
    margin-left: ${isOverlay ? 0 : depth * FOLDER_INDENTATION_WIDTH}px;
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingXXS}px ${theme.paddingSM}px;
    margin-right: ${isOverlay ? 0 : theme.marginMD}px;
    transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    ${
      isDropTarget && isForbiddenDropTarget
        ? `
      background-color: ${theme.colorErrorBg};
      box-shadow: inset 0 0 0 2px ${theme.colorError};
      cursor: not-allowed;
    `
        : isDropTarget
          ? `
      background-color: ${theme.colorPrimaryBg};
      box-shadow: inset 0 0 0 2px ${theme.colorPrimary};
    `
          : ''
    }
  `}
`;

const DragHandle = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    display: inline-flex;
    align-items: center;
    cursor: grab;

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
    width: 12px;
    height: 12px;
    cursor: pointer;
    color: ${theme.colorTextSecondary};
    margin-left: auto;

    &:hover {
      color: ${theme.colorText};
    }
  `}
`;

const DefaultFolderIconContainer = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    color: ${theme.colorTextSecondary};
    margin-right: ${theme.marginXS}px;
  `}
`;

const FolderName = styled.span`
  ${({ theme }) => `
    margin-right: ${theme.marginMD}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

// Styled drag handle container on the right side
const DragHandleContainer = styled.div`
  ${({ theme }) => `
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 ${theme.sizeUnit}px;
    margin-left: auto;
    cursor: grab;
    color: ${theme.colorTextTertiary};

    &:hover {
      color: ${theme.colorText};
    }

    &:active {
      cursor: grabbing;
    }
  `}
`;

const EmptyFolderDropZone = styled.div<{
  depth: number;
  isOver: boolean;
  isForbidden: boolean;
}>`
  ${({ theme, depth, isOver, isForbidden }) => css`
    margin-left: ${(depth + 1) * ITEM_INDENTATION_WIDTH + theme.marginMD}px;
    padding: ${theme.paddingLG}px;
    border: 2px dashed
      ${isOver
        ? isForbidden
          ? theme.colorError
          : theme.colorPrimary
        : 'transparent'};
    border-radius: ${theme.borderRadius}px;
    background: ${isOver
      ? isForbidden
        ? theme.colorErrorBg
        : theme.colorPrimaryBg
      : 'transparent'};
    text-align: center;
    transition: all 0.2s ease-in-out;
    cursor: ${isOver && isForbidden ? 'not-allowed' : 'default'};
    opacity: ${isOver && isForbidden ? 0.7 : 1};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `}
`;

function TreeItemComponent({
  id,
  type,
  name,
  depth,
  isCollapsed = false,
  isFolder = false,
  isSelected = false,
  isEditing = false,
  onToggleCollapse,
  onSelect,
  onStartEdit,
  onFinishEdit,
  isDefaultFolder = false,
  isLastChild = false,
  showEmptyState = false,
  isDropTarget = false,
  isForbiddenDrop = false,
  metric,
  column,
  isOverlay = false,
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
    disabled: isOverlay,
  });

  // Separate droppable for empty state
  const { setNodeRef: setDroppableRef, isOver: isOverEmpty } = useDroppable({
    id: `${id}-empty`,
    data: {
      type,
      isFolder,
      parentId: id,
    },
    disabled: isOverlay,
  });

  const style: CSSProperties = isOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onFinishEdit?.(id, editValue);
    } else if (e.key === 'Escape') {
      setEditValue(name);
      onFinishEdit?.(id, name);
    }
  };

  const handleEditBlur = () => {
    if (editValue.trim()) {
      onFinishEdit?.(id, editValue);
    } else {
      setEditValue(name);
      onFinishEdit?.(id, name);
    }
  };

  // Get the display name for metrics/columns
  const itemDisplayName = useMemo(() => {
    if (type === FoldersEditorItemType.Metric && metric) {
      return metric.verbose_name || metric.metric_name || name;
    }
    if (type === FoldersEditorItemType.Column && column) {
      return column.verbose_name || column.column_name || name;
    }
    return name;
  }, [type, metric, column, name]);

  // Get the type for ColumnTypeLabel
  const columnType = useMemo(() => {
    if (type === FoldersEditorItemType.Metric) {
      return 'expression';
    }
    if (type === FoldersEditorItemType.Column && column) {
      const hasExpression =
        column.expression && column.expression !== column.column_name;
      return hasExpression ? 'expression' : column.type_generic;
    }
    return undefined;
  }, [type, column]);

  const hasEmptyName = !name || name.trim() === '';

  // Render content for metrics/columns
  const renderItemContent = () => {
    // For folders, render editable name
    if (isFolder) {
      const isDefaultColumnsFolder =
        id === DEFAULT_COLUMNS_FOLDER_UUID && isDefaultFolder;
      const isDefaultMetricsFolder =
        id === DEFAULT_METRICS_FOLDER_UUID && isDefaultFolder;
      const folderNameContent = (
        <FolderName
          onClick={e => {
            if (!isDefaultFolder && onStartEdit) {
              e.stopPropagation();
              onStartEdit(id);
            }
          }}
        >
          {name}
        </FolderName>
      );

      if (isDefaultColumnsFolder) {
        return (
          <Tooltip
            title={t(
              'This is a default columns folder. Its name cannot be changed or removed. It can stay empty but will only accept column items.',
            )}
          >
            {folderNameContent}
          </Tooltip>
        );
      }

      if (isDefaultMetricsFolder) {
        return (
          <Tooltip
            title={t(
              'This is a default metrics folder. Its name cannot be changed or removed. It can stay empty but will only accept metric items.',
            )}
          >
            {folderNameContent}
          </Tooltip>
        );
      }

      return folderNameContent;
    }

    // For metrics/columns, render type icon + name in styled container with drag handle inside
    // The whole container is draggable, handle is just visual indicator
    return (
      <OptionControlContainer
        {...attributes}
        {...listeners}
        css={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
      >
        <Label>
          {columnType !== undefined && <ColumnTypeLabel type={columnType} />}
          {itemDisplayName}
        </Label>
        <DragHandleContainer>
          <Icons.Drag iconSize="xl" />
        </DragHandleContainer>
      </OptionControlContainer>
    );
  };

  const containerProps = {
    ref: setNodeRef,
    style,
    depth,
    isDragging,
    isOver,
    isOverlay,
  };

  const containerContent = (
    <>
      {/* Drag handle on the LEFT side (for folders only) */}
      {isFolder && (
        <DragHandle
          {...attributes}
          {...listeners}
          css={theme => css`
            margin-right: ${theme.marginLG}px;
          `}
        >
          <Icons.Move iconSize="xl" />
        </DragHandle>
      )}

      {/* Checkbox for selection (metrics/columns only) */}
      {/* In overlay mode, show checkbox for non-folder items with actual selection state */}
      {(onSelect || (isOverlay && !isFolder)) && (
        <Checkbox
          checked={isSelected}
          disabled={isOverlay}
          onChange={(e: CheckboxChangeEvent) => {
            if (!isOverlay) {
              e.stopPropagation();
              onSelect?.(id, e.target.checked);
            }
          }}
          css={theme => css`
            margin-right: ${theme.marginSM}px;
          `}
        />
      )}

      {/* Icon for DEFAULT folders only (Metrics/Columns) */}
      {isFolder && isDefaultFolder && (
        <DefaultFolderIconContainer>
          <Icons.FolderViewOutlined />
        </DefaultFolderIconContainer>
      )}

      {/* Name (editable for non-default folders) or MetricOption/ColumnOption */}
      {(isEditing || hasEmptyName) && !isDefaultFolder ? (
        <Input
          value={editValue}
          placeholder={FOLDER_NAME_PLACEHOLDER}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEditValue(e.target.value)
          }
          onKeyDown={handleEditKeyDown}
          onBlur={handleEditBlur}
          autoFocus
          onClick={(e: React.MouseEvent<HTMLInputElement>) =>
            e.stopPropagation()
          }
          css={theme => css`
            padding: 0;
            padding-right: ${theme.marginMD}px;
          `}
          variant="borderless"
        />
      ) : (
        renderItemContent()
      )}

      {/* Collapse/expand button on the RIGHT side for folders */}
      {isFolder && onToggleCollapse && (
        <CollapseButton
          onClick={e => {
            e.stopPropagation();
            onToggleCollapse(id);
          }}
        >
          {isCollapsed ? <Icons.RightOutlined /> : <Icons.DownOutlined />}
        </CollapseButton>
      )}
    </>
  );

  return (
    <>
      {isFolder ? (
        <TreeFolderContainer
          {...containerProps}
          isDropTarget={isDropTarget}
          isForbiddenDropTarget={isForbiddenDrop}
        >
          {containerContent}
        </TreeFolderContainer>
      ) : (
        <TreeItemContainer {...containerProps}>
          {containerContent}
        </TreeItemContainer>
      )}

      {/* Empty state drop zone for folders with no children */}
      {isFolder && showEmptyState && !isCollapsed && (
        <EmptyFolderDropZone
          ref={setDroppableRef}
          depth={depth}
          isOver={isOverEmpty}
          isForbidden={isForbiddenDrop}
        >
          <EmptyState
            title={
              isDefaultFolder
                ? t('This is the default folder')
                : t('This folder is currently empty')
            }
            description={
              isDefaultFolder
                ? t(
                    "It won't be removed even if empty. It won't be shown in chart editing view if empty.",
                  )
                : t(
                    "If it stays empty, it won't be saved and will be removed from the list. To remove folders, move metrics and columns to other folders.",
                  )
            }
            size="small"
          />
        </EmptyFolderDropZone>
      )}
    </>
  );
}

export const TreeItem = memo(TreeItemComponent);
