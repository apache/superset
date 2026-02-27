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
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core';
import type { contributions, core } from '@apache-superset/core';
import { ExtensionContext } from '../core/models';

type MenuContribution = contributions.MenuContribution;
type MenuContributions = contributions.MenuContributions;
type ViewContribution = contributions.ViewContribution;
type ViewContributions = contributions.ViewContributions;
type CommandContribution = contributions.CommandContribution;
type EditorContribution = contributions.EditorContribution;
type Extension = core.Extension;

class ExtensionsManager {
  private static instance: ExtensionsManager;

  private extensionIndex: Map<string, Extension> = new Map();

  private contextIndex: Map<string, ExtensionContext> = new Map();

  private extensionContributions: Map<
    string,
    {
      menus?: MenuContributions;
      views?: ViewContributions;
      commands?: CommandContribution[];
      editors?: EditorContribution[];
    }
  > = new Map();

  // eslint-disable-next-line no-useless-constructor
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Singleton instance getter.
   * @returns The singleton instance of ExtensionsManager.
   */
  public static getInstance(): ExtensionsManager {
    if (!ExtensionsManager.instance) {
      ExtensionsManager.instance = new ExtensionsManager();
    }
    return ExtensionsManager.instance;
  }

  /**
   * Initializes extensions.
   * @throws Error if initialization fails.
   */
  public async initializeExtensions(): Promise<void> {
    const response = await SupersetClient.get({
      endpoint: '/api/v1/extensions/',
    });
    const extensions: Extension[] = response.json.result;
    await Promise.all(
      extensions.map(async extension => {
        await this.initializeExtension(extension);
      }),
    );
  }

  /**
   * Initializes an extension by its instance.
   * If the extension has a remote entry, it will load the module.
   * @param extension The extension to initialize.
   */
  public async initializeExtension(extension: Extension) {
    try {
      let loadedExtension = extension;
      if (extension.remoteEntry) {
        loadedExtension = await this.loadModule(extension);
        this.enableExtension(loadedExtension);
      }
      this.extensionIndex.set(loadedExtension.id, loadedExtension);
    } catch (error) {
      logging.error(
        `Failed to initialize extension ${extension.name}\n`,
        error,
      );
    }
  }

  /**
   * Enables an extension by its instance.
   * @param extension The extension to enable.
   */
  private enableExtension(extension: Extension): void {
    const { id } = extension;
    if (extension && typeof extension.activate === 'function') {
      // If already enabled, do nothing
      if (this.contextIndex.has(id)) {
        return;
      }
      const context = new ExtensionContext();
      this.contextIndex.set(id, context);
      // TODO: Activate based on activation events
      this.activateExtension(extension, context);
      this.indexContributions(extension);
    }
  }

