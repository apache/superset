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
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import type { common as core } from '@apache-superset/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';

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

  private initializationPromise: Promise<void> | null = null;

  /** Disposables returned by contribution registrations, keyed by extension id. */
  private extensionDisposables: Map<string, (() => void)[]> = new Map();

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
  public initializeExtensions(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = (async () => {
      try {
        const response = await SupersetClient.get({
          endpoint: '/api/v1/extensions/',
        });
        const extensions: Extension[] = response.json.result;
        await Promise.all(
          extensions.map(async extension => {
            await this.initializeExtension(extension);
          }),
        );
        logging.info('Extensions initialized successfully.');
      } catch (error) {
        logging.error('Error setting up extensions:', error);
      }
    })();
    return this.initializationPromise;
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
        const disposables = await this.loadModule(extension);
        this.extensionDisposables.set(extension.id, disposables);
      }
      this.extensionIndex.set(extension.id, extension);
    } catch (error) {
      logging.error(
        `Failed to initialize extension ${extension.name}\n`,
        error,
      );
      store.dispatch(
        addDangerToast(t('Extension "%s" failed to load.', extension.name)),
      );
    }
  }

  /**
   * Deactivates an extension by disposing all of its registered contributions
   * and removing it from the index.
   */
  public deactivateExtension(id: string): void {
    const disposables = this.extensionDisposables.get(id);
    if (disposables) {
      disposables.forEach(dispose => dispose());
      this.extensionDisposables.delete(id);
    }
    this.extensionIndex.delete(id);
  }

  /**
   * Loads a single extension module via webpack module federation.
   * The module's top-level side effects fire contribution registrations.
   * @param extension The extension to load.
   */
  private async loadModule(extension: Extension): Promise<(() => void)[]> {
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

    // Intercept contribution registrations during module activation so we can
    // collect the Disposables and drive cleanup on deactivation.
    const collected: (() => void)[] = [];
    const originalSuperset = window.superset;
    window.superset = {
      ...originalSuperset,
      views: {
        ...originalSuperset.views,
        registerView: (
          ...args: Parameters<typeof originalSuperset.views.registerView>
        ) => {
          const disposable = originalSuperset.views.registerView(...args);
          collected.push(() => disposable.dispose());
          return disposable;
        },
      },
    };

    try {
      // Execute the module factory — side effects fire contribution registrations
      factory();
    } finally {
      window.superset = originalSuperset;
    }

    return collected;
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
