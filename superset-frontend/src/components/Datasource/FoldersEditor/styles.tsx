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
import { calculateItemHeights } from './hooks/useItemHeights';

export const FoldersContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  gap: ${({ theme }) => theme.paddingMD}px;
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

export const FoldersActionsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.paddingXS}px;
`;

export const SelectionCount = styled.div`
  ${({ theme }) => `
    align-self: flex-end;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

export const FoldersContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const STACK_OFFSET_X = 4;
const STACK_OFFSET_Y = 14;

export const DragOverlayStack = styled.div<{ width?: number }>`
  position: relative;
  width: ${({ width }) => (width ? `${width}px` : '100%')};
  will-change: transform;
`;

export const DragOverlayFolderBlock = styled.div<{ width?: number }>`
  ${({ theme, width }) => `
    width: ${width ? `${width}px` : '100%'};
    will-change: transform;
    background: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadowSecondary};
    pointer-events: none;
    overflow: hidden;
    opacity: 0.95;
  `}
`;

// Matches react-window slot heights so the overlay lines up with the list.
export const FolderBlockSlot = styled.div<{
  variant: 'folder' | 'item';
  separatorType?: 'visible' | 'transparent';
}>`
  ${({ theme, variant, separatorType }) => {
    const heights = calculateItemHeights(theme);
    let minHeight =
      variant === 'folder' ? heights.folderHeader : heights.regularItem;
    if (separatorType === 'visible') {
      minHeight += heights.separatorVisible;
    } else if (separatorType === 'transparent') {
      minHeight += heights.separatorTransparent;
    }
    return `
      min-height: ${minHeight}px;
      display: flex;
      align-items: stretch;

      > * {
        flex: 1;
        min-width: 0;
      }
    `;
  }}
`;

export const MoreItemsIndicator = styled.div`
  ${({ theme }) => `
    padding: ${theme.paddingXS}px ${theme.paddingMD}px;
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    text-align: center;
  `}
`;

export const DragOverlayItem = styled.div<{
  stackIndex: number;
  totalItems: number;
}>`
  ${({ stackIndex, totalItems }) => {
    const opacities = [1, 0.8, 0.6];
    const opacity = opacities[stackIndex] ?? 0.6;

    return css`
      position: ${stackIndex === 0 ? 'relative' : 'absolute'};
      top: ${stackIndex * STACK_OFFSET_Y}px;
      left: ${stackIndex * STACK_OFFSET_X}px;
      right: ${stackIndex === 0 ? 0 : -stackIndex * STACK_OFFSET_X}px;
      z-index: ${totalItems - stackIndex};
      opacity: ${opacity};
      pointer-events: none;
    `;
  }}
`;
