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

/**
 * @fileoverview Standalone menus registry implementation.
 *
 * Stores menu item registrations as module-level state.
 * Extensions register menu items as side effects at import time.
 */

import { useSyncExternalStore } from 'react';
import type { menus as menusApi } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type MenuItem = menusApi.MenuItem;
type PageMenuItem = menusApi.PageMenuItem;
type Menu = menusApi.Menu;
type MenuItemRegisteredEvent = menusApi.MenuItemRegisteredEvent;
type MenuItemUnregisteredEvent = menusApi.MenuItemUnregisteredEvent;

type StoredMenuItem = {
  item: MenuItem | PageMenuItem;
  location: string;
  group: 'primary' | 'secondary' | 'context';
};

/** A page item is the one that names a page; a menu item names a command. */
const isPageItem = (item: MenuItem | PageMenuItem): item is PageMenuItem =>
  typeof (item as PageMenuItem)?.page === 'string';

const menuItems: StoredMenuItem[] = [];

const syncListeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const registerEmitter = createEventEmitter<MenuItemRegisteredEvent>();
const unregisterEmitter = createEventEmitter<MenuItemUnregisteredEvent>();

const menuCache = new Map<string, Menu | undefined>();
/** Drops the cache and re-renders `useMenu` callers. */
const notifyChanged = () => {
  menuCache.clear();
  syncListeners.forEach(l => l());
};
const notifyRegister = (event: MenuItemRegisteredEvent) => {
  notifyChanged();
  registerEmitter.fire(event);
};
const notifyUnregister = (event: MenuItemUnregisteredEvent) => {
  notifyChanged();
  unregisterEmitter.fire(event);
};

/**
 * The main navigation bar, beside Dashboards, Charts and Datasets.
 */
export const NAVBAR_LOCATION = 'global.navbar';

/**
 * The Settings dropdown. An item's `section` chooses which of its named
 * groups to join.
 */
export const SETTINGS_MENU_LOCATION = 'global.settingsMenu';

/** The two application menus, which take a page item rather than a command. */
const PAGE_MENU_LOCATIONS: string[] = [NAVBAR_LOCATION, SETTINGS_MENU_LOCATION];

const registerMenuItemImpl = (
  item: MenuItem | PageMenuItem,
  location: string,
  group: 'primary' | 'secondary' | 'context',
): Disposable => {
  // Thrown, not skipped. Each case below is an item that could never do
  // anything at the location it names, and a skipped item is invisible with
  // nothing said about why -- the one outcome worth ruling out.
  const page = isPageItem(item);
  const isPageLocation = PAGE_MENU_LOCATIONS.includes(location);
  if (page && !isPageLocation) {
    throw new Error(
      `A menu item at "${location}" names a page, but only ` +
        `"${NAVBAR_LOCATION}" and "${SETTINGS_MENU_LOCATION}" open pages. ` +
        `Elsewhere an item names a view and a command.`,
    );
  }
  if (!page && isPageLocation) {
    throw new Error(
      `A menu item at "${location}" names no page. The navbar and the ` +
        `Settings dropdown are menus of the application rather than of a ` +
        `view, so an item there sets "page" to the id of a view registered ` +
        `at the page location.`,
    );
  }

  const stored: StoredMenuItem = { item, location, group };
  menuItems.push(stored);
  // The register and unregister events carry command items only, so a
  // listener written against `MenuItem` never receives one without a `view`
  // or a `command`. Page items are read back through `getMenu`, which the
  // host's own `useMenu` subscribes to.
  if (page) {
    notifyChanged();
  } else {
    notifyRegister({ item: item as MenuItem, location, group });
  }
  return new Disposable(() => {
    const index = menuItems.indexOf(stored);
    if (index >= 0) {
      menuItems.splice(index, 1);
    }
    if (page) {
      notifyChanged();
    } else {
      notifyUnregister({ item: item as MenuItem, location, group });
    }
  });
};

// Cast because the declared signature is overloaded: the implementation takes
// the union of both forms and sorts them out at runtime, which is what the
// overloads describe to a caller.
const registerMenuItem =
  registerMenuItemImpl as typeof menusApi.registerMenuItem;

const getMenu: typeof menusApi.getMenu = (
  location: string,
): Menu | undefined => {
  const items = menuItems.filter(entry => entry.location === location);
  if (items.length === 0) return undefined;

  const result: Menu = {};

  // `order` first where an item carries one, then registration order for
  // ties. Without this the sequence is whichever remote entry finished
  // loading first, which moves with the network rather than with anything an
  // author chose.
  const orderOf = (item: MenuItem | PageMenuItem) =>
    isPageItem(item)
      ? (item.order ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
  const ordered = items
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        orderOf(a.entry.item) - orderOf(b.entry.item) || a.index - b.index,
    )
    .map(({ entry }) => entry);

  for (const { item, group } of ordered) {
    if (isPageItem(item)) {
      // Flat, and not under a group: `group` names a menu of a view, and the
      // two locations that take page items have no such division.
      result.pages = result.pages ?? [];
      result.pages.push(item);
    } else if (group === 'primary') {
      result.primary = result.primary ?? [];
      result.primary.push(item);
    } else if (group === 'secondary') {
      result.secondary = result.secondary ?? [];
      result.secondary.push(item);
    } else if (group === 'context') {
      result.context = result.context ?? [];
      result.context.push(item);
    }
  }

  return result;
};

export const useMenu = (location: string): Menu | undefined =>
  useSyncExternalStore(
    subscribe,
    () => {
      if (!menuCache.has(location)) {
        menuCache.set(location, getMenu(location));
      }
      return menuCache.get(location);
    },
    () => undefined,
  );

export const onDidRegisterMenuItem: typeof menusApi.onDidRegisterMenuItem = (
  listener: (e: MenuItemRegisteredEvent) => void,
  thisArgs?: unknown,
): Disposable => registerEmitter.subscribe(listener, thisArgs);

export const onDidUnregisterMenuItem: typeof menusApi.onDidUnregisterMenuItem =
  (
    listener: (e: MenuItemUnregisteredEvent) => void,
    thisArgs?: unknown,
  ): Disposable => unregisterEmitter.subscribe(listener, thisArgs);

export const menus: typeof menusApi = {
  registerMenuItem,
  getMenu,
  NAVBAR_LOCATION,
  SETTINGS_MENU_LOCATION,
  onDidRegisterMenuItem,
  onDidUnregisterMenuItem,
};
