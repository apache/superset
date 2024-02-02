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

export const MENU_ITEM_HEIGHT = 32;
const MENU_PADDING = 4;
const MENU_VERTICAL_SPACING = 32;

/**
 * Calculates an adjusted Y-offset for a menu or submenu to prevent that
 * menu from appearing offscreen
 *
 * @param clientY The original Y-offset
 * @param itemsCount The number of menu items
 */
export const getMenuAdjustedY = (
  clientY: number,
  itemsCount: number,
  maxItemsContainerHeight = Number.MAX_SAFE_INTEGER,
  additionalItemsHeight = 0,
) => {
  // Viewport height
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0,
  );

  const menuHeight =
    Math.min(MENU_ITEM_HEIGHT * itemsCount, maxItemsContainerHeight) +
    MENU_VERTICAL_SPACING +
    additionalItemsHeight;
  // Always show the context menu inside the viewport
  return vh - clientY < menuHeight ? vh - menuHeight : clientY;
};

export const getSubmenuYOffset = (
  contextMenuY: number,
  itemsCount: number,
  submenuIndex = 0,
  maxItemsContainerHeight = Number.MAX_SAFE_INTEGER,
  additionalItemsHeight = 0,
) => {
  const submenuY =
    contextMenuY +
    MENU_PADDING +
    MENU_ITEM_HEIGHT * submenuIndex +
    MENU_PADDING;

  return (
    getMenuAdjustedY(
      submenuY,
      itemsCount,
      maxItemsContainerHeight,
      additionalItemsHeight,
    ) - submenuY
  );
};
