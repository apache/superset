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
 * What every menu item carries, whatever it points at.
 */
export interface MenuItemBase {
  /**
   * The view this item is attached to, where the location has one -- a SQL
   * Lab toolbar belongs to an editor. A navbar item has no hosting view, so
   * this is optional.
   */
  view?: string;
  /** Optional description of the menu item, for display in contribution manifests. */
  description?: string;
  /** Name of an icon to render beside the label. */
  icon?: string;
  /**
   * Sort position within the location. Lower comes first; items without one
   * come last, and ties keep registration order.
   *
   * Without it the order is the order bundles happen to finish loading, which
   * is network timing rather than anything an author chose.
   */
  order?: number;
  /**
   * At a location whose menu is divided into named groups -- the Settings
   * dropdown's Data, Security and Manage -- the group this item joins.
   *
   * Ignored where a location has no groups. A group the host did not render
   * is not invented: the item is skipped, the same as one whose target is
   * unregistered. Superset builds Manage only when the user may see
   * something in it, so a group conjured here would be one the rest of the
   * application does not agree exists.
   */
  section?: string;
}

/**
 * An item that navigates to a page.
 *
 * Declarative rather than a command so the host can render a real link --
 * middle-click, ctrl-click, open in a new tab, and a screen reader all work
 * -- highlight it when the page is the current one, and leave it out when
 * nothing has registered the page. Its click handler is the host's own
 * `core.navigation.openPage` command.
 */
export interface PageMenuItem extends MenuItemBase {
  /**
   * Id of a view registered at `views.PAGE_LOCATION`, navigated to at
   * `/extensions/pages/<page>`. The label is that view's `name`.
   */
  page: string;
  command?: never;
}

/**
 * An item that runs a command without navigating -- opening a modal,
 * starting a job. The label is the command's `title`.
 */
export interface CommandMenuItem extends MenuItemBase {
  /** The command to execute when this menu item is selected. */
  command: string;
  page?: never;
}

/**
 * A menu item: exactly one of `page` or `command`.
 *
 * `registerMenuItem` throws on an item that sets neither or both, rather
 * than the host silently skipping it -- an item that never appears, with
 * nothing said about why, is the hardest kind of mistake to find.
 */
export type MenuItem = PageMenuItem | CommandMenuItem;

/**
 * The main navigation bar, beside Dashboards, Charts and Datasets.
 *
 * Contributed items are appended after the built-ins and cannot displace
 * them. Past a small number they collapse into an overflow, so a handful of
 * extensions cannot wrap the bar under the logo.
 */
export declare const NAVBAR_LOCATION: string;

/**
 * The Settings dropdown.
 *
 * Use `section` to join one of its named groups -- `'Manage'` for an
 * administrative screen -- rather than sitting at the top of the dropdown.
 */
export declare const SETTINGS_MENU_LOCATION: string;

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
 * @param item The menu item linking a view to a command.
 * @param location The location where this menu item should appear (e.g. "sqllab.editor").
 * @param group The menu group to place this item in.
 * @returns A Disposable that unregisters the menu item when disposed.
 *
 * @example
 * ```typescript
 * menus.registerMenuItem(
 *   { command: 'sqllab_parquet.export', view: 'builtin.editor' },
 *   'sqllab.editor',
 *   'secondary',
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
