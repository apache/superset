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
  onToggleCollapse?: () => void;
  onSelect?: (selected: boolean) => void;
  onStartEdit?: () => void;
  onFinishEdit?: (newName: string) => void;
  isDefaultFolder?: boolean;
  isLastChild?: boolean;
  showEmptyState?: boolean;
  metric?: Metric;
  column?: ColumnMeta;
  draggedItemTypes?: Set<FoldersEditorItemType>;
}

const TreeItemContainer = styled.div<{
  depth: number;
  isDragging: boolean;
  isOver: boolean;
}>`
  ${({ theme, depth, isDragging }) => `
    margin: ${theme.marginXXS}px ${theme.marginMD}px;
    margin-left: ${(depth - 1) * FOLDER_INDENTATION_WIDTH + ITEM_INDENTATION_WIDTH}px;
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

const TreeFolderContainer = styled(TreeItemContainer)`
  ${({ theme, depth }) => `
    margin-top: ${theme.marginLG}px;
    margin-bottom: ${theme.marginLG}px;
    margin-left: ${depth * FOLDER_INDENTATION_WIDTH}px;
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

export function TreeItem({
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
  metric,
  column,
  draggedItemTypes,
}: TreeItemProps) {
  const [editValue, setEditValue] = useState(name);

  // Calculate if this folder can accept the currently dragged items
  const isForbiddenDrop = (() => {
    if (!isFolder || !draggedItemTypes || draggedItemTypes.size === 0) {
      return false;
    }

    const isDefaultMetricsFolder =
      id === DEFAULT_METRICS_FOLDER_UUID && isDefaultFolder;
    const isDefaultColumnsFolder =
      id === DEFAULT_COLUMNS_FOLDER_UUID && isDefaultFolder;

    // Check if any dragged item violates the folder type restriction
    if (isDefaultMetricsFolder) {
      return draggedItemTypes.has(FoldersEditorItemType.Column);
    }
    if (isDefaultColumnsFolder) {
      return draggedItemTypes.has(FoldersEditorItemType.Metric);
    }

    return false;
  })();

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

  // Get the display name for metrics/columns
  const getItemDisplayName = () => {
    if (type === FoldersEditorItemType.Metric && metric) {
      return metric.verbose_name || metric.metric_name || name;
    }
    if (type === FoldersEditorItemType.Column && column) {
      return column.verbose_name || column.column_name || name;
    }
    return name;
  };

  // Get the type for ColumnTypeLabel
  const getColumnType = () => {
    if (type === FoldersEditorItemType.Metric) {
      return 'expression';
    }
    if (type === FoldersEditorItemType.Column && column) {
      const hasExpression =
        column.expression && column.expression !== column.column_name;
      return hasExpression ? 'expression' : column.type_generic;
    }
    return undefined;
  };

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
              onStartEdit();
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
    const columnType = getColumnType();
    return (
      <OptionControlContainer
        {...attributes}
        {...listeners}
        css={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
      >
        <Label>
          {columnType !== undefined && <ColumnTypeLabel type={columnType} />}
          {getItemDisplayName()}
        </Label>
        <DragHandleContainer>
          <Icons.Drag iconSize="xl" />
        </DragHandleContainer>
      </OptionControlContainer>
    );
  };

  const Container = isFolder ? TreeFolderContainer : TreeItemContainer;
  return (
    <>
      <Container
        ref={setNodeRef}
        style={style}
        depth={depth}
        isDragging={isDragging}
        isOver={isOver}
      >
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
        {onSelect && (
          <Checkbox
            checked={isSelected}
            onChange={(e: CheckboxChangeEvent) => {
              e.stopPropagation();
              onSelect(e.target.checked);
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
              onToggleCollapse();
            }}
          >
            {isCollapsed ? <Icons.RightOutlined /> : <Icons.DownOutlined />}
          </CollapseButton>
        )}
      </Container>

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
