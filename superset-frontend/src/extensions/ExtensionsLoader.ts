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
import { logging } from '@apache-superset/core/utils';
import type { common as core } from '@apache-superset/core';
import { storage } from 'src/core';
import './types';

type Extension = core.Extension;

/**
 * Loads extension modules via webpack module federation.
 *
 * Extensions register their contributions (commands, views, menus, editors)
 * as module-level side effects when their module is imported. The loader
 * only handles fetching and importing the remote modules.
 */
class ExtensionsLoader {
  private static instance: ExtensionsLoader;

  private extensionIndex: Map<string, Extension> = new Map();

  // eslint-disable-next-line no-useless-constructor
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Singleton instance getter.
   * @returns The singleton instance of ExtensionsLoader.
   */
  public static getInstance(): ExtensionsLoader {
    if (!ExtensionsLoader.instance) {
      ExtensionsLoader.instance = new ExtensionsLoader();
    }
    return ExtensionsLoader.instance;
  }

  /**
   * Initializes extensions by fetching the list from the API and loading each one.
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
   * Initializes a single extension.
   * If the extension has a remote entry, loads the module (which triggers
   * side-effect registrations for commands, views, menus, and editors).
   * @param extension The extension to initialize.
   */
  public async initializeExtension(extension: Extension) {
    try {
      if (extension.remoteEntry) {
        await this.loadModule(extension);
      }
      this.extensionIndex.set(extension.id, extension);
    } catch (error) {
      logging.error(
        `Failed to initialize extension ${extension.name}\n`,
        error,
      );
    }
  }

  /**
   * Loads a single extension module via webpack module federation.
   * The module's top-level side effects fire contribution registrations.
   * @param extension The extension to load.
   */
  private async loadModule(extension: Extension): Promise<void> {
    const { remoteEntry, id } = extension;

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

    const factory = await container.get('./index');

    // Bind storage to this extension before executing the module.
    // The extension's imports resolve via webpack externals at load time,
    // capturing this bound instance.
    window.superset.storage = storage.forExtension(id);

    // Execute the module factory - side effects fire registrations
    factory();
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
}

export default ExtensionsLoader;
