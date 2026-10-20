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
 * @fileoverview Manifest schema for Superset extension contributions.
 *
 * This module defines the aggregate interfaces used by the extension.json
 * manifest and the `superset-extensions` build command. Individual metadata
 * types are defined in their respective namespace modules (commands, views,
 * menus, editors, chat) and re-exported here for the manifest schema.
 */

import { Chat } from '../chat';
import { Command } from '../commands';
import { Page, View } from '../views';
import { Menu } from '../menus';
import { Editor } from '../editors';

/**
 * Valid locations within SQL Lab.
 */
export type SqlLabLocation =
  | 'leftSidebar'
  | 'rightSidebar'
  | 'panels'
  | 'editor'
  | 'statusBar'
  | 'results'
  | 'queryHistory';

/**
 * Nested structure for view contributions by scope and location.
 * @example
 * {
 *   sqllab: {
 *     panels: [{ id: "my-ext.panel", name: "My Panel" }],
 *     leftSidebar: [{ id: "my-ext.sidebar", name: "My Sidebar" }]
 *   }
 * }
 */
export interface ViewContributions {
  sqllab?: Partial<Record<SqlLabLocation, View[]>>;
}

/**
 * Nested structure for menu contributions by scope and location.
 * @example
 * {
 *   sqllab: {
 *     editor: { primary: [...], secondary: [...] }
 *   }
 * }
 */
export interface MenuContributions {
  sqllab?: Partial<Record<SqlLabLocation, Menu>>;
}

/**
 * Aggregates all contributions (commands, menus, views, editors, and chat)
 * provided by an extension or module.
 */
/**
 * A page as it is declared in the manifest.
 *
 * Carries one thing the runtime `Page` does not: the permission that guards
 * the page's URL. The host serves the application shell at that path so a cold
 * load, a refresh or a bookmark resolves, and that server-side route has to be
 * guarded like any other page in Superset. Naming an existing permission --
 * the resource the extension's own API registers -- means nothing new has to
 * be created and granted before the page is reachable.
 */
export interface PageContribution extends Page {
  permission: {
    /** FAB resource name, e.g. the extension API's `class_permission_name`. */
    resource: string;
    /** FAB action name. Defaults to `read`. */
    action?: string;
  };
}

export interface Contributions {
  /** List of commands. */
  commands: Command[];
  /** Nested mapping of menu contributions by scope and location. */
  menus: MenuContributions;
  /** Nested mapping of view contributions by scope and location. */
  views: ViewContributions;
  /**
   * Top-level pages contributed by the extension. Each is mounted by the host
   * as a client-side route at its declared `path`, so unlike a view it is not
   * a slot inside a surface the host already ships.
   */
  pages?: PageContribution[];
  /** List of editors. */
  editors?: Editor[];
  /**
   * The chat contributed by the extension — at most one per extension, since
   * the host applies singleton resolution and renders exactly one active
   * chat at a time.
   */
  chat?: Chat;
}
