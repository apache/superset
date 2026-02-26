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

// Contribution configuration interfaces
export interface CommandConfig {
  id: string;
  title: string;
  icon?: string;
  execute: () => void | Promise<void>;
  when?: () => boolean;
  onActivate?: () => void; // Called when command is registered
  onDeactivate?: () => void; // Called when command is unregistered
}

export interface ViewConfig {
  id: string;
  title: string;
  location: string; // e.g., "dashboard.tabs", "explore.panels"
  component: React.ComponentType;
  when?: () => boolean;
  onActivate?: () => void; // Called when view is registered
  onDeactivate?: () => void; // Called when view is unregistered
}

export interface EditorConfig {
  id: string;
  name: string;
  mimeTypes: string[];
  component: React.ComponentType;
  onActivate?: () => void; // Called when editor is registered
  onDeactivate?: () => void; // Called when editor is unregistered
}

export interface MenuConfig {
  id: string;
  title: string;
  location: string; // e.g., "navbar.items", "context.menus"
  action: () => void | Promise<void>;
  when?: () => boolean;
  onActivate?: () => void; // Called when menu item is registered
  onDeactivate?: () => void; // Called when menu item is unregistered
}

// Extension metadata attached to defined contributions
export interface ContributionMetadata {
  type: 'command' | 'view' | 'editor' | 'menu';
  id: string;
  config: any;
}

// Handle returned by define* functions for cleanup
export interface ContributionHandle<T = any> {
  config: T;
  dispose: () => void;
  __contributionMeta__: ContributionMetadata;
}

// Extension context interface (simplified)
export interface ExtensionContext {
  registerCommand: (config: CommandConfig) => () => void;
  registerViewProvider: (
    id: string,
    component: React.ComponentType,
  ) => () => void;
  registerEditor: (config: EditorConfig) => () => void;
  registerMenu: (config: MenuConfig) => () => void;
}

// Global registry for auto-registration
let _context: ExtensionContext | null = null;
const _pendingContributions: ContributionHandle[] = [];

/**
 * Set the extension context for auto-registration.
 * Called automatically by the extension loader.
 */
export function setExtensionContext(context: ExtensionContext): void {
  _context = context;

  // Auto-register any pending contributions
  for (const handle of _pendingContributions) {
    _registerContribution(handle);
  }
  _pendingContributions.length = 0;
}

/**
 * Internal: Auto-register a single contribution
 */
function _registerContribution(handle: ContributionHandle): void {
  if (!_context) {
    _pendingContributions.push(handle);
    return;
  }

  const { config, __contributionMeta__ } = handle;
  let disposeFn: () => void;

  // Call onActivate callback if provided
  const typedConfig = config as
    | CommandConfig
    | ViewConfig
    | EditorConfig
    | MenuConfig;
  if (typedConfig.onActivate) {
    typedConfig.onActivate();
  }

  switch (__contributionMeta__.type) {
    case 'command':
      disposeFn = _context.registerCommand(config as CommandConfig);
      break;
    case 'view':
      const viewConfig = config as ViewConfig;
      disposeFn = _context.registerViewProvider(
        viewConfig.id,
        viewConfig.component,
      );
      break;
    case 'editor':
      disposeFn = _context.registerEditor(config as EditorConfig);
      break;
    case 'menu':
      disposeFn = _context.registerMenu(config as MenuConfig);
      break;
    default:
      throw new Error(
        `Unknown contribution type: ${__contributionMeta__.type}`,
      );
  }

  // Wrap dispose function to call onDeactivate
  const originalDispose = disposeFn;
  handle.dispose = () => {
    if (typedConfig.onDeactivate) {
      typedConfig.onDeactivate();
    }
    originalDispose();
  };
}

// Type augmentation to add metadata to functions
declare global {
  interface Function {
    __contributionMeta__?: ContributionMetadata;
  }
}

/**
 * Define a command contribution.
 *
 * Commands are actions that can be triggered from various UI elements
 * like menus, toolbars, or keyboard shortcuts.
 *
 * Auto-registers when extension context is available.
 *
 * @param config Command configuration
 * @returns Handle with config and dispose function
 */
export function defineCommand<T extends CommandConfig>(
  config: T,
): ContributionHandle<T> {
  // Store metadata for webpack plugin discovery
  const metadata: ContributionMetadata = {
    type: 'command',
    id: config.id,
    config,
  };

  // Attach metadata to the execute function for runtime validation
  if (config.execute) {
    config.execute.__contributionMeta__ = metadata;
  }

  // Create handle that auto-registers
  const handle: ContributionHandle<T> = {
    config,
    dispose: () => {}, // Will be set by _registerContribution
    __contributionMeta__: metadata,
  };

  // Auto-register immediately or queue for later
  _registerContribution(handle);

  return handle;
}

/**
 * Define a view contribution.
 *
 * Views are UI components that can be embedded in various locations
 * throughout the Superset interface.
 *
 * Auto-registers when extension context is available.
 *
 * @param config View configuration
 * @returns Handle with config and dispose function
 */
export function defineView<T extends ViewConfig>(
  config: T,
): ContributionHandle<T> {
  // Store metadata for webpack plugin discovery
  const metadata: ContributionMetadata = {
    type: 'view',
    id: config.id,
    config,
  };

  // Attach metadata to the component for runtime validation
  if (config.component) {
    (config.component as any).__contributionMeta__ = metadata;
  }

  // Create handle that auto-registers
  const handle: ContributionHandle<T> = {
    config,
    dispose: () => {}, // Will be set by _registerContribution
    __contributionMeta__: metadata,
  };

  // Auto-register immediately or queue for later
  _registerContribution(handle);

  return handle;
}

/**
 * Define an editor contribution.
 *
 * Editors provide custom editing interfaces for specific MIME types
 * in SQL Lab and other contexts.
 *
 * Auto-registers when extension context is available.
 *
 * @param config Editor configuration
 * @returns Handle with config and dispose function
 */
export function defineEditor<T extends EditorConfig>(
  config: T,
): ContributionHandle<T> {
  // Store metadata for webpack plugin discovery
  const metadata: ContributionMetadata = {
    type: 'editor',
    id: config.id,
    config,
  };

  // Attach metadata to the component for runtime validation
  if (config.component) {
    (config.component as any).__contributionMeta__ = metadata;
  }

  // Create handle that auto-registers
  const handle: ContributionHandle<T> = {
    config,
    dispose: () => {}, // Will be set by _registerContribution
    __contributionMeta__: metadata,
  };

  // Auto-register immediately or queue for later
  _registerContribution(handle);

  return handle;
}

/**
 * Define a menu contribution.
 *
 * Menus add items to various menu locations throughout the interface.
 *
 * Auto-registers when extension context is available.
 *
 * @param config Menu configuration
 * @returns Handle with config and dispose function
 */
export function defineMenu<T extends MenuConfig>(
  config: T,
): ContributionHandle<T> {
  // Store metadata for webpack plugin discovery
  const metadata: ContributionMetadata = {
    type: 'menu',
    id: config.id,
    config,
  };

  // Attach metadata to the action function for runtime validation
  if (config.action) {
    config.action.__contributionMeta__ = metadata;
  }

  // Create handle that auto-registers
  const handle: ContributionHandle<T> = {
    config,
    dispose: () => {}, // Will be set by _registerContribution
    __contributionMeta__: metadata,
  };

  // Auto-register immediately or queue for later
  _registerContribution(handle);

  return handle;
}

/**
 * Internal: Clear the contribution registry (for testing)
 */
export function _clearContributionRegistry(): void {
  _pendingContributions.length = 0;
  _context = null;
}
