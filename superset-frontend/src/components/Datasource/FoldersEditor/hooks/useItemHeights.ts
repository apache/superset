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

import { useMemo } from 'react';
import { useTheme, SupersetTheme } from '@apache-superset/core/ui';
import {
  FOLDER_INDENTATION_WIDTH,
  ITEM_INDENTATION_WIDTH,
} from '../TreeItem.styles';

export interface ItemHeights {
  /** Height of a regular item (metric/column) including margins */
  regularItem: number;
  /** Height of a folder header including margins */
  folderHeader: number;
  /** Height of a visible separator (colored line between top-level sections) */
  separatorVisible: number;
  /** Height of a transparent separator (spacing between nested items) */
  separatorTransparent: number;
  /** Base height estimate for empty folder with EmptyState */
  emptyFolderBase: number;
  /** Indentation width per folder depth level */
  folderIndentation: number;
  /** Indentation width for items */
  itemIndentation: number;
}

/**
 * Calculates item heights based on theme tokens.
 * These heights include margins since react-window uses absolute positioning
 * where margins don't collapse.
 */
function calculateItemHeights(theme: SupersetTheme): ItemHeights {
  // Base content height (line height * font size + vertical padding)
  const baseContentHeight =
    theme.lineHeight * theme.fontSize + theme.paddingSM * 2;

  // Regular item: content + marginXXS top + marginXXS bottom
  const regularItem = baseContentHeight + theme.marginXXS * 2;

  // Folder header: content + marginLG top + margin bottom
  const folderHeader = baseContentHeight + theme.marginLG + theme.margin;

  // Separator visible: 1px line + marginLG top + marginLG bottom
  const separatorVisible = 1 + theme.marginLG * 2;

  // Separator transparent: 1px line + marginSM top + marginSM bottom
  const separatorTransparent = 1 + theme.marginSM * 2;

  // Empty folder with EmptyState: estimate based on typical EmptyState rendering
  // This includes paddingLG around the container plus the EmptyState content
  const emptyFolderBase = theme.paddingLG * 2 + 120;

  return {
    regularItem,
    folderHeader,
    separatorVisible,
    separatorTransparent,
    emptyFolderBase,
    folderIndentation: FOLDER_INDENTATION_WIDTH,
    itemIndentation: ITEM_INDENTATION_WIDTH,
  };
}

/**
 * Hook that provides item heights calculated from the current theme.
 * Use this for virtualized list height calculations.
 */
export function useItemHeights(): ItemHeights {
  const theme = useTheme();

  return useMemo(() => calculateItemHeights(theme), [theme]);
}
