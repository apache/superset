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
 * Represents a menu item that links a view to a command.
 */
/** What every menu item carries, whatever it does when selected. */
interface MenuItemBase {
  /**
   * The view this item belongs to, where the location sits inside one.
   *
   * Optional, because a navbar item has no hosting view.
   */
  view?: string;
  /** Optional description of the menu item, for display in contribution manifests. */
  description?: string;
  /** Optional icon name, rendered beside the label. */
  icon?: string;
  /**
   * Sort position within the location. Lower comes first; items without one
   * come last, and ties keep registration order.
   *
   * Without it the order is the order bundles happen to finish loading, which
   * is network timing rather than anything an author chose.
   */
  order?: number;
}

/** A menu item that navigates to a page. */
export interface PageMenuItem extends MenuItemBase {
  /**
   * Id of a view registered at `views.PAGE_LOCATION`. Selecting the item
   * navigates to that page, and its label is the view's `name`.
   */
  page: string;
  command?: never;
}

/** A menu item that runs a command. */
export interface CommandMenuItem extends MenuItemBase {
  /** The command to execute when this menu item is selected. */
  command: string;
  page?: never;
}

/**
 * An item in a menu: either somewhere to go or something to do.
 *
 * Exactly one of `page` and `command` is set. `registerMenuItem` throws on an
 * item that sets neither or both, rather than the host silently skipping it at
 * render time, where the author has nothing to go on.
 */
export type MenuItem = PageMenuItem | CommandMenuItem;

/**
 * The location of the host's main navigation bar.
 *
 * Items are appended after the host's own entries, so no extension can
 * displace Dashboards, Charts, Datasets or SQL Lab.
 */
export declare const NAVBAR_LOCATION: string;

/** The location of the Settings dropdown. */
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
