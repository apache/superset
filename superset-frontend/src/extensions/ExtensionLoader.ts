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
import { setExtensionContext } from '@apache-superset/core';
import type { ExtensionContext } from '@apache-superset/core';

// Manifest schema from auto-discovery
interface ManifestFrontend {
  remoteEntry: string;
  contributions: FrontendContributions;
}

interface FrontendContributions {
  commands: CommandContribution[];
  views: Record<string, ViewContribution[]>;
  editors: EditorContribution[];
  menus: Record<string, MenuContribution[]>;
}

interface CommandContribution {
  id: string;
  title: string;
  icon?: string;
  execute: string; // Module path
}

interface ViewContribution {
  id: string;
  title: string;
  component: string; // Module path
  location: string;
}

interface EditorContribution {
  id: string;
  name: string;
  component: string; // Module path
  mimeTypes: string[];
}

interface MenuContribution {
  id: string;
  title: string;
  location: string;
  action: string; // Module path
}

interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  frontend?: ManifestFrontend;
}

interface LoadedExtension {
  id: string;
  name: string;
  manifest: ExtensionManifest;
  module?: any; // The loaded webpack module
  disposables: Array<() => void>;
}

/**
 * ExtensionLoader - Loads and validates extensions using the auto-discovery system
 */
class ExtensionLoader {
  private static instance: ExtensionLoader;
  private loadedExtensions: Map<string, LoadedExtension> = new Map();
  private contributionRegistry: Map<string, any> = new Map(); // Track registered contributions

  private constructor() {}

  public static getInstance(): ExtensionLoader {
    if (!ExtensionLoader.instance) {
      ExtensionLoader.instance = new ExtensionLoader();
    }
    return ExtensionLoader.instance;
  }

