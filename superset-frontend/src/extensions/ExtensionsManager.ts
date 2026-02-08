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
import type { contributions, core, sandbox } from '@apache-superset/core';
import { ExtensionContext } from '../core/models';
import { commands } from '../core/commands';
import { WASMSandbox, SandboxConfig } from './sandbox';
import { SandboxManager } from './sandbox/SandboxManager';

/**
 * Tracked sandboxed extension instance.
 */
interface SandboxedExtensionInstance {
  /** Extension ID */
  extensionId: string;
  /** Extension name */
  extensionName: string;
  /** Trust level of the sandbox */
  trustLevel: sandbox.SandboxTrustLevel;
  /** WASM sandbox instance (for 'wasm' trust level) */
  wasmSandbox?: WASMSandbox;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** URL to fetch worker code from (for 'worker' trust level) */
  workerCodeUrl?: string;
  /** Whether the worker is currently being initialized */
  workerInitializing?: boolean;
  /** Promise that resolves when worker is ready (for deduplication) */
  workerInitPromise?: Promise<void>;
}

/**
 * Configuration for trusted extension sources.
 */
interface TrustConfiguration {
  /** List of trusted extension IDs that can run as 'core' */
  trustedExtensions: string[];
  /** Whether to allow unsigned extensions to run as 'core' */
  allowUnsignedCore: boolean;
  /** Default trust level for extensions without explicit configuration */
  defaultTrustLevel: sandbox.SandboxTrustLevel;
}

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

  /** Sandboxed extension instances */
  private sandboxedExtensions: Map<string, SandboxedExtensionInstance> =
    new Map();

  /** Trust configuration for extension loading */
  private trustConfig: TrustConfiguration = {
    trustedExtensions: [],
    allowUnsignedCore: false,
    defaultTrustLevel: 'iframe',
  };

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
    const extensions: core.Extension[] = response.json.result;
    await Promise.all(
      extensions.map(async extension => {
        await this.initializeExtension(extension);
      }),
    );
  }

  /**
   * Initializes an extension by its instance.
   * The extension is loaded based on its trust level:
   * - 'core': Loaded via Module Federation in main context (requires trust)
   * - 'iframe': Loaded in sandboxed iframe with postMessage API
   * - 'worker': Loaded in Web Worker with postMessage API (command-only)
   * - 'wasm': Loaded in WASM sandbox for logic-only extensions
   *
   * @param extension The extension to initialize.
   */
  public async initializeExtension(extension: core.Extension) {
    try {
      // Use backend-validated trust level if available, otherwise fall back to frontend determination
      const trustLevel =
        extension.trustLevel ?? this.determineTrustLevel(extension);

      // Build informative log message
      let logMessage = `Initializing extension ${extension.name} with trust level: ${trustLevel}`;
      if (
        extension.signatureValid !== undefined &&
        extension.signatureValid !== null
      ) {
        logMessage += ` (signature: ${extension.signatureValid ? 'valid' : 'invalid'})`;
      }
      if (extension.trustDowngraded) {
        logMessage += ` [downgraded: ${extension.trustDowngradeReason}]`;
      }
      logging.info(logMessage);

      switch (trustLevel) {
        case 'core':
          await this.initializeCoreExtension(extension);
          break;
        case 'iframe':
          await this.initializeIframeSandboxedExtension(extension);
          break;
        case 'worker':
          await this.initializeWorkerSandboxedExtension(extension);
          break;
        case 'wasm':
          await this.initializeWASMSandboxedExtension(extension);
          break;
        default:
          logging.error(
            `Unknown trust level '${trustLevel}' for extension ${extension.name}`,
          );
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
   * Initialize a trusted extension using Module Federation (Tier 1).
   */
  private async initializeCoreExtension(
    extension: core.Extension,
  ): Promise<void> {
    if (!extension.remoteEntry) {
      logging.warn(
        `Core extension ${extension.name} has no remote entry, skipping`,
      );
      return;
    }

    const loadedExtension = await this.loadModule(extension);
    this.enableExtension(loadedExtension);
  }

  /**
   * Initialize an iframe-sandboxed extension (Tier 2).
   *
   * @remarks
   * For iframe sandboxed extensions, we don't load the module directly.
   * Instead, we store the configuration and let the IframeSandbox component
   * handle the loading when the extension's view is rendered.
   */
  private async initializeIframeSandboxedExtension(
    extension: core.Extension,
  ): Promise<void> {
    const config: SandboxConfig = {
      trustLevel: 'iframe',
      permissions: extension.sandbox?.permissions ?? [],
      csp: extension.sandbox?.csp,
    };

    this.sandboxedExtensions.set(extension.id, {
      extensionId: extension.id,
      extensionName: extension.name,
      trustLevel: 'iframe',
      config,
    });

    // Index contributions from the extension manifest
    // (iframe extensions declare contributions in extension.json)
    if (extension.contributions) {
      this.indexContributions(extension);
    }

    logging.info(`Iframe sandbox registered for extension ${extension.name}`);
  }

  /**
   * Initialize a worker-sandboxed extension for command-only extensions.
   *
   * @remarks
   * Worker sandboxed extensions run in a Web Worker with no DOM access.
   * They are ideal for extensions that only register commands and don't
   * need to render any UI. The worker is created lazily on first command
   * to avoid loading unused extensions.
   */
  private async initializeWorkerSandboxedExtension(
    extension: core.Extension,
  ): Promise<void> {
    const config: SandboxConfig = {
      trustLevel: 'worker',
      permissions: extension.sandbox?.permissions ?? [],
    };

    // Determine the URL to fetch worker code from
    // Priority: workerEntry (if added to manifest) > derived from remoteEntry
    const workerCodeUrl = this.getWorkerCodeUrl(extension);

    this.sandboxedExtensions.set(extension.id, {
      extensionId: extension.id,
      extensionName: extension.name,
      trustLevel: 'worker',
      config,
      workerCodeUrl,
    });

    // Index contributions from the extension manifest
    if (extension.contributions) {
      this.indexContributions(extension);
    }

    logging.info(
      `Worker sandbox registered for extension ${extension.name} (lazy loading enabled)`,
    );
  }

  /**
   * Get the URL to fetch worker code from for a worker extension.
   *
   * @remarks
   * Worker extensions need their code as a plain JS string (not Module Federation).
   * Priority: workerEntry from manifest > derived from remoteEntry > API endpoint
   */
  private getWorkerCodeUrl(extension: core.Extension): string {
    // If the extension explicitly specifies a workerEntry, use it
    if (extension.workerEntry) {
      // If it's a relative path, prepend the extension's base URL
      if (!extension.workerEntry.startsWith('http') && extension.remoteEntry) {
        const baseUrl = extension.remoteEntry.replace(/\/[^/]+$/, '');
        return `${baseUrl}/${extension.workerEntry}`;
      }
      return extension.workerEntry;
    }

    // If the extension has a remoteEntry, derive worker URL from it
    // Convention: worker.js is in the same directory as remoteEntry
    if (extension.remoteEntry) {
      const baseUrl = extension.remoteEntry.replace(/\/[^/]+$/, '');
      return `${baseUrl}/worker.js`;
    }

    // Fallback: use extension API endpoint
    return `/api/v1/extensions/${extension.id}/worker.js`;
  }

  /**
   * Initialize a WASM-sandboxed extension (Tier 3).
   *
   * @remarks
   * WASM sandboxed extensions are for logic-only code (formatters, validators).
   * They are initialized lazily when first used.
   */
  private async initializeWASMSandboxedExtension(
    extension: core.Extension,
  ): Promise<void> {
    const config: SandboxConfig = {
      trustLevel: 'wasm',
      permissions: extension.sandbox?.permissions ?? [],
      resourceLimits: extension.sandbox?.resourceLimits,
    };

    this.sandboxedExtensions.set(extension.id, {
      extensionId: extension.id,
      extensionName: extension.name,
      trustLevel: 'wasm',
      config,
    });

    // Index contributions from the extension manifest
    if (extension.contributions) {
      this.indexContributions(extension);
    }

    logging.info(`WASM sandbox registered for extension ${extension.name}`);
  }

  /**
   * Determine the trust level for an extension.
   *
   * @remarks
   * Trust level is determined by:
   * 1. Explicit sandbox.trustLevel in extension manifest
   * 2. Whether the extension is in the trusted list (for 'core')
   * 3. Default trust level from configuration
   */
  private determineTrustLevel(
    extension: core.Extension,
  ): sandbox.SandboxTrustLevel {
    // Check explicit manifest configuration
    const manifestTrustLevel = extension.sandbox?.trustLevel;

    if (manifestTrustLevel === 'core') {
      // Verify the extension is allowed to run as core
      if (
        this.trustConfig.trustedExtensions.includes(extension.id) ||
        this.trustConfig.allowUnsignedCore
      ) {
        return 'core';
      }
      logging.warn(
        `Extension ${extension.name} requested 'core' trust level but is not trusted. ` +
          `Falling back to '${this.trustConfig.defaultTrustLevel}'.`,
      );
      return this.trustConfig.defaultTrustLevel;
    }

    if (manifestTrustLevel) {
      return manifestTrustLevel;
    }

    // Legacy extensions without sandbox config default to core for backward compatibility
    // This can be changed to 'iframe' once extensions are migrated
    if (!extension.sandbox) {
      logging.info(
        `Extension ${extension.name} has no sandbox config, using legacy 'core' mode`,
      );
      return 'core';
    }

    return this.trustConfig.defaultTrustLevel;
  }

  /**
   * Configure trust settings for extension loading.
   *
   * @param config Trust configuration options
   */
  public configureTrust(config: Partial<TrustConfiguration>): void {
    this.trustConfig = {
      ...this.trustConfig,
      ...config,
    };
    logging.info('Trust configuration updated:', this.trustConfig);
  }

  /**
   * Get the sandboxed extension instance for an extension ID.
   *
   * @param extensionId The extension ID
   * @returns The sandboxed extension instance, or undefined if not sandboxed
   */
  public getSandboxedExtension(
    extensionId: string,
  ): SandboxedExtensionInstance | undefined {
    return this.sandboxedExtensions.get(extensionId);
  }

  /**
   * Check if an extension is sandboxed.
   *
   * @param extensionId The extension ID
   * @returns True if the extension is running in a sandbox
   */
  public isExtensionSandboxed(extensionId: string): boolean {
    return this.sandboxedExtensions.has(extensionId);
  }

  /**
   * Get the sandbox configuration for a sandboxed view contribution.
   *
   * @param viewId The view contribution ID
   * @returns Sandbox config for rendering the view, or null if not sandboxed
   */
  public getSandboxConfigForView(viewId: string): {
    extensionId: string;
    config: SandboxConfig;
  } | null {
    // Find which extension owns this view
    for (const [extensionId, instance] of this.sandboxedExtensions) {
      const extension = this.extensionIndex.get(extensionId);
      if (extension?.contributions?.views) {
        for (const views of Object.values(extension.contributions.views)) {
          if (views.some(v => v.id === viewId)) {
            return {
              extensionId,
              config: instance.config,
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Enables an extension by its instance.
   * @param extension The extension to enable.
   */
  private enableExtension(extension: core.Extension): void {
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
  private async loadModule(extension: core.Extension): Promise<core.Extension> {
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
    // @ts-ignore
    await __webpack_init_sharing__('default');
    const container = (window as any)[id];

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
   * For sandboxed extensions, also registers proxy commands.
   * @param extension The extension to index.
   */
  private indexContributions(extension: core.Extension): void {
    const { contributions: extensionContributions, id } = extension;
    this.extensionContributions.set(id, {
      menus: extensionContributions.menus,
      views: extensionContributions.views,
      commands: extensionContributions.commands,
    });

    // For sandboxed extensions, register proxy commands
    if (this.sandboxedExtensions.has(id) && extensionContributions.commands) {
      this.registerSandboxedCommands(id, extensionContributions.commands);
    }
  }

  /**
   * Register proxy commands for a sandboxed extension.
   * These commands forward execution to the sandbox via SandboxManager.
   * For worker sandboxes, the worker is created lazily on first command.
   */
  private registerSandboxedCommands(
    extensionId: string,
    commandContributions: contributions.CommandContribution[],
  ): void {
    const sandboxManager = SandboxManager.getInstance();
    const instance = this.sandboxedExtensions.get(extensionId);

    for (const cmd of commandContributions) {
      logging.info(
        `Registering sandboxed proxy command: ${cmd.command} for extension ${extensionId}`,
      );

      if (instance?.trustLevel === 'worker') {
        // Worker sandbox: lazy initialization on first command
        commands.registerCommand(cmd.command, async (...args: unknown[]) => {
          logging.info(`Executing worker sandboxed command: ${cmd.command}`);
          await this.ensureWorkerSandboxReady(extensionId);
          sandboxManager.dispatchCommandToExtension(
            extensionId,
            cmd.command,
            args,
          );
        });
      } else {
        // Iframe/WASM sandbox: direct dispatch
        commands.registerCommand(cmd.command, (...args: unknown[]) => {
          logging.info(`Executing sandboxed command: ${cmd.command}`);
          sandboxManager.dispatchCommandToExtension(
            extensionId,
            cmd.command,
            args,
          );
        });
      }
    }
  }

  /**
   * Ensure the worker sandbox is ready for an extension.
   * Creates the worker lazily on first use.
   */
  private async ensureWorkerSandboxReady(extensionId: string): Promise<void> {
    const sandboxManager = SandboxManager.getInstance();
    const instance = this.sandboxedExtensions.get(extensionId);

    if (!instance || instance.trustLevel !== 'worker') {
      return;
    }

    // Check if worker already exists
    if (sandboxManager.hasReadySandbox(extensionId)) {
      return;
    }

    // Check if already initializing (deduplicate concurrent calls)
    if (instance.workerInitPromise) {
      await instance.workerInitPromise;
      return;
    }

    // Start initialization
    instance.workerInitializing = true;
    instance.workerInitPromise = this.createWorkerSandbox(
      extensionId,
      instance,
    );

    try {
      await instance.workerInitPromise;
    } finally {
      instance.workerInitializing = false;
      instance.workerInitPromise = undefined;
    }
  }

  /**
   * Create the worker sandbox for an extension.
   * Fetches the code and initializes the worker.
   */
  private async createWorkerSandbox(
    extensionId: string,
    instance: SandboxedExtensionInstance,
  ): Promise<void> {
    const sandboxManager = SandboxManager.getInstance();

    if (!instance.workerCodeUrl) {
      logging.error(`No worker code URL for extension ${extensionId}`);
      return;
    }

    logging.info(
      `Fetching worker code for extension ${extensionId} from ${instance.workerCodeUrl}`,
    );

    try {
      // Fetch the worker code
      const response = await fetch(instance.workerCodeUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch worker code: ${response.status} ${response.statusText}`,
        );
      }

      const code = await response.text();

      // Create the worker sandbox
      await sandboxManager.createWorkerSandbox(
        extensionId,
        instance.extensionName,
        code,
        instance.config,
      );

      logging.info(`Worker sandbox created for extension ${extensionId}`);
    } catch (error) {
      logging.error(
        `Failed to create worker sandbox for ${extensionId}:`,
        error,
      );
      throw error;
    }
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
   * Retrieves a specific extension by its id.
   * @param id The id of the extension.
   * @returns The extension matching the id, or undefined if not found.
   */
  public getExtension(id: string): core.Extension | undefined {
    return this.extensionIndex.get(id);
  }

  /**
   * Dispose of all sandboxed extensions and clean up resources.
   */
  public disposeAll(): void {
    for (const [id, instance] of this.sandboxedExtensions) {
      try {
        if (instance.wasmSandbox) {
          instance.wasmSandbox.dispose();
        }
        this.deactivateExtension(id);
      } catch (error) {
        logging.warn(`Error disposing extension ${id}:`, error);
      }
    }
    this.sandboxedExtensions.clear();
    this.extensionIndex.clear();
    this.contextIndex.clear();
    this.extensionContributions.clear();
  }
}

export default ExtensionsManager;
export type { TrustConfiguration };
