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

/**
 * @fileoverview SandboxManager for managing sandboxed extension instances.
 *
 * This module provides centralized management of sandbox instances, including:
 * - Lifecycle management (creation, disposal)
 * - Command dispatch to sandboxed extensions
 * - Bridge instance management
 */

import { logging } from '@apache-superset/core';
import { nanoid } from 'nanoid';
import { SandboxBridge } from './SandboxBridge';
import { SandboxedExtensionHostImpl } from './SandboxedExtensionHost';
import { WorkerSandbox } from './WorkerSandbox';
import { SandboxConfig } from './types';

/**
 * Type of sandbox instance.
 */
type SandboxType = 'iframe' | 'worker';

/**
 * Tracked sandbox instance with its bridge and metadata.
 */
interface SandboxInstance {
  /** Unique ID for this sandbox instance */
  sandboxId: string;
  /** Extension ID this sandbox belongs to */
  extensionId: string;
  /** Type of sandbox (iframe or worker) */
  type: SandboxType;
  /** The SandboxBridge for host-side communication (iframe only) */
  bridge: SandboxBridge | null;
  /** The WorkerSandbox instance (worker only) */
  workerSandbox: WorkerSandbox | null;
  /** The host API implementation */
  hostImpl: SandboxedExtensionHostImpl;
  /** The iframe element (if rendered) */
  iframe: HTMLIFrameElement | null;
  /** Whether the sandbox is ready */
  isReady: boolean;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** Pending command queue (for commands sent before ready) */
  pendingCommands: Array<{ command: string; args: unknown[] }>;
}

/**
 * Callback for when a sandbox becomes ready.
 */
type SandboxReadyCallback = (sandboxId: string, extensionId: string) => void;

/**
 * SandboxManager singleton for managing all sandbox instances.
 *
 * @remarks
 * This manager handles:
 * - Creating and tracking sandbox instances
 * - Dispatching commands to the correct sandbox
 * - Managing sandbox lifecycle (ready state, cleanup)
 */
class SandboxManager {
  private static instance: SandboxManager;

  /** All sandbox instances by sandbox ID */
  private sandboxes: Map<string, SandboxInstance> = new Map();

  /** Map from extension ID to sandbox IDs (an extension can have multiple sandboxes) */
  private extensionToSandboxes: Map<string, Set<string>> = new Map();

  /** Callbacks for sandbox ready events */
  private readyCallbacks: Set<SandboxReadyCallback> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance.
   */
  public static getInstance(): SandboxManager {
    if (!SandboxManager.instance) {
      SandboxManager.instance = new SandboxManager();
    }
    return SandboxManager.instance;
  }

  /**
   * Create a new iframe sandbox instance for an extension.
   *
   * @param extensionId - The extension ID
   * @param config - Sandbox configuration
   * @returns The sandbox ID for the new instance
   */
  public createSandbox(extensionId: string, config: SandboxConfig): string {
    const sandboxId = `sandbox-${extensionId}-${nanoid(8)}`;

    const bridge = new SandboxBridge({
      bridgeId: sandboxId,
      extensionId,
      permissions: config.permissions ?? [],
    });

    const hostImpl = new SandboxedExtensionHostImpl(
      extensionId,
      config.permissions ?? [],
    );

    // Set up the API handler
    bridge.onApiCall(async (method: string, args: unknown[]) =>
      hostImpl.handleApiCall(method, args),
    );

    const instance: SandboxInstance = {
      sandboxId,
      extensionId,
      type: 'iframe',
      bridge,
      workerSandbox: null,
      hostImpl,
      iframe: null,
      isReady: false,
      config,
      pendingCommands: [],
    };

    this.sandboxes.set(sandboxId, instance);

    // Track extension -> sandbox mapping
    if (!this.extensionToSandboxes.has(extensionId)) {
      this.extensionToSandboxes.set(extensionId, new Set());
    }
    this.extensionToSandboxes.get(extensionId)!.add(sandboxId);

    logging.info(`SandboxManager: Created iframe sandbox ${sandboxId} for ${extensionId}`);

    return sandboxId;
  }

