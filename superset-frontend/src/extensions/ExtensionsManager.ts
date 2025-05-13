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
import { SupersetClient, logging } from '@superset-ui/core';
import {
  CommandContribution,
  Extension,
  MenuContribution,
  Module,
  ViewContribution,
} from './types';

class ExtensionsManager {
  private static instance: ExtensionsManager;
  private extensionIndex: Map<string, Extension> = new Map();
  private menuIndex: Map<string, MenuContribution> = new Map();
  private viewIndex: Map<string, ViewContribution[]> = new Map();
  private commandIndex: Map<string, CommandContribution> = new Map();

  private constructor() {}

  public static getInstance(): ExtensionsManager {
    if (!ExtensionsManager.instance) {
      ExtensionsManager.instance = new ExtensionsManager();
    }
    return ExtensionsManager.instance;
  }

  /**
   * Initializes extensions for a given module.
   * @param module The module to load extensions for.
   * @throws Error if initialization fails.
   */
  public async initialize(module: Module): Promise<void> {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/extensions/?module=${module}`,
    });
    const extensions: Extension[] = response.json.result;

    const loadedExtensions = await Promise.all(
      extensions.map(extension => this.loadModule(extension)),
    );

    loadedExtensions.forEach(extension => {
      this.extensionIndex.set(extension.name, extension);
      this.indexContributions(extension);
    });
  }

  /**
   * Loads a single extension module.
   * @param extension The extension to load.
   * @returns The loaded extension with activate and deactivate methods.
   */
  private async loadModule(extension: Extension): Promise<Extension> {
    const { remoteEntry, name, exposedModules } = extension;

    // Load the remote entry script
    await new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = remoteEntry;
      element.type = 'text/javascript';
      element.async = true;
      element.onload = () => resolve();
      element.onerror = () =>
        reject(new Error(`Failed to load remote entry: ${remoteEntry}`));
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

    // Activate the module if it has an activate method
    if (Module.activate) {
      try {
        Module.activate();
      } catch (err) {
        logging.warn(`Error activating ${extension.name}`, err);
      }
    }

    return {
      ...extension,
      activate: Module.activate,
      deactivate: Module.deactivate,
    };
  }

  /**
   * Indexes contributions from an extension for quick retrieval.
   * @param extension The extension to index.
   */
  private indexContributions(extension: Extension): void {
    const { contributions } = extension;

    if (contributions.menus) {
      this.indexMenus(contributions.menus);
    }

    if (contributions.views) {
      this.indexViews(contributions.views);
    }

    if (contributions.commands) {
      this.indexCommands(contributions.commands);
    }
  }

  /**
   * Indexes menu contributions.
   * @param menus The menus to index.
   */
  private indexMenus(menus: Record<string, MenuContribution>): void {
    Object.entries(menus).forEach(([key, menu]) => {
      if (!this.menuIndex.has(key)) {
        this.menuIndex.set(key, { ...menu });
      } else {
        const existing = this.menuIndex.get(key)!;
        existing.primary = [
          ...(existing.primary || []),
          ...(menu.primary || []),
        ];
        existing.secondary = [
          ...(existing.secondary || []),
          ...(menu.secondary || []),
        ];
        existing.context = [
          ...(existing.context || []),
          ...(menu.context || []),
        ];
      }
    });
  }

  /**
   * Indexes view contributions.
   * @param views The views to index.
   */
  private indexViews(views: Record<string, ViewContribution[]>): void {
    Object.entries(views).forEach(([key, viewList]) => {
      if (!this.viewIndex.has(key)) {
        this.viewIndex.set(key, [...viewList]);
      } else {
        this.viewIndex.set(key, [...this.viewIndex.get(key)!, ...viewList]);
      }
    });
  }

  /**
   * Indexes command contributions.
   * @param commands The commands to index.
   */
  private indexCommands(commands: CommandContribution[]): void {
    commands.forEach(command => {
      this.commandIndex.set(command.command, command);
    });
  }

  /**
   * Retrieves menu contributions for a specific key.
   * @param key The key of the menu contributions.
   * @returns The menu contributions matching the key, or undefined if not found.
   */
  public getMenuContributions(key: string): MenuContribution | undefined {
    return this.menuIndex.get(key);
  }

  /**
   * Retrieves view contributions for a specific key.
   * @param key The key of the view contributions.
   * @returns An array of view contributions matching the key, or undefined if not found.
   */
  public getViewContributions(key: string): ViewContribution[] | undefined {
    return this.viewIndex.get(key);
  }

  /**
   * Retrieves all command contributions.
   * @returns An array of all command contributions.
   */
  public getCommandContributions(): CommandContribution[] {
    return Array.from(this.commandIndex.values());
  }

  /**
   * Retrieves a specific command contribution by its key.
   * @param key The key of the command contribution.
   * @returns The command contribution matching the key, or undefined if not found.
   */
  public getCommandContribution(key: string): CommandContribution | undefined {
    return this.commandIndex.get(key);
  }
}

export default ExtensionsManager;
