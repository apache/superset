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
import {
  isAntdMenuItem,
  isAntdMenuItemRef,
  isAntdMenuSubmenu,
  isSubMenuOrItemType,
  MenuItemChildType,
  MenuItemKeyEnum,
} from 'src/components/Menu';
import { KeyboardEvent, ReactElement, RefObject } from 'react';
import { ensureIsArray } from '@superset-ui/core';

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

const NAV_KEYS = {
  tab: 'Tab',
  escape: 'Escape',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

/**
 * A MenuItem can be recognized in the tree by the presence of a ref
 *
 * @param children
 * @param currentKeys
 * @returns an array of keys
 */
const extractMenuItemRefs = (child: MenuItemChildType): RefObject<any>[] => {
  // check that child has props
  const childProps: Record<string, any> = child?.props;
  // loop through each prop
  if (childProps) {
    const arrayProps = Object.values(childProps);
    // check if any is of type ref MenuItem
    return arrayProps.filter(ref => isAntdMenuItemRef(ref));
  }
  return [];
};

/**
 * Recursively extracts keys from menu items
 *
 * @param children
 * @param currentKeys
 * @returns an array of keys and their refs
 *
 */
const extractMenuItemsKeys = (
  children: MenuItemChildType[],
  currentKeys?: { key: string; ref?: RefObject<any> }[],
): { key: string; ref?: RefObject<any> }[] => {
  const allKeys = currentKeys || [];
  const arrayChildren = ensureIsArray(children);

  arrayChildren.forEach((child: MenuItemChildType) => {
    const isMenuItem = isAntdMenuItem(child);
    const refs = extractMenuItemRefs(child);
    // key is immediately available in a standard MenuItem
    if (isMenuItem) {
      const { key } = child;
      if (key) {
        allKeys.push({
          key,
        });
      }
    }
    // one or more menu items refs are available
    if (refs.length) {
      allKeys.push(
        ...refs.map(ref => ({ key: ref.current.props.eventKey, ref })),
      );
    }

    // continue to extract keys from nested children
    if (child?.props?.children) {
      const childKeys = extractMenuItemsKeys(child.props.children, allKeys);
      allKeys.push(...childKeys);
    }
  });

  return allKeys;
};

/**
 * Generates a map of keys and their types for a MenuItem
 * Individual refs can be given to extract keys from nested items
 * Refs can be used to control the event handlers of the menu items
 *
 * @param itemChildren
 * @param type
 * @returns a map of keys and their types
 */
const extractMenuItemsKeyMap = (
  children: MenuItemChildType,
): Record<string, any> => {
  const keysMap: Record<string, any> = {};
  const childrenArray = ensureIsArray(children);

  childrenArray.forEach((child: MenuItemChildType) => {
    const isMenuItem = isAntdMenuItem(child);
    const isSubmenu = isAntdMenuSubmenu(child);
    const menuItemsRefs = extractMenuItemRefs(child);

    // key is immediately available in MenuItem or SubMenu
    if (isMenuItem || isSubmenu) {
      const directKey = child?.key;
      if (directKey) {
        keysMap[directKey] = {};
        keysMap[directKey].type = isSubmenu
          ? MenuItemKeyEnum.SubMenu
          : MenuItemKeyEnum.MenuItem;
      }
    }

    // one or more menu items refs are available
    if (menuItemsRefs.length) {
      menuItemsRefs.forEach(ref => {
        const key = ref.current.props.eventKey;
        keysMap[key] = {};
        keysMap[key].type = isSubmenu
          ? MenuItemKeyEnum.SubMenu
          : MenuItemKeyEnum.MenuItem;
        keysMap[key].parent = child.key;
        keysMap[key].ref = ref;
      });
    }

    // if it has children must check for the presence of menu items
    if (child?.props?.children) {
      const theChildren = child?.props?.children;
      const childKeys = extractMenuItemsKeys(theChildren);
      childKeys.forEach(keyMap => {
        const k = keyMap.key;
        keysMap[k] = {};
        keysMap[k].type = MenuItemKeyEnum.SubMenuItem;
        keysMap[k].parent = child.key;
        if (keyMap.ref) {
          keysMap[k].ref = keyMap.ref;
        }
      });
    }
  });

  return keysMap;
};

/**
 *
 * Determines the next key to select based on the current key and direction
 *
 * @param keys
 * @param keysMap
 * @param currentKeyIndex
 * @param direction
 * @returns the selected key and the open key
 */
const getNavigationKeys = (
  keys: string[],
  keysMap: Record<string, any>,
  currentKeyIndex: number,
  direction = 'up',
) => {
  const step = direction === 'up' ? -1 : 1;
  const skipStep = direction === 'up' ? -2 : 2;
  const keysLen = direction === 'up' ? 0 : keys.length;
  const mathFn = direction === 'up' ? Math.max : Math.min;
  let openKey: string | undefined;
  let selectedKey = keys[mathFn(currentKeyIndex + step, keysLen)];

  // go to first key if current key is the last
  if (!selectedKey) {
    return { selectedKey: keys[0], openKey: undefined };
  }

  const isSubMenu = keysMap[selectedKey]?.type === MenuItemKeyEnum.SubMenu;
  if (isSubMenu) {
    // this is a submenu, skip to first submenu item
    selectedKey = keys[mathFn(currentKeyIndex + skipStep, keysLen)];
  }
  // re-evaulate if current selected key is a submenu or submenu item
  if (!isSubMenuOrItemType(keysMap[selectedKey].type)) {
    openKey = undefined;
  } else {
    const parentKey = keysMap[selectedKey].parent;
    if (parentKey) {
      openKey = parentKey;
    }
  }
  return { selectedKey, openKey };
};

export const handleDropdownNavigation = (
  e: KeyboardEvent<HTMLElement>,
  dropdownIsOpen: boolean,
  menu: ReactElement,
  toggleDropdown: () => void,
  setSelectedKeys: (keys: string[]) => void,
  setOpenKeys: (keys: string[]) => void,
) => {
  if (e.key === NAV_KEYS.tab && !dropdownIsOpen) {
    return; // if tab, continue with system tab navigation
  }
  const menuProps = menu.props || {};
  const keysMap = extractMenuItemsKeyMap(menuProps.children);
  const keys = Object.keys(keysMap);
  const { selectedKeys = [] } = menuProps;
  const currentKeyIndex = keys.indexOf(selectedKeys[0]);

  switch (e.key) {
    // toggle the dropdown on keypress
    case ACTION_KEYS.enter:
    case ACTION_KEYS.spacebar:
    case ACTION_KEYS.space:
      if (selectedKeys.length) {
        const currentKey = selectedKeys[0];
        const currentKeyConf = keysMap[selectedKeys];
        // when a menu item is selected, then trigger
        // the menu item's onClick handler
        menuProps.onClick?.({ key: currentKey, domEvent: e });
        // trigger click handle on ref
        if (currentKeyConf?.ref) {
          const refMenuItemProps = currentKeyConf.ref.current.props;
          refMenuItemProps.onClick?.({
            key: currentKey,
            domEvent: e,
          });
        }
        // clear out/deselect keys
        setSelectedKeys([]);
        // close submenus
        setOpenKeys([]);
        // put focus back on menu trigger
        e.currentTarget.focus();
      }
      // if nothing was selected, or after selecting new menu item,
      toggleDropdown();
      break;
    // select the menu items going down
    case NAV_KEYS.down:
    case NAV_KEYS.tab && !e.shiftKey: {
      const { selectedKey, openKey } = getNavigationKeys(
        keys,
        keysMap,
        currentKeyIndex,
        'down',
      );
      setSelectedKeys([selectedKey]);
      setOpenKeys(openKey ? [openKey] : []);
      break;
    }
    // select the menu items going up
    case NAV_KEYS.up:
    case NAV_KEYS.tab && e.shiftKey: {
      const { selectedKey, openKey } = getNavigationKeys(
        keys,
        keysMap,
        currentKeyIndex,
        'up',
      );
      setSelectedKeys([selectedKey]);
      setOpenKeys(openKey ? [openKey] : []);
      break;
    }
    case NAV_KEYS.escape:
      // close dropdown menu
      toggleDropdown();
      break;
    default:
      break;
  }
};
