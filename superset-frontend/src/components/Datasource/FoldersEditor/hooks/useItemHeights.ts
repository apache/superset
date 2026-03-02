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
import { ITEM_BASE_HEIGHT } from '../constants';

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
 * These heights include spacing since react-window uses absolute positioning
 * where CSS margins don't collapse.
 *
 * The spacing is built into the height calculation, NOT the CSS margins,
 * to avoid double-spacing issues with absolute positioning.
 */
export function calculateItemHeights(theme: SupersetTheme): ItemHeights {
  // Regular item height - just the row height, minimal spacing
  // The OptionControlContainer sets the actual content height
  const regularItem = ITEM_BASE_HEIGHT;

  // Folder header - base height + vertical padding (for taller highlight) + bottom spacing
  const folderHeader = ITEM_BASE_HEIGHT + theme.paddingSM + theme.marginXS;

  // Separator visible: 1px line + vertical margins (marginSM above and below)
  const separatorVisible = 1 + theme.marginSM * 2;

  // Separator transparent: 1px line + small vertical margin
  const separatorTransparent = 1 + theme.marginXS * 2;

  // Empty folder with EmptyState: measured from actual rendering (~236px)
  // EmptyFolderDropZone padding (24*2) + EmptyState content (~188px)
  const emptyFolderBase = 240;

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