  /**
   * Initialize and load all available extensions
   */
  public async initializeExtensions(): Promise<void> {
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/extensions/',
      });

      const extensions: ExtensionManifest[] = response.json.result;

      await Promise.all(
        extensions.map(async manifest => {
          try {
            await this.loadExtension(manifest);
          } catch (error) {
            logging.error(`Failed to load extension ${manifest.id}:`, error);
          }
        }),
      );

      logging.info(
        `Loaded ${this.loadedExtensions.size} extensions successfully`,
      );
    } catch (error) {
      logging.error('Failed to initialize extensions:', error);
    }
  }

  /**
   * Load a single extension using webpack module federation
   */
  public async loadExtension(manifest: ExtensionManifest): Promise<void> {
    const { id, name, frontend } = manifest;

    if (!frontend?.remoteEntry) {
      logging.warn(`Extension ${id} has no frontend component, skipping`);
      return;
    }

    try {
      logging.info(`Loading extension: ${name} (${id})`);

      // Construct full URL for remote entry
      const remoteEntryUrl = frontend.remoteEntry.startsWith('http')
        ? frontend.remoteEntry
        : `/static/extensions/${id}/${frontend.remoteEntry}`;

      // Load the remote entry script
      await this.loadRemoteEntry(remoteEntryUrl, id);

      // Get the webpack module federation container
      const container = (window as any)[id];
      if (!container) {
        throw new Error(
          `Extension container ${id} not found after loading remote entry`,
        );
      }

      // Initialize webpack sharing
      // @ts-ignore
      await __webpack_init_sharing__('default');
      // @ts-ignore
      await container.init(__webpack_share_scopes__.default);

      // Load the main module (typically exposed as './index')
      const factory = await container.get('./index');
      const extensionModule = factory();

      // Create extension context for auto-registration
      const context = this.createExtensionContext(id);

      // Set context in the extension's environment so define* functions auto-register
      setExtensionContext(context);

      // Create loaded extension record
      const loadedExtension: LoadedExtension = {
        id,
        name,
        manifest,
        module: extensionModule,
        disposables: [],
      };

      // Validate contributions against manifest (security check)
      await this.validateContributions(loadedExtension, frontend.contributions);

      this.loadedExtensions.set(id, loadedExtension);

      logging.info(`✅ Extension ${name} loaded and validated successfully`);
    } catch (error) {
      logging.error(`Failed to load extension ${name}:`, error);
      throw error;
    }
  }

  /**
   * Load remote entry script for webpack module federation
   */
  private async loadRemoteEntry(
    remoteEntry: string,
    extensionId: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${remoteEntry}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = remoteEntry;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        logging.debug(`Remote entry loaded: ${remoteEntry}`);
        resolve();
      };

      script.onerror = error => {
        const message = `Failed to load remote entry: ${remoteEntry}`;
        logging.error(message, error);
        reject(new Error(message));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Create extension context with registration callbacks
   */
  private createExtensionContext(extensionId: string): ExtensionContext {
    return {
      registerCommand: config => {
        const key = `${extensionId}.${config.id}`;
        this.contributionRegistry.set(`command:${key}`, config);
        logging.debug(`Registered command: ${key}`);

        return () => {
          this.contributionRegistry.delete(`command:${key}`);
          logging.debug(`Unregistered command: ${key}`);
        };
      },

      registerViewProvider: (id, component) => {
        const key = `${extensionId}.${id}`;
        this.contributionRegistry.set(`view:${key}`, { id, component });
        logging.debug(`Registered view provider: ${key}`);

        return () => {
          this.contributionRegistry.delete(`view:${key}`);
          logging.debug(`Unregistered view provider: ${key}`);
        };
      },

      registerEditor: config => {
        const key = `${extensionId}.${config.id}`;
        this.contributionRegistry.set(`editor:${key}`, config);
        logging.debug(`Registered editor: ${key}`);

        return () => {
          this.contributionRegistry.delete(`editor:${key}`);
          logging.debug(`Unregistered editor: ${key}`);
        };
      },

      registerMenu: config => {
        const key = `${extensionId}.${config.id}`;
        this.contributionRegistry.set(`menu:${key}`, config);
        logging.debug(`Registered menu: ${key}`);

        return () => {
          this.contributionRegistry.delete(`menu:${key}`);
          logging.debug(`Unregistered menu: ${key}`);
        };
      },
    };
  }

  /**
   * Validate that runtime contributions match the manifest allowlist
   */
  private async validateContributions(
    extension: LoadedExtension,
    manifestContributions: FrontendContributions,
  ): Promise<void> {
    const { id } = extension;

    // Small delay to allow define* functions to execute and register
    await new Promise(resolve => setTimeout(resolve, 100));

    // Validate commands
    for (const commandDef of manifestContributions.commands) {
      const key = `command:${id}.${commandDef.id}`;
      if (!this.contributionRegistry.has(key)) {
        throw new Error(
          `Command ${commandDef.id} declared in manifest but not found in runtime exports`,
        );
      }
    }

    // Validate views
    for (const [, views] of Object.entries(manifestContributions.views)) {
      for (const viewDef of views) {
        const key = `view:${id}.${viewDef.id}`;
        if (!this.contributionRegistry.has(key)) {
          throw new Error(
            `View ${viewDef.id} declared in manifest but not found in runtime exports`,
          );
        }
      }
    }

    // Validate editors
    for (const editorDef of manifestContributions.editors) {
      const key = `editor:${id}.${editorDef.id}`;
      if (!this.contributionRegistry.has(key)) {
        throw new Error(
          `Editor ${editorDef.id} declared in manifest but not found in runtime exports`,
        );
      }
    }

    // Validate menus
    for (const [, menus] of Object.entries(manifestContributions.menus)) {
      for (const menuDef of menus) {
        const key = `menu:${id}.${menuDef.id}`;
        if (!this.contributionRegistry.has(key)) {
          throw new Error(
            `Menu ${menuDef.id} declared in manifest but not found in runtime exports`,
          );
        }
      }
    }

    logging.debug(`✅ All contributions validated for extension ${id}`);
  }

  /**
   * Get view contributions for a specific location
   */
  public getViewContributions(
    location: string,
  ): Array<{ id: string; name: string; component: React.ComponentType }> {
    const views: Array<{
      id: string;
      name: string;
      component: React.ComponentType;
    }> = [];

    for (const [key, contribution] of this.contributionRegistry.entries()) {
      if (key.startsWith('view:')) {
        const extension = Array.from(this.loadedExtensions.values()).find(ext =>
          key.startsWith(`view:${ext.id}.`),
        );

        if (extension) {
          const viewContributions =
            extension.manifest.frontend?.contributions.views[location] || [];
          const contributionId = key.replace(/^view:[^.]+\./, '');
          const viewDef = viewContributions.find(v => v.id === contributionId);

          if (viewDef) {
            views.push({
              id: contribution.id,
              name: viewDef.title,
              component: contribution.component,
            });
          }
        }
      }
    }

    return views;
  }

  /**
   * Get command contributions
   */
  public getCommandContributions(): Array<any> {
    const commands: Array<any> = [];

    for (const [key, contribution] of this.contributionRegistry.entries()) {
      if (key.startsWith('command:')) {
        commands.push(contribution);
      }
    }

    return commands;
  }

  /**
   * Get editor contributions
   */
  public getEditorContributions(): Array<any> {
    const editors: Array<any> = [];

    for (const [key, contribution] of this.contributionRegistry.entries()) {
      if (key.startsWith('editor:')) {
        editors.push(contribution);
      }
    }

    return editors;
  }

  /**
   * Get menu contributions for a specific location
   */
  public getMenuContributions(location: string): Array<any> {
    const menus: Array<any> = [];

    for (const [key, contribution] of this.contributionRegistry.entries()) {
      if (key.startsWith('menu:')) {
        const extension = Array.from(this.loadedExtensions.values()).find(ext =>
          key.startsWith(`menu:${ext.id}.`),
        );

        if (extension) {
          const menuContributions =
            extension.manifest.frontend?.contributions.menus[location] || [];
          const contributionId = key.replace(/^menu:[^.]+\./, '');

          if (menuContributions.some(m => m.id === contributionId)) {
            menus.push(contribution);
          }
        }
      }
    }

    return menus;
  }

  /**
   * Get loaded extensions
   */
  public getLoadedExtensions(): LoadedExtension[] {
    return Array.from(this.loadedExtensions.values());
  }

  /**
   * Unload an extension
   */
  public unloadExtension(id: string): boolean {
    const extension = this.loadedExtensions.get(id);
    if (!extension) {
      return false;
    }

    try {
      // Dispose all registered contributions
      extension.disposables.forEach(dispose => dispose());

      // Clear from registry
      for (const key of this.contributionRegistry.keys()) {
        if (key.includes(`${id}.`)) {
          this.contributionRegistry.delete(key);
        }
      }

      this.loadedExtensions.delete(id);
      logging.info(`Extension ${extension.name} unloaded successfully`);
      return true;
    } catch (error) {
      logging.error(`Failed to unload extension ${extension.name}:`, error);
      return false;
    }
  }
}

export default ExtensionLoader;
