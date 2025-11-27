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

import { styled, css } from '@apache-superset/core/ui';

export const FOLDER_INDENTATION_WIDTH = 24;
export const ITEM_INDENTATION_WIDTH = 4;

export const TreeItemContainer = styled.div<{
  depth: number;
  isDragging: boolean;
  isOver: boolean;
  isOverlay?: boolean;
}>`
  ${({ theme, depth, isDragging, isOverlay }) => `
    margin: ${theme.marginXXS}px ${isOverlay ? 0 : theme.marginMD}px;
    margin-left: ${isOverlay ? 0 : (depth - 1) * FOLDER_INDENTATION_WIDTH + ITEM_INDENTATION_WIDTH}px;
    padding-left: ${theme.paddingSM}px;
    display: flex;
    align-items: center;
    cursor: pointer;
    opacity: ${isDragging ? 0.4 : 1};
    user-select: none;
    ${isDragging || isOverlay ? 'will-change: transform;' : ''}
  `}
`;

export const TreeFolderContainer = styled(TreeItemContainer)<{
  isDropTarget?: boolean;
  isForbiddenDropTarget?: boolean;
}>`
  ${({ theme, depth, isDropTarget, isForbiddenDropTarget, isOverlay }) => `
    margin-top: ${isOverlay ? 0 : theme.marginLG}px;
    margin-bottom: ${isOverlay ? 0 : theme.marginSM}px;
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

export const DragHandle = styled.span`
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

export const CollapseButton = styled.span`
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

export const DefaultFolderIconContainer = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    color: ${theme.colorTextSecondary};
    margin-right: ${theme.marginXS}px;
  `}
`;

export const FolderName = styled.span`
  ${({ theme }) => `
    margin-right: ${theme.marginMD}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

export const DragHandleContainer = styled.div`
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

export const EmptyFolderDropZone = styled.div<{
  depth: number;
  isOver: boolean;
  isForbidden: boolean;
}>`
  ${({ theme, depth, isOver, isForbidden }) => css`
    margin: 0 ${depth * ITEM_INDENTATION_WIDTH + theme.marginMD}px;
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
