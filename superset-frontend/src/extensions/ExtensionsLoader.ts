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
type ExtensionContext = core.ExtensionContext;
type ExtensionModule = core.ExtensionModule;

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

  /** Disposables registered by each extension via its context, keyed by extension id. */
  private extensionDisposables: Map<string, { dispose(): void }[]> = new Map();

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
   * If the extension has a remote entry, loads the module and runs its
   * `activate(context)` hook (or, for legacy extensions, its top-level
   * side-effect registrations for commands, views, menus, and editors).
   * @param extension The extension to initialize.
   */
  public async initializeExtension(extension: Extension) {
    try {
      if (extension.remoteEntry) {
        const subscriptions = await this.loadModule(extension);
        this.extensionDisposables.set(extension.id, subscriptions);
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
   *
   * Contributions are disposed from the extension's `context.subscriptions`,
   * which it populates during `activate(context)`. This tracks registrations
   * regardless of when they happen — synchronous or asynchronous — so long as
   * the extension pushes each returned Disposable onto its context. Legacy
   * extensions that register as top-level side effects are tracked only for the
   * synchronous module-evaluation window (see `loadModule`).
   */
  public deactivateExtension(id: string): void {
    const subscriptions = this.extensionDisposables.get(id);
    if (subscriptions) {
      subscriptions.forEach(subscription => subscription.dispose());
      this.extensionDisposables.delete(id);
    }
    this.extensionIndex.delete(id);
  }

  /**
   * Loads a single extension module via webpack module federation and runs its
   * `activate(context)` hook. Returns the Disposables the extension registered
   * (its `context.subscriptions`) so the loader can dispose them on deactivation.
   * @param extension The extension to load.
   */
  private async loadModule(
    extension: Extension,
  ): Promise<{ dispose(): void }[]> {
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

    // The extension binds the lifetime of its registrations to this context by
    // pushing the returned Disposables onto `subscriptions`. Because the context
    // object outlives the synchronous module-evaluation window, registrations
    // performed asynchronously inside `activate` (after an `await`, in a timer,
    // or in an event callback) are tracked just like synchronous ones.
    const context: ExtensionContext = { subscriptions: [] };

    // Backward-compatibility path: extensions that register contributions as
    // top-level side effects (rather than via `activate(context)`) do not push
    // to `context.subscriptions` themselves. Wrapping the registrars captures
    // those disposables — but ONLY while they fire synchronously during module
    // evaluation, since the wrap is removed immediately afterwards. Extensions
    // that register asynchronously must use `activate(context)` to be tracked.
    const originalSuperset = window.superset;

    const wrap =
      <TArgs extends unknown[]>(
        fn: (...args: TArgs) => { dispose(): void },
      ): ((...args: TArgs) => { dispose(): void }) =>
      (...args: TArgs) => {
        const disposable = fn(...args);
        context.subscriptions.push(disposable);
        return disposable;
      };

    window.superset = {
      ...originalSuperset,
      commands: {
        ...originalSuperset.commands,
        registerCommand: wrap(originalSuperset.commands.registerCommand),
      },
      menus: {
        ...originalSuperset.menus,
        registerMenuItem: wrap(originalSuperset.menus.registerMenuItem),
      },
      editors: {
        ...originalSuperset.editors,
        registerEditor: wrap(originalSuperset.editors.registerEditor),
      },
      views: {
        ...originalSuperset.views,
        registerView: wrap(originalSuperset.views.registerView),
      },
    };

    let module: ExtensionModule | undefined;
    try {
      // Evaluate the module factory. Legacy extensions fire their contribution
      // registrations as a synchronous side effect here; modern extensions
      // return a module exposing `activate`.
      module = factory() as ExtensionModule | undefined;
    } finally {
      // Restore the real registrars before `activate` runs so that registrations
      // are tracked via `context.subscriptions` (which the extension controls and
      // which survives async boundaries) rather than via the synchronous wrap.
      window.superset = originalSuperset;
    }

    // Preferred path: hand the extension its context so it can track every
    // registration it makes, synchronous or asynchronous.
    if (typeof module?.activate === 'function') {
      await module.activate(context);
    }

    return context.subscriptions;
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
