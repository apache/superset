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

export const FoldersContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
`;

export const DropIndicator = styled.div<{ position: 'before' | 'after' }>`
  position: absolute;
  ${({ position }) => (position === 'before' ? 'top: 0;' : 'bottom: 0;')}
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--ant-color-primary);
  pointer-events: none;
  z-index: 1000;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: -2px;
    width: 6px;
    height: 6px;
    background-color: var(--ant-color-primary);
    border-radius: 50%;
  }
`;

export const FoldersToolbar = styled.div`
  ${({ theme }) => `
    position: sticky;
    top: -${theme.margin}px; // offsets tabs component bottom margin
    z-index: 10;
    background: ${theme.colorBgContainer};
    padding-top: ${theme.paddingMD}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.paddingLG}px;
  `}
`;

export const FoldersSearch = styled.div`
  width: 100%;

  .ant-input-prefix {
    color: ${({ theme }) => theme.colorIcon};
  }
`;

export const FoldersActions = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.paddingSM}px;
  `}
`;

export const FoldersContent = styled.div`
  flex: 1;
  min-height: 0;
`;

export const FolderContainer = styled.div<{ isNested?: boolean }>`
  margin-bottom: ${({ theme }) => theme.paddingLG}px;
  ${({ isNested, theme }) =>
    isNested &&
    css`
      margin-left: ${theme.paddingLG}px;
      margin-bottom: ${theme.paddingMD}px;
    `}
`;

export const FolderHeader = styled.div<{
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

export const FolderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.paddingSM}px;
`;

export const FolderContent = styled.div<{ isDragging?: boolean }>`
  margin-left: ${({ theme }) => theme.paddingLG}px;
  min-height: ${({ isDragging }) => (isDragging ? '80px' : '20px')};
  transition: min-height 0.15s ease-in-out;
`;

export const FolderItem = styled.div<{
  isDraggable?: boolean;
  isDragging?: boolean;
}>`
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

export const EmptyFolderState = styled.div<{ isDragging?: boolean }>`
  ${({ theme, isDragging }) => css`
    padding: ${theme.paddingLG}px;
    text-align: center;
    color: ${theme.colorTextTertiary};
    min-height: ${isDragging ? '120px' : 'auto'};
    transition: min-height 0.2s ease-in-out;
  `}
`;

export const FolderIcon = styled.div`
  font-size: 48px;
  margin-bottom: ${({ theme }) => theme.paddingSM}px;
  color: ${({ theme }) => theme.colorTextTertiary};
`;

export const ItemCount = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export const DragHandle = styled.span`
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

export const DragOverlayContent = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBgContainer};
    border: 2px solid ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadow};
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    display: flex;
    align-items: center;
    gap: ${theme.paddingSM}px;
    pointer-events: none;
    z-index: 9999;
  `}
`;

export const DragBadge = styled.div`
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

export const StackedDragOverlay = styled.div`
  position: relative;
  display: inline-block;
`;

export const StackedDragItem = styled.div<{ stackIndex: number }>`
  ${({ theme, stackIndex }) => css`
    position: ${stackIndex === 0 ? 'relative' : 'absolute'};
    top: ${stackIndex === 0 ? '0' : `${stackIndex * 4}px`};
    left: ${stackIndex === 0 ? '0' : `${stackIndex * 4}px`};
    z-index: ${3 - stackIndex};
    opacity: ${stackIndex === 0 ? 1 : Math.max(0.6, 1 - stackIndex * 0.2)};
    background: ${theme.colorBgContainer};
    border: 2px solid ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadow};
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    display: flex;
    align-items: center;
    gap: ${theme.paddingSM}px;
    pointer-events: none;
    white-space: nowrap;
  `}
`;

export const EmptyFolderSubText = styled.div`
  ${({ theme }) => css`
    margin-top: 8px;
    font-size: ${theme.fontSizeXS}px;
    color: ${theme.colorTextTertiary};
  `}
`;

export const EmptyFolderMainText = styled.div`
  font-weight: 500;
`;