  /**
   * Create a new worker sandbox instance for a command-only extension.
   *
   * @param extensionId - The extension ID
   * @param extensionName - The extension name
   * @param code - The extension's JavaScript code
   * @param config - Sandbox configuration
   * @returns The sandbox ID for the new instance
   */
  public async createWorkerSandbox(
    extensionId: string,
    extensionName: string,
    code: string,
    config: SandboxConfig,
  ): Promise<string> {
    const sandboxId = `worker-${extensionId}-${nanoid(8)}`;

    const hostImpl = new SandboxedExtensionHostImpl(
      extensionId,
      config.permissions ?? [],
    );

    const workerSandbox = new WorkerSandbox({
      sandboxId,
      extensionId,
      extensionName,
      code,
      config,
    });

    const instance: SandboxInstance = {
      sandboxId,
      extensionId,
      type: 'worker',
      bridge: null,
      workerSandbox,
      hostImpl,
      iframe: null,
      isReady: false,
      config,
      pendingCommands: [],
    };

    this.sandboxes.set(sandboxId, instance);

    // Track extension -> sandbox mapping
    if (!this.extensionToSandboxes.has(extensionId)) {
      this.extensionToSandboxes.set(extensionId, new Set());
    }
    this.extensionToSandboxes.get(extensionId)!.add(sandboxId);

    // Set up ready callback
    workerSandbox.onReady(() => {
      this.handleSandboxReady(sandboxId);
    });

    // Initialize the worker
    await workerSandbox.initialize();

    logging.info(`SandboxManager: Created worker sandbox ${sandboxId} for ${extensionId}`);

    return sandboxId;
  }

  /**
   * Connect an iframe sandbox to its iframe element.
   *
   * @param sandboxId - The sandbox ID
   * @param iframe - The iframe element
   */
  public connectSandbox(sandboxId: string, iframe: HTMLIFrameElement): void {
    const instance = this.sandboxes.get(sandboxId);
    if (!instance) {
      logging.error(`SandboxManager: Sandbox ${sandboxId} not found`);
      return;
    }

    if (instance.type !== 'iframe' || !instance.bridge) {
      logging.error(`SandboxManager: Sandbox ${sandboxId} is not an iframe sandbox`);
      return;
    }

    if (!iframe.contentWindow) {
      logging.error(`SandboxManager: Iframe has no contentWindow`);
      return;
    }

    instance.iframe = iframe;
    instance.bridge.connect(iframe.contentWindow, () => {
      this.handleSandboxReady(sandboxId);
    });

    logging.info(`SandboxManager: Connected iframe sandbox ${sandboxId}`);
  }

  /**
   * Handle sandbox ready event.
   */
  private handleSandboxReady(sandboxId: string): void {
    const instance = this.sandboxes.get(sandboxId);
    if (!instance) {
      return;
    }

    instance.isReady = true;

    // Process pending commands
    for (const { command, args } of instance.pendingCommands) {
      this.dispatchCommandToSandbox(sandboxId, command, args);
    }
    instance.pendingCommands = [];

    // Notify callbacks
    for (const callback of this.readyCallbacks) {
      try {
        callback(sandboxId, instance.extensionId);
      } catch (error) {
        logging.error('Error in sandbox ready callback:', error);
      }
    }

    logging.info(`SandboxManager: Sandbox ${sandboxId} is ready`);
  }

