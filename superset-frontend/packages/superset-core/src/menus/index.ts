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
 * @fileoverview Menus registration API for Superset extensions.
 *
 * This module provides functions for registering menu items at specific
 * locations in the Superset UI. Menu items link commands to views and
 * are organized into primary, secondary, and context menu groups.
 *
 * @example
 * ```typescript
 * import { menus } from '@apache-superset/core';
 *
 * menus.registerMenuItem({
 *   command: 'sqllab_parquet.export',
 *   view: 'builtin.editor',
 *   location: 'sqllab.editor',
 *   group: 'secondary',
 * });
 * ```
 */

import { Disposable, Event } from '../common';

/**
 * Fields shared by every kind of menu item.
 */
export interface MenuItemBase {
  /**
   * The identifier of the view this menu item is attached to (e.g.
   * `'builtin.editor'` in SQL Lab). Optional: an item in a host menu such as
   * the Settings menu has no hosting view.
   */
  view?: string;
  /** Icon name, resolved against the host icon set (e.g. `'BellOutlined'`). */
  icon?: string;
  /**
   * Sort weight among the contributed items at a location. Lower sorts
   * first; items without an `order` sort last, in registration order.
   */
  order?: number;
  /** Optional description of the menu item, for display in contribution manifests. */
  description?: string;
}

/**
 * A menu item that navigates to an extension page: the id of a view
 * registered at `global.page` (see `views.Locations.page`). The host renders
 * it as a real link to `/extensions/pages/<page>`, labelled with the view's
 * `name`, and skips it while that page isn't registered or the user lacks
 * the page's permission.
 */
export interface PageMenuItem extends MenuItemBase {
  /** Id of a view registered at `global.page`. */
  page: string;
  command?: never;
}

/**
 * A menu item that executes a command when selected, labelled with the
 * command's `title`.
 */
export interface CommandMenuItem extends MenuItemBase {
  /** The command to execute when this menu item is selected. */
  command: string;
  page?: never;
}

/**
 * A menu item: exactly one of `page` (navigate to an extension page) or
 * `command` (run a command). `registerMenuItem` throws on an item that sets
 * neither or both.
 */
export type MenuItem = PageMenuItem | CommandMenuItem;

/**
 * Host menu locations outside SQL Lab that render contributed menu items.
 */
export declare const Locations: {
  /** The "Settings" dropdown in the top navigation bar. */
  readonly settingsMenu: 'global.settingsMenu';
};

/**
 * Defines the structure of registered menu items, organized into primary, secondary, and context menus.
 */
export interface Menu {
  /** Items to appear in the primary menu. */
  primary?: MenuItem[];
  /** Items to appear in the secondary menu. */
  secondary?: MenuItem[];
  /** Items to appear in the context menu. */
  context?: MenuItem[];
}

/**
 * Registers a menu item at a specific UI location.
 *
 * @param item The menu item: a `page` to navigate to or a `command` to run.
 * @param location The location where this menu item should appear (e.g. "sqllab.editor").
 * @param group The menu group to place this item in.
 * @returns A Disposable that unregisters the menu item when disposed.
 * @throws If the item sets neither or both of `page` and `command`.
 *
 * @example
 * ```typescript
 * menus.registerMenuItem(
 *   { command: 'sqllab_parquet.export', view: 'builtin.editor' },
 *   'sqllab.editor',
 *   'secondary',
 * );
 *
 * // An entry in the Settings menu that opens an extension page:
 * menus.registerMenuItem(
 *   { page: 'acme.catalog.main', icon: 'DatabaseOutlined' },
 *   menus.Locations.settingsMenu,
 *   'primary',
 * );
 * ```
 */
export declare function registerMenuItem(
  item: MenuItem,
  location: string,
  group: 'primary' | 'secondary' | 'context',
): Disposable;

/**
 * Retrieves all menu items registered at a specific location,
 * grouped by primary, secondary, and context.
 *
 * @param location The location to retrieve registered menu items for (e.g. "sqllab.editor").
 * @returns A Menu object, or undefined if none are registered.
 *
 * @example
 * ```typescript
 * const editorMenus = menus.getMenu('sqllab.editor');
 * if (editorMenus?.secondary) {
 *   // render secondary menu items
 * }
 * ```
 */
export declare function getMenu(location: string): Menu | undefined;

/**
 * Event fired when a menu item is registered.
 */
export interface MenuItemRegisteredEvent {
  /** The menu item that was registered. */
  item: MenuItem;
  /** The location where the item was registered. */
  location: string;
  /** The group the item was placed in. */
  group: 'primary' | 'secondary' | 'context';
}

/**
 * Event fired when a menu item is unregistered.
 */
export interface MenuItemUnregisteredEvent {
  /** The menu item that was unregistered. */
  item: MenuItem;
  /** The location where the item was registered. */
  location: string;
  /** The group the item was placed in. */
  group: 'primary' | 'secondary' | 'context';
}

/**
 * Event fired when a menu item is registered.
 */
export declare const onDidRegisterMenuItem: Event<MenuItemRegisteredEvent>;

/**
 * Event fired when a menu item is unregistered.
 */
export declare const onDidUnregisterMenuItem: Event<MenuItemUnregisteredEvent>;
