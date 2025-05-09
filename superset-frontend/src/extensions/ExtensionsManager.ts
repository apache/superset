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
  private extensions: Map<string, Extension> = new Map();

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
    // Fetch extensions from the API
    const response = await SupersetClient.get({
      endpoint: `/api/v1/extensions/?module=${module}`,
    });
    const extensions: Extension[] = response.json.result;

    // Load and activate modules for each extension
    const loadedExtensions = await Promise.all(
      extensions.map(extension => this.loadModule(extension)),
    );

    // Store extensions in the map
    loadedExtensions.forEach(extension => {
      this.extensions.set(extension.name, extension);
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
   * Retrieves an extension by name.
   * @param name The name of the extension.
   * @returns The extension, or undefined if not found.
   */
  public getExtension(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Retrieves loaded extensions.
   * @returns An array of loaded extensions.
   */
  public getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Retrieves menu contributions for a specific key from all extensions.
   * @param key The key of the menu contribution.
   * @returns The menu contribution matching the key, or undefined if not found.
   */
  public getMenuContribution(key: string): MenuContribution | undefined {
    let results: MenuContribution | undefined;

    this.getExtensions().forEach(extension => {
      const { contributions } = extension;
      if (contributions.menus && contributions.menus[key]) {
        const contribution = contributions.menus[key];
        if (!results) {
          results = { ...contribution };
        } else {
          // Merge contributions if needed
          results.primary = [
            ...(results.primary || []),
            ...(contribution.primary || []),
          ];
          results.secondary = [
            ...(results.secondary || []),
            ...(contribution.secondary || []),
          ];
          results.context = [
            ...(results.context || []),
            ...(contribution.context || []),
          ];
        }
      }
    });

    return results;
  }

  /**
   * Retrieves view contributions for a specific key from all extensions.
   * @param key The key of the view contribution.
   * @returns An array of view contributions matching the key, or undefined if not found.
   */
  public getViewContributions(key: string): ViewContribution[] | undefined {
    let results: ViewContribution[] = [];

    this.getExtensions().forEach(extension => {
      const { contributions } = extension;
      if (contributions.views && contributions.views[key]) {
        results = [...results, ...contributions.views[key]];
      }
    });

    return results.length > 0 ? results : undefined;
  }

  /**
   * Retrieves command contributions.
   * @returns An array of all command contributions from all extensions.
   */
  public getCommandContributions(): CommandContribution[] {
    let results: CommandContribution[] = [];

    this.getExtensions().forEach(extension => {
      const { contributions } = extension;
      if (contributions.commands) {
        results = [...results, ...contributions.commands];
      }
    });

    return results;
  }
}

export default ExtensionsManager;
