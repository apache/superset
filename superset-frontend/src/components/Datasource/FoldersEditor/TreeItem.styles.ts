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
    margin: 0 ${theme.marginMD}px;
    margin-left: ${isOverlay ? ITEM_INDENTATION_WIDTH : (depth - 1) * FOLDER_INDENTATION_WIDTH + ITEM_INDENTATION_WIDTH}px;
    padding-left: ${theme.paddingSM}px;
    display: flex;
    align-items: center;
    cursor: pointer;
    opacity: ${isDragging ? 0.4 : 1};
    user-select: none;
    ${isDragging || isOverlay ? 'will-change: transform;' : ''}
  `}
`;

export const ItemSeparator = styled.div<{
  variant: 'visible' | 'transparent';
}>`
  ${({ theme, variant }) => {
    // Use explicit height instead of margins so dnd-kit measures correctly.
    // getBoundingClientRect doesn't include margins, causing transform mismatches during drag.
    const verticalPadding =
      variant === 'visible' ? theme.marginSM : theme.marginXS;
    const totalHeight = 1 + verticalPadding * 2;
    return `
      height: ${totalHeight}px;
      display: flex;
      align-items: center;
      margin-left: ${theme.marginSM}px;
      margin-right: ${theme.marginMD}px;

      &::after {
        content: '';
        display: block;
        width: 100%;
        height: 1px;
        background-color: ${variant === 'visible' ? theme.colorBorderSecondary : 'transparent'};
      }
    `;
  }}
`;

export const TreeFolderContainer = styled(TreeItemContainer)<{
  isForbiddenDropTarget?: boolean;
}>`
  ${({ theme, depth, isForbiddenDropTarget, isOverlay }) => `
    margin-top: 0;
    margin-bottom: 0;
    padding-top: ${theme.paddingSM}px;
    padding-bottom: ${theme.paddingSM}px;
    margin-left: ${depth * FOLDER_INDENTATION_WIDTH}px;
    border-radius: ${theme.borderRadius}px;
    padding-left: ${theme.paddingSM}px;
    padding-right: ${theme.paddingSM}px;
    margin-right: ${theme.marginMD}px;
    transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

    &:hover:not(:has(input)) [aria-label="move"] {
      color: ${theme.colorText};
    }

    /* Drop target styles - controlled via data attributes for performance */
    &[data-drop-target="true"] {
      background-color: ${theme.colorPrimaryBg};
      box-shadow: inset 0 0 0 2px ${theme.colorPrimary};
    }

    &[data-drop-target="true"][data-forbidden-drop="true"],
    &[data-drop-target="true"]${isForbiddenDropTarget ? '' : '[data-forbidden-drop="true"]'} {
      background-color: ${theme.colorErrorBg};
      box-shadow: inset 0 0 0 2px ${theme.colorError};
      cursor: not-allowed;
    }

    /* Also support prop-based forbidden styling for initial render */
    ${
      isForbiddenDropTarget
        ? `
      &[data-drop-target="true"] {
        background-color: ${theme.colorErrorBg};
        box-shadow: inset 0 0 0 2px ${theme.colorError};
        cursor: not-allowed;
      }
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
    transition: color 0.15s ease-in-out;
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
    cursor: pointer;
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
    margin: ${theme.marginXS}px ${theme.marginMD}px 0;
    margin-left: ${depth * FOLDER_INDENTATION_WIDTH + ITEM_INDENTATION_WIDTH}px;
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
