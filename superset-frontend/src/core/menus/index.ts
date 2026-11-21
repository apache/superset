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
type Menu = menusApi.Menu;
type MenuItemRegisteredEvent = menusApi.MenuItemRegisteredEvent;
type MenuItemUnregisteredEvent = menusApi.MenuItemUnregisteredEvent;

type StoredMenuItem = {
  item: MenuItem;
  location: string;
  group: 'primary' | 'secondary' | 'context';
};

const menuItems: StoredMenuItem[] = [];

const syncListeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const registerEmitter = createEventEmitter<MenuItemRegisteredEvent>();
const unregisterEmitter = createEventEmitter<MenuItemUnregisteredEvent>();

const menuCache = new Map<string, Menu | undefined>();
const notifyRegister = (event: MenuItemRegisteredEvent) => {
  menuCache.clear();
  syncListeners.forEach(l => l());
  registerEmitter.fire(event);
};
const notifyUnregister = (event: MenuItemUnregisteredEvent) => {
  menuCache.clear();
  syncListeners.forEach(l => l());
  unregisterEmitter.fire(event);
};

/** Host menu locations outside SQL Lab (see `menus.Locations` in the SDK). */
export const MenuLocations: typeof menusApi.Locations = {
  settingsMenu: 'global.settingsMenu',
};

/**
 * `MenuItem` is a union, but extensions are plain JS at runtime, so the
 * "exactly one of `page` / `command`" rule is enforced here rather than
 * left to the host surfaces to skip silently.
 */
const validateMenuItem = (item: MenuItem, location: string): void => {
  const hasPage = typeof item?.page === 'string' && item.page.length > 0;
  const hasCommand =
    typeof item?.command === 'string' && item.command.length > 0;
  if (hasPage === hasCommand) {
    throw new Error(
      `Menu item at "${location}" must set exactly one of "page" or ` +
        `"command" (got ${hasPage ? 'both' : 'neither'}).`,
    );
  }
};

/**
 * Contributed items in render order: by `order` (unset sorts last), then
 * by registration order. `Array.prototype.sort` is stable, so ties keep
 * the order they were registered in.
 */
export const sortMenuItems = <T extends MenuItem>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || 0);

const registerMenuItem: typeof menusApi.registerMenuItem = (
  item: MenuItem,
  location: string,
  group: 'primary' | 'secondary' | 'context',
): Disposable => {
  validateMenuItem(item, location);
  const stored: StoredMenuItem = { item, location, group };
  menuItems.push(stored);
  notifyRegister({ item, location, group });
  return new Disposable(() => {
    const index = menuItems.indexOf(stored);
    if (index >= 0) {
      menuItems.splice(index, 1);
    }
    notifyUnregister({ item, location, group });
  });
};

const getMenu: typeof menusApi.getMenu = (
  location: string,
): Menu | undefined => {
  const items = menuItems.filter(entry => entry.location === location);
  if (items.length === 0) return undefined;

  const result: Menu = {};

  for (const { item, group } of items) {
    if (group === 'primary') {
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
  Locations: MenuLocations,
  registerMenuItem,
  getMenu,
  onDidRegisterMenuItem,
  onDidUnregisterMenuItem,
};