  /**
   * Loads a single extension module.
   * @param extension The extension to load.
   * @returns The loaded extension with activate and deactivate methods.
   */
  private async loadModule(extension: Extension): Promise<Extension> {
    const { remoteEntry, id, exposedModules } = extension;

    // Load the remote entry script
    await new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = remoteEntry;
      element.type = 'text/javascript';
      element.async = true;
      element.onload = () => resolve();
      element.onerror = (
        event: Event | string,
        source?: string,
        lineno?: number,
        colno?: number,
        error?: Error,
      ) => {
        const errorDetails = [];
        if (source) errorDetails.push(`source: ${source}`);
        if (lineno !== undefined) errorDetails.push(`line: ${lineno}`);
        if (colno !== undefined) errorDetails.push(`column: ${colno}`);
        if (error?.message) errorDetails.push(`error: ${error.message}`);
        if (typeof event === 'string') errorDetails.push(`event: ${event}`);

        const detailsStr =
          errorDetails.length > 0 ? `\n${errorDetails.join(', ')}` : '';
        const errorMessage = `Failed to load remote entry: ${remoteEntry}${detailsStr}`;

        return reject(new Error(errorMessage));
      };

      document.head.appendChild(element);
    });

    // Initialize Webpack module federation
    // @ts-expect-error
    await __webpack_init_sharing__('default');
    // Use moduleFederationName (camelCase) for webpack container access, fallback to id for compatibility
    const containerName = (extension as any).moduleFederationName || id;
    const container = (window as any)[containerName];

    // @ts-expect-error
    await container.init(__webpack_share_scopes__.default);

    const factory = await container.get(exposedModules[0]);
    const Module = factory();
    return {
      ...extension,
      activate: Module.activate,
      deactivate: Module.deactivate,
    };
  }

  /**
   * Activates an extension if it has an activate method.
   * @param extension The extension to activate.
   * @param context The context to pass to the activate method.
   */
  public activateExtension(
    extension: Extension,
    context: ExtensionContext,
  ): void {
    if (extension.activate) {
      try {
        extension.activate(context);
      } catch (err) {
        logging.warn(`Error activating ${extension.name}`, err);
      }
    }
  }

  /**
   * Deactivates an extension.
   * @param id The id of the extension to deactivate.
   * @returns True if deactivated, false otherwise.
   */
  public deactivateExtension(id: string): boolean {
    const extension = this.extensionIndex.get(id);
    const context = extension ? this.contextIndex.get(extension.id) : undefined;
    if (extension && context) {
      try {
        // Dispose of all disposables in the context
        if (context.disposables) {
          context.disposables.forEach(d => d.dispose());
          context.disposables = [];
        }
        if (typeof extension.deactivate === 'function') {
          extension.deactivate();
        }
        return true;
      } catch (err) {
        logging.warn(`Error deactivating ${extension.name}`, err);
      }
    }
    return false;
  }

  /**
   * Indexes contributions from an extension for quick retrieval.
   * @param extension The extension to index.
   */
  private indexContributions(extension: Extension): void {
    const { contributions, id } = extension;
    this.extensionContributions.set(id, {
      menus: contributions.menus,
      views: contributions.views,
      commands: contributions.commands,
      editors: contributions.editors,
    });
  }

  /**
   * Retrieves menu contributions for a specific key.
   * @param key The key of the menu contributions in format "scope.location" (e.g., "sqllab.editor").
   * @returns The menu contributions matching the key, or undefined if not found.
   */
  public getMenuContributions(key: string): MenuContribution | undefined {
    const [scope, location] = key.split('.');
    if (!scope || !location) {
      return undefined;
    }
    const merged: MenuContribution = {
      context: [],
      primary: [],
      secondary: [],
    };
    for (const ext of this.extensionContributions.values()) {
      const scopeMenus = ext.menus?.[scope as keyof MenuContributions];
      const menu =
        scopeMenus?.[location as keyof NonNullable<typeof scopeMenus>];
      if (menu) {
        if (menu.context) merged.context!.push(...menu.context);
        if (menu.primary) merged.primary!.push(...menu.primary);
        if (menu.secondary) merged.secondary!.push(...menu.secondary);
      }
    }
    if (
      (merged.context?.length ?? 0) === 0 &&
      (merged.primary?.length ?? 0) === 0 &&
      (merged.secondary?.length ?? 0) === 0
    ) {
      return undefined;
    }
    return merged;
  }

  /**
   * Retrieves view contributions for a specific key.
   * @param key The key of the view contributions in format "scope.location" (e.g., "sqllab.panels").
   * @returns An array of view contributions matching the key, or undefined if not found.
   */
  public getViewContributions(key: string): ViewContribution[] | undefined {
    const [scope, location] = key.split('.');
    if (!scope || !location) {
      return undefined;
    }
    let result: ViewContribution[] = [];
    for (const ext of this.extensionContributions.values()) {
      const scopeViews = ext.views?.[scope as keyof ViewContributions];
      const views =
        scopeViews?.[location as keyof NonNullable<typeof scopeViews>];
      if (views) {
        result = result.concat(views);
      }
    }
    return result.length > 0 ? result : undefined;
  }

  /**
   * Retrieves all command contributions.
   * @returns An array of all command contributions.
   */
  public getCommandContributions(): CommandContribution[] {
    const result: CommandContribution[] = [];
    for (const ext of this.extensionContributions.values()) {
      if (ext.commands) {
        result.push(...ext.commands);
      }
    }
    return result;
  }

  /**
   * Retrieves a specific command contribution by its key.
   * @param key The key of the command contribution.
   * @returns The command contribution matching the key, or undefined if not found.
   */
  public getCommandContribution(key: string): CommandContribution | undefined {
    for (const ext of this.extensionContributions.values()) {
      if (ext.commands) {
        const found = ext.commands.find(cmd => cmd.command === key);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Retrieves all extensions.
   * @returns An array of all registered extensions.
   */
  public getExtensions(): Extension[] {
    return Array.from(this.extensionIndex.values());
  }

  /**
   * Retrieves a specific extension by its id.
   * @param id The id of the extension.
   * @returns The extension matching the id, or undefined if not found.
   */
  public getExtension(id: string): Extension | undefined {
    return this.extensionIndex.get(id);
  }

  /**
   * Retrieves all editor contributions from all extensions.
   * @returns An array of all editor contributions.
   */
  public getEditorContributions(): EditorContribution[] {
    const result: EditorContribution[] = [];
    for (const ext of this.extensionContributions.values()) {
      if (ext.editors) {
        result.push(...ext.editors);
      }
    }
    return result;
  }
}

export default ExtensionsManager;
