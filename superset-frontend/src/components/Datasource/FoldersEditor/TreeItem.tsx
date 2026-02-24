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
import { css, t } from '@apache-superset/core/ui';
import {
  Checkbox,
  Input,
  Icons,
  EmptyState,
  Tooltip,
} from '@superset-ui/core/components';
import {
  ColumnLabelExtendedType,
  ColumnMeta,
  ColumnTypeLabel,
  Metric,
} from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  OptionControlContainer,
  Label,
} from 'src/explore/components/controls/OptionControls';
import { FoldersEditorItemType } from '../types';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from './constants';
import {
  TreeItemContainer,
  TreeFolderContainer,
  DragHandle,
  CollapseButton,
  DefaultFolderIconContainer,
  FolderName,
  DragHandleContainer,
  EmptyFolderDropZone,
  ItemSeparator,
} from './TreeItem.styles';

const FOLDER_NAME_PLACEHOLDER = t(
  'Name your folder and to edit it later, click on the folder name',
);

interface TreeItemProps {
  id: string;
  type: FoldersEditorItemType;
  name: string;
  depth: number;
  isCollapsed?: boolean;
  isFolder?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  onToggleCollapse?: (id: string) => void;
  onSelect?: (id: string, selected: boolean, shiftKey?: boolean) => void;
  onStartEdit?: (id: string) => void;
  onFinishEdit?: (id: string, newName: string) => void;
  isDefaultFolder?: boolean;
  showEmptyState?: boolean;
  separatorType?: 'visible' | 'transparent';
  isForbiddenDrop?: boolean;
  isDropTarget?: boolean;
  metric?: Metric;
  column?: ColumnMeta;
  isOverlay?: boolean;
}

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
  showEmptyState = false,
  separatorType,
  isForbiddenDrop = false,
  isDropTarget = false,
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

  const itemDisplayName = useMemo(() => {
    if (type === FoldersEditorItemType.Metric && metric) {
      return metric.verbose_name || metric.metric_name || name;
    }
    if (type === FoldersEditorItemType.Column && column) {
      return column.verbose_name || column.column_name || name;
    }
    return name;
  }, [type, metric, column, name]);

  const columnType: ColumnLabelExtendedType | GenericDataType | undefined =
    useMemo(() => {
      if (type === FoldersEditorItemType.Metric) {
        return 'metric';
      }
      if (type === FoldersEditorItemType.Column && column) {
        const hasExpression =
          column.expression && column.expression !== column.column_name;
        return hasExpression ? 'expression' : column.type_generic;
      }
      return undefined;
    }, [type, column]);

  const hasEmptyName = !name || name.trim() === '';

  const renderItemContent = () => {
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
      {isFolder && (
        <DragHandle
          css={theme => css`
            margin-right: ${theme.marginSM}px;
          `}
        >
          <Icons.Move iconSize="xl" />
        </DragHandle>
      )}

      {(onSelect || (isOverlay && !isFolder)) && (
        <Checkbox
          checked={isSelected}
          disabled={isOverlay}
          onClick={(e: React.MouseEvent) => {
            if (!isOverlay) {
              e.stopPropagation();
              onSelect?.(id, !isSelected, e.shiftKey);
            }
          }}
          css={theme => css`
            margin-right: ${theme.marginSM}px;
          `}
        />
      )}

      {isFolder && (
        <DefaultFolderIconContainer>
          {isDefaultFolder ? (
            <Icons.FolderViewOutlined />
          ) : (
            <Icons.FolderOutlined />
          )}
        </DefaultFolderIconContainer>
      )}

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

  // Separator appears BELOW items (after content)
  // Wrapped together with item so they move as one unit during drag
  const showSeparator = !isFolder && separatorType;

  // Extract transform style to apply to wrapper
  const { style: transformStyle, ...restContainerProps } = containerProps;

  return (
    <>
      {/* Wrapper div receives the transform so item + separator move together */}
      <div ref={setNodeRef} style={transformStyle}>
        {isFolder ? (
          <TreeFolderContainer
            {...restContainerProps}
            {...attributes}
            {...listeners}
            data-folder-id={id}
            data-drop-target={isDropTarget ? 'true' : undefined}
            isForbiddenDropTarget={isForbiddenDrop}
            css={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          >
            {containerContent}
          </TreeFolderContainer>
        ) : (
          <TreeItemContainer {...restContainerProps}>
            {containerContent}
          </TreeItemContainer>
        )}

        {showSeparator && <ItemSeparator variant={separatorType} />}
      </div>

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
