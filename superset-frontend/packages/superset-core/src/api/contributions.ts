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
 * @fileoverview Contributions API for Superset extension UI integration.
 *
 * This module defines the interfaces and types for extension contributions to the
 * Superset user interface. Extensions use these contribution types to register
 * commands, menu items, and custom views that integrate seamlessly with the
 * Superset platform. The contribution system allows extensions to extend the
 * application's functionality while maintaining a consistent user experience.
 */

/**
 * Describes a command that can be contributed to the application.
 */
export interface CommandContribution {
  /** The unique identifier for the command. */
  command: string;
  /** The icon associated with the command. */
  icon: string;
  /** The display title of the command. */
  title: string;
  /** A description of what the command does. */
  description: string;
}

/**
 * Represents a menu item that links a view to a command.
 */
export interface MenuItem {
  /** The identifier of the view associated with this menu item. */
  view: string;
  /** The command to execute when this menu item is selected. */
  command: string;
}

/**
 * Defines the structure of menu contributions, allowing for primary, secondary, and context menus.
 */
export interface MenuContribution {
  /** Items to appear in the primary menu. */
  primary?: MenuItem[];
  /** Items to appear in the secondary menu. */
  secondary?: MenuItem[];
  /** Items to appear in the context menu. */
  context?: MenuItem[];
}

/**
 * Represents a contributed view in the application.
 */
export interface ViewContribution {
  /** The unique identifier for the view. */
  id: string;
  /** The display name of the view. */
  name: string;
}

/**
 * Aggregates all contributions (commands, menus, and views) provided by an extension or module.
 */
export interface Contributions {
  /** List of command contributions. */
  commands: CommandContribution[];
  /** Mapping of menu contributions by menu key. */
  menus: {
    [key: string]: MenuContribution;
  };
  /** Mapping of view contributions by view key. */
  views: {
    [key: string]: ViewContribution[];
  };
}
