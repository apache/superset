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
import {
  FeatureFlag,
  SupersetClient,
  isFeatureEnabled,
  logging,
} from '@superset-ui/core';
import type { contributions, core } from '@apache-superset/core';
import { ExtensionContext } from '../core/core';

class ExtensionsManager {
  private static instance: ExtensionsManager;

  private extensionIndex: Map<string, core.Extension> = new Map();

  private contextIndex: Map<string, ExtensionContext> = new Map();

  private extensionContributions: Map<
    string,
    {
      menus?: Record<string, contributions.MenuContribution>;
      views?: Record<string, contributions.ViewContribution[]>;
      commands?: contributions.CommandContribution[];
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
    if (!isFeatureEnabled(FeatureFlag.EnableExtensions)) {
      return;
    }
    const response = await SupersetClient.get({
      endpoint: '/api/v1/extensions/',
    });
    const extensions: core.Extension[] = response.json.result;
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
  public async initializeExtension(extension: core.Extension) {
    try {
      let loadedExtension = extension;
      if (extension.remoteEntry) {
        loadedExtension = await this.loadModule(extension);
        if (loadedExtension.enabled) {
          await this.enableExtension(loadedExtension);
        }
      }
      this.extensionIndex.set(loadedExtension.name, loadedExtension);
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
  private async enableExtension(extension: core.Extension): Promise<void> {
    const { name } = extension;
    if (extension && typeof extension.activate === 'function') {
      // If already enabled, do nothing
      if (this.contextIndex.has(name)) {
        return;
      }
      const context = new ExtensionContext();
      this.contextIndex.set(name, context);
      // TODO: Activate based on activation events
      this.activateExtension(extension, context);
      this.indexContributions(extension);

      if (!extension.enabled) {
        const updatedExtension = { ...extension, enabled: true };
        this.extensionIndex.set(updatedExtension.name, updatedExtension);
        await SupersetClient.put({
          endpoint: `/api/v1/extensions/${extension.name}`,
          jsonPayload: {
            enabled: true,
          },
        });
      }
    }
  }

  /**
   * Loads a single extension module.
   * @param extension The extension to load.
   * @returns The loaded extension with activate and deactivate methods.
   */
  private async loadModule(extension: core.Extension): Promise<core.Extension> {
    const { remoteEntry, name, exposedModules } = extension;

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
    // @ts-ignore
    await __webpack_init_sharing__('default');
    const container = (window as any)[name];

    // @ts-ignore
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
    extension: core.Extension,
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
   * @param name The name of the extension to deactivate.
   * @returns True if deactivated, false otherwise.
   */
  public deactivateExtension(name: string): boolean {
    const extension = this.extensionIndex.get(name);
    const context = extension
      ? this.contextIndex.get(extension.name)
      : undefined;
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
  private indexContributions(extension: core.Extension): void {
    const { contributions, name } = extension;
    this.extensionContributions.set(name, {
      menus: contributions.menus,
      views: contributions.views,
      commands: contributions.commands,
    });
  }

  /**
   * Retrieves menu contributions for a specific key.
   * @param key The key of the menu contributions.
   * @returns The menu contributions matching the key, or undefined if not found.
   */
  public getMenuContributions(
    key: string,
  ): contributions.MenuContribution | undefined {
    const merged: contributions.MenuContribution = {
      context: [],
      primary: [],
      secondary: [],
    };
    for (const ext of this.extensionContributions.values()) {
      if (ext.menus && ext.menus[key]) {
        const menu = ext.menus[key];
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
   * @param key The key of the view contributions.
   * @returns An array of view contributions matching the key, or undefined if not found.
   */
  public getViewContributions(
    key: string,
  ): contributions.ViewContribution[] | undefined {
    let result: contributions.ViewContribution[] = [];
    for (const ext of this.extensionContributions.values()) {
      if (ext.views && ext.views[key]) {
        result = result.concat(ext.views[key]);
      }
    }
    return result.length > 0 ? result : undefined;
  }

  /**
   * Retrieves all command contributions.
   * @returns An array of all command contributions.
   */
  public getCommandContributions(): contributions.CommandContribution[] {
    const result: contributions.CommandContribution[] = [];
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
  public getCommandContribution(
    key: string,
  ): contributions.CommandContribution | undefined {
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
  public getExtensions(): core.Extension[] {
    return Array.from(this.extensionIndex.values());
  }

  /**
   * Retrieves a specific extension by its name.
   * @param name The name of the extension.
   * @returns The extension matching the name, or undefined if not found.
   */
  public getExtension(name: string): core.Extension | undefined {
    return this.extensionIndex.get(name);
  }
}

export default ExtensionsManager;
