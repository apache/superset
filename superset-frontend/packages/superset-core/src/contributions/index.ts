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
 * menus, editors) and re-exported here for the manifest schema.
 */

import { Command } from '../commands';
import { View } from '../views';
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
 * Aggregates all contributions (commands, menus, views, and editors) provided by an extension or module.
 */
export interface Contributions {
  /** List of commands. */
  commands: Command[];
  /** Nested mapping of menu contributions by scope and location. */
  menus: MenuContributions;
  /** Nested mapping of view contributions by scope and location. */
  views: ViewContributions;
  /** List of editors. */
  editors?: Editor[];
}