  /**
   * Dispatch a command to a specific sandbox.
   *
   * @param sandboxId - The sandbox ID
   * @param command - The command name
   * @param args - Command arguments
   */
  public dispatchCommandToSandbox(
    sandboxId: string,
    command: string,
    args: unknown[] = [],
  ): void {
    const instance = this.sandboxes.get(sandboxId);
    if (!instance) {
      logging.error(`SandboxManager: Sandbox ${sandboxId} not found`);
      return;
    }

    if (!instance.isReady) {
      // Queue the command for when the sandbox is ready
      instance.pendingCommands.push({ command, args });
      logging.info(`SandboxManager: Queued command ${command} for ${sandboxId}`);
      return;
    }

    // Send command to the sandbox based on type
    if (instance.type === 'worker' && instance.workerSandbox) {
      instance.workerSandbox.dispatchCommand(command, args);
    } else if (instance.type === 'iframe' && instance.bridge) {
      instance.bridge.emitEvent('command', { command, args });
    } else {
      logging.error(`SandboxManager: Cannot dispatch to ${sandboxId} - invalid state`);
      return;
    }

    logging.info(`SandboxManager: Dispatched command ${command} to ${sandboxId}`);
  }

  /**
   * Dispatch a command to all sandboxes of an extension.
   *
   * @param extensionId - The extension ID
   * @param command - The command name
   * @param args - Command arguments
   */
  public dispatchCommandToExtension(
    extensionId: string,
    command: string,
    args: unknown[] = [],
  ): void {
    const sandboxIds = this.extensionToSandboxes.get(extensionId);
    if (!sandboxIds || sandboxIds.size === 0) {
      logging.warn(
        `SandboxManager: No sandboxes found for extension ${extensionId}`,
      );
      return;
    }

    // Dispatch to all sandboxes of this extension
    for (const sandboxId of sandboxIds) {
      this.dispatchCommandToSandbox(sandboxId, command, args);
    }
  }

  /**
   * Get a sandbox instance by ID.
   */
  public getSandbox(sandboxId: string): SandboxInstance | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * Get all sandbox IDs for an extension.
   */
  public getSandboxesForExtension(extensionId: string): string[] {
    const sandboxIds = this.extensionToSandboxes.get(extensionId);
    return sandboxIds ? Array.from(sandboxIds) : [];
  }

  /**
   * Check if an extension has any ready sandboxes.
   */
  public hasReadySandbox(extensionId: string): boolean {
    const sandboxIds = this.extensionToSandboxes.get(extensionId);
    if (!sandboxIds) {
      return false;
    }

    for (const sandboxId of sandboxIds) {
      const instance = this.sandboxes.get(sandboxId);
      if (instance?.isReady) {
        return true;
      }
    }
    return false;
  }

  /**
   * Register a callback for sandbox ready events.
   */
  public onSandboxReady(callback: SandboxReadyCallback): () => void {
    this.readyCallbacks.add(callback);
    return () => this.readyCallbacks.delete(callback);
  }

  /**
   * Dispose of a sandbox instance.
   */
  public disposeSandbox(sandboxId: string): void {
    const instance = this.sandboxes.get(sandboxId);
    if (!instance) {
      return;
    }

    // Dispose based on sandbox type
    if (instance.type === 'worker' && instance.workerSandbox) {
      instance.workerSandbox.dispose();
    } else if (instance.type === 'iframe' && instance.bridge) {
      instance.bridge.disconnect();
    }

    this.sandboxes.delete(sandboxId);

    const extensionSandboxes = this.extensionToSandboxes.get(instance.extensionId);
    if (extensionSandboxes) {
      extensionSandboxes.delete(sandboxId);
      if (extensionSandboxes.size === 0) {
        this.extensionToSandboxes.delete(instance.extensionId);
      }
    }

    logging.info(`SandboxManager: Disposed sandbox ${sandboxId}`);
  }

  /**
   * Dispose of all sandboxes for an extension.
   */
  public disposeExtensionSandboxes(extensionId: string): void {
    const sandboxIds = this.extensionToSandboxes.get(extensionId);
    if (!sandboxIds) {
      return;
    }

    for (const sandboxId of Array.from(sandboxIds)) {
      this.disposeSandbox(sandboxId);
    }
  }

  /**
   * Dispose of all sandboxes.
   */
  public disposeAll(): void {
    for (const sandboxId of Array.from(this.sandboxes.keys())) {
      this.disposeSandbox(sandboxId);
    }
    this.readyCallbacks.clear();
  }
}

export default SandboxManager;
export { SandboxManager };
export type { SandboxInstance };
