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
import { makeUrl } from 'src/utils/navigationUtils';
import 'src/extensions/Namespaces';
import { createExtensionContext } from './ExtensionContext';

type Extension = core.Extension;

/**
 * An extension as returned by the extensions API, with loader-internal
 * fields used to fetch and initialize its module. These fields are not
 * part of the public `Extension` metadata exposed to extension authors,
 * and are only present for extensions that declare a frontend bundle.
 */
export interface LoadedExtension extends Extension {
  /** URL to the extension's remote entry script. */
  remoteEntry?: string;
  /** Webpack Module Federation container name (maps to window[name]). */
  moduleFederationName?: string;
}

/**
 * Narrows an unknown `window[containerName]` lookup to a
 * `WebpackFederationContainer`, verifying it exposes the runtime methods
 * we depend on rather than trusting an assertion.
 */
function isWebpackFederationContainer(
  value: unknown,
): value is WebpackFederationContainer {
  const container = value as Partial<WebpackFederationContainer> | null;
  return (
    typeof container?.init === 'function' &&
    typeof container?.get === 'function'
  );
}

/**
 * Loads extension modules via webpack module federation.
 *
 * Extensions register their contributions (commands, views, menus, editors)
 * as module-level side effects when their module is imported. The loader
 * only handles fetching and importing the remote modules.
 */
class ExtensionsLoader {
  private static instance: ExtensionsLoader;

  private extensionIndex: Map<string, LoadedExtension> = new Map();

  private initializationPromise: Promise<void> | null = null;

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
        const extensions: LoadedExtension[] = response.json.result;
        const results = await Promise.all(
          extensions.map(ext => this.initializeExtension(ext)),
        );
        if (results.every(Boolean)) {
          logging.info('Extensions initialized successfully.');
        } else {
          const failedCount = results.filter(succeeded => !succeeded).length;
          logging.info(
            `Extensions initialized with ${failedCount} of ` +
              `${extensions.length} extension(s) failing. See errors above.`,
          );
        }
      } catch (error) {
        // Reset so a later call can retry, and rethrow so callers (e.g.
        // ExtensionsStartup) can surface the failure instead of it being
        // swallowed here and the success path running regardless.
        this.initializationPromise = null;
        logging.error('Error setting up extensions:', error);
        throw error;
      }
    })();
    return this.initializationPromise;
  }

  /**
   * Initializes a single extension.
   * If the extension has a remote entry, loads the module (which triggers
   * side-effect registrations for commands, views, menus, and editors).
   * @param extension The extension to initialize.
   * @returns Whether the extension was initialized successfully.
   */
  public async initializeExtension(
    extension: LoadedExtension,
  ): Promise<boolean> {
    try {
      if (extension.remoteEntry) {
        await this.loadModule(extension);
      }
      this.extensionIndex.set(extension.id, extension);
      return true;
    } catch (error) {
      logging.error(
        `Failed to initialize extension ${extension.name}\n`,
        error,
      );
      return false;
    }
  }

  /**
   * Loads a single extension module via webpack module federation.
   * The module's top-level side effects fire contribution registrations.
   * @param extension The extension to load.
   */
  private async loadModule(extension: LoadedExtension): Promise<void> {
    const { remoteEntry, id } = extension;
    if (!remoteEntry) {
      throw new Error(`Extension ${id} has no remote entry to load.`);
    }

    // Load the remote entry script. The backend emits a router-relative
    // remoteEntry URL; `makeUrl` applies the application root for
    // subdirectory deployments (idempotent, and absolute URLs pass through).
    await new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = makeUrl(remoteEntry);
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
    await __webpack_init_sharing__('default');
    // Use moduleFederationName for webpack container access, fallback to id for compatibility
    const containerName = extension.moduleFederationName || id;
    const container = (window as unknown as Record<string, unknown>)[
      containerName
    ];
    if (!isWebpackFederationContainer(container)) {
      throw new Error(
        `Extension container "${containerName}" was not found on window, or ` +
          'does not expose the expected Module Federation runtime ' +
          '(init/get). This may indicate the remote entry failed to ' +
          'register itself, or a webpack version mismatch.',
      );
    }

    // Build a custom scope that injects a per-extension instance of @apache-superset/core
    // with getContext pre-bound to this extension's isolated context. All other exports
    // (commands, views, menus, etc.) are references to the same shared host singletons,
    // sourced from window.superset (the real implementations wired in ExtensionsStartup),
    // not the @apache-superset/core package itself, which only contains type-only stubs.
    // Module federation caches the resolved module per container, so every import of
    // @apache-superset/core inside this extension — no matter when it evaluates —
    // receives the same pre-bound instance. Parallel loading is safe because each
    // container gets its own scope with its own resolved module instance.
    const context = createExtensionContext(extension);
    const scopedCore = {
      ...window.superset,
      extensions: {
        ...window.superset.extensions,
        getContext: () => context,
      },
    };
    // Reuse the version key webpack already resolved for the host's own
    // @apache-superset/core shared module, rather than recomputing it, so
    // this entry always matches what the runtime considers the real one.
    const sharedScope = __webpack_share_scopes__.default ?? {};
    const existingCoreVersions = sharedScope['@apache-superset/core'] ?? {};
    const supersetCoreVersion = Object.keys(existingCoreVersions)[0];
    if (!supersetCoreVersion) {
      throw new Error(
        "Could not resolve the host's @apache-superset/core version " +
          'from the webpack share scope. Ensure __webpack_init_sharing__ ' +
          'has registered the host module before loading extensions.',
      );
    }
    const customScope = {
      ...sharedScope,
      '@apache-superset/core': {
        [supersetCoreVersion]: {
          get: () => Promise.resolve(() => scopedCore),
          loaded: true,
          eager: true,
        },
      },
    };
    await container.init(customScope);

    const factory = await container.get('./index');
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
