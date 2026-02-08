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
 * @fileoverview Web Worker Sandbox for command-only extensions.
 *
 * This module provides a lightweight sandbox for extensions that don't need
 * to render UI. It uses Web Workers for isolation, which is lighter weight
 * than iframes but still provides security boundaries.
 *
 * @remarks
 * Web Workers:
 * - Run in a separate thread (true parallelism)
 * - Have no DOM access (can't render UI)
 * - Have no access to the parent's window, document, cookies, etc.
 * - Can make network requests (fetch)
 * - Communicate via postMessage (same as iframe sandbox)
 *
 * This is ideal for extensions that:
 * - Register command handlers
 * - Process data
 * - Make API calls
 * - But don't need to render any UI
 */

import { logging } from '@apache-superset/core';
import { nanoid } from 'nanoid';
import { SandboxConfig, SandboxError } from './types';
import { SandboxedExtensionHostImpl } from './SandboxedExtensionHost';

/**
 * Configuration for creating a WorkerSandbox.
 */
interface WorkerSandboxConfig {
  /** Unique ID for this sandbox instance */
  sandboxId: string;
  /** Extension ID */
  extensionId: string;
  /** Extension name */
  extensionName: string;
  /** The extension's JavaScript code to run in the worker */
  code: string;
  /** Sandbox configuration */
  config: SandboxConfig;
}

/**
 * Pending request tracker for async responses.
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: SandboxError) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Generate the worker script that includes the bridge client and extension code.
 */
function generateWorkerScript(extensionId: string, extensionCode: string): string {
  // The bridge client code for the worker
  const bridgeClientCode = `
    // Minimal SandboxBridgeClient for Web Worker
    class SandboxBridgeClient {
      constructor(extensionId) {
        this.extensionId = extensionId;
        this.pendingRequests = new Map();
        this.eventHandlers = new Map();
        this.callTimeout = 30000;
      }

      call(method, args = []) {
        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).slice(2);
          const timeout = setTimeout(() => {
            this.pendingRequests.delete(id);
            reject({ code: 'TIMEOUT', message: 'Call timed out' });
          }, this.callTimeout);
          this.pendingRequests.set(id, { resolve, reject, timeout });
          self.postMessage({
            type: 'api-call',
            id,
            extensionId: this.extensionId,
            method,
            args
          });
        });
      }

      on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
          this.eventHandlers.set(eventName, new Set());
        }
        this.eventHandlers.get(eventName).add(handler);
        return () => this.eventHandlers.get(eventName)?.delete(handler);
      }

      handleMessage(msg) {
        if (!msg || msg.extensionId !== this.extensionId) return;
        if (msg.type === 'api-response') {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(msg.id);
            msg.error ? pending.reject(msg.error) : pending.resolve(msg.result);
          }
        } else if (msg.type === 'event') {
          const handlers = this.eventHandlers.get(msg.eventName);
          if (handlers) handlers.forEach(h => { try { h(msg.data); } catch(e) { console.error(e); }});
        }
      }

      sendReady() {
        self.postMessage({
          type: 'ready',
          id: Math.random().toString(36).slice(2),
          extensionId: this.extensionId
        });
      }
    }

    // Command registry
    const commandRegistry = new Map();

    // Initialize the bridge
    const superset = {
      bridge: new SandboxBridgeClient('${extensionId}'),

      // Command system
      commands: {
        register: (command, handler) => {
          commandRegistry.set(command, handler);
          return () => commandRegistry.delete(command);
        },
        execute: async (command, ...args) => {
          const handler = commandRegistry.get(command);
          if (handler) {
            return handler(...args);
          }
          console.warn('Command not found:', command);
          return undefined;
        },
      },

      // API wrappers (same as iframe sandbox)
      sqlLab: {
        getCurrentTab: () => superset.bridge.call('sqlLab.getCurrentTab'),
        getQueryResults: (id) => superset.bridge.call('sqlLab.getQueryResults', [id]),
      },
      dashboard: {
        getContext: () => superset.bridge.call('dashboard.getContext'),
        getFilters: () => superset.bridge.call('dashboard.getFilters'),
      },
      chart: {
        getData: (id) => superset.bridge.call('chart.getData', [id]),
      },
      user: {
        getCurrentUser: () => superset.bridge.call('user.getCurrentUser'),
      },
      ui: {
        showNotification: (msg, type) => superset.bridge.call('ui.showNotification', [msg, type]),
        openModal: (config) => superset.bridge.call('ui.openModal', [config]),
        navigateTo: (path) => superset.bridge.call('ui.navigateTo', [path]),
      },
      utils: {
        copyToClipboard: (text) => superset.bridge.call('utils.copyToClipboard', [text]),
        downloadFile: (data, filename) => superset.bridge.call('utils.downloadFile', [data, filename]),
        getCSRFToken: () => superset.bridge.call('utils.getCSRFToken'),
      },
      on: (event, handler) => superset.bridge.on(event, handler),
    };

    // Listen for messages from host
    self.addEventListener('message', (event) => {
      superset.bridge.handleMessage(event.data);
    });

    // Listen for command events
    superset.on('command', ({ command, args }) => {
      superset.commands.execute(command, ...(args || []));
    });

    // Make available globally in worker scope
    self.superset = superset;

    // Signal ready
    superset.bridge.sendReady();
  `;

  return `
    ${bridgeClientCode}

    // Extension code
    ${extensionCode}

    // Auto-activate if the extension exports an activate function
    if (typeof activate === 'function') {
      activate();
    }
  `;
}

/**
 * Web Worker Sandbox for command-only extensions.
 *
 * @remarks
 * This provides a lightweight alternative to iframe sandboxes for extensions
 * that don't need to render UI. The worker runs in a separate thread with
 * no DOM access, communicating with the host via postMessage.
 *
 * @example
 * ```typescript
 * const sandbox = new WorkerSandbox({
 *   sandboxId: 'worker-1',
 *   extensionId: 'my-extension',
 *   extensionName: 'My Extension',
 *   code: `
 *     superset.commands.register('my-extension.doSomething', async () => {
 *       const data = await superset.sqlLab.getCurrentTab();
 *       superset.ui.showNotification('Got data!', 'success');
 *     });
 *   `,
 *   config: { trustLevel: 'worker', permissions: ['sqllab:read'] },
 * });
 *
 * await sandbox.initialize();
 * sandbox.dispatchCommand('my-extension.doSomething');
 * ```
 */
export class WorkerSandbox {
  private config: WorkerSandboxConfig;
  private worker: Worker | null = null;
  private hostImpl: SandboxedExtensionHostImpl;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isReady = false;
  private readyPromise: Promise<void>;
  private readyResolve: (() => void) | null = null;
  private onReadyCallback: (() => void) | null = null;
  private onErrorCallback: ((error: SandboxError) => void) | null = null;

  constructor(config: WorkerSandboxConfig) {
    this.config = config;
    this.hostImpl = new SandboxedExtensionHostImpl(
      config.extensionId,
      config.config.permissions ?? [],
    );

    // Create a promise that resolves when the worker is ready
    this.readyPromise = new Promise(resolve => {
      this.readyResolve = resolve;
    });
  }

  /**
   * Initialize the worker sandbox.
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      logging.warn(`WorkerSandbox ${this.config.sandboxId} already initialized`);
      return;
    }

    try {
      // Generate the worker script
      const workerScript = generateWorkerScript(
        this.config.extensionId,
        this.config.code,
      );

      // Create a Blob URL for the worker
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      // Create the worker
      this.worker = new Worker(workerUrl);

      // Clean up the Blob URL (worker has already loaded it)
      URL.revokeObjectURL(workerUrl);

      // Set up message handling
      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.worker.onerror = (event: ErrorEvent) => {
        const error: SandboxError = {
          code: 'WORKER_ERROR',
          message: event.message || 'Worker error',
        };
        logging.error(`WorkerSandbox ${this.config.sandboxId} error:`, error);
        this.onErrorCallback?.(error);
      };

      logging.info(`WorkerSandbox ${this.config.sandboxId} initialized`);

      // Wait for ready signal with timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Worker ready timeout'));
          }
        }, 10000);
      });

      await Promise.race([this.readyPromise, timeoutPromise]);
    } catch (error) {
      const sandboxError: SandboxError = {
        code: 'INIT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to initialize worker',
      };
      this.onErrorCallback?.(sandboxError);
      throw sandboxError;
    }
  }

  /**
   * Handle messages from the worker.
   */
  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    const msg = message as {
      type: string;
      id?: string;
      extensionId?: string;
      method?: string;
      args?: unknown[];
      result?: unknown;
      error?: SandboxError;
    };

    // Verify message is from our extension
    if (msg.extensionId !== this.config.extensionId) {
      return;
    }

    switch (msg.type) {
      case 'ready':
        this.isReady = true;
        this.readyResolve?.();
        this.onReadyCallback?.();
        logging.info(`WorkerSandbox ${this.config.sandboxId} ready`);
        break;

      case 'api-call':
        await this.handleApiCall(msg.id!, msg.method!, msg.args ?? []);
        break;

      case 'api-response':
        this.handleApiResponse(msg.id!, msg.result, msg.error);
        break;

      default:
        logging.warn(`Unknown message type from worker: ${msg.type}`);
    }
  }

  /**
   * Handle API call from the worker.
   */
  private async handleApiCall(
    id: string,
    method: string,
    args: unknown[],
  ): Promise<void> {
    try {
      const result = await this.hostImpl.handleApiCall(method, args);
      this.sendToWorker({
        type: 'api-response',
        id,
        extensionId: this.config.extensionId,
        result,
      });
    } catch (error) {
      const sandboxError = error as SandboxError;
      this.sendToWorker({
        type: 'api-response',
        id,
        extensionId: this.config.extensionId,
        error: {
          code: sandboxError.code || 'EXECUTION_ERROR',
          message: sandboxError.message || 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle API response (for any host-initiated calls).
   */
  private handleApiResponse(
    id: string,
    result?: unknown,
    error?: SandboxError,
  ): void {
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Send a message to the worker.
   */
  private sendToWorker(message: unknown): void {
    if (!this.worker) {
      logging.error('Cannot send message: worker not initialized');
      return;
    }
    this.worker.postMessage(message);
  }

  /**
   * Dispatch a command to the worker.
   */
  dispatchCommand(command: string, args: unknown[] = []): void {
    if (!this.isReady) {
      logging.warn(`Worker not ready, cannot dispatch command: ${command}`);
      return;
    }

    this.sendToWorker({
      type: 'event',
      id: nanoid(),
      extensionId: this.config.extensionId,
      eventName: 'command',
      data: { command, args },
    });
  }

  /**
   * Emit an event to the worker.
   */
  emitEvent(eventName: string, data: unknown): void {
    if (!this.isReady) {
      logging.warn(`Worker not ready, cannot emit event: ${eventName}`);
      return;
    }

    this.sendToWorker({
      type: 'event',
      id: nanoid(),
      extensionId: this.config.extensionId,
      eventName,
      data,
    });
  }

  /**
   * Set callback for when the worker is ready.
   */
  onReady(callback: () => void): void {
    this.onReadyCallback = callback;
    if (this.isReady) {
      callback();
    }
  }

  /**
   * Set callback for errors.
   */
  onError(callback: (error: SandboxError) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Check if the worker is ready.
   */
  getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Get the sandbox ID.
   */
  getSandboxId(): string {
    return this.config.sandboxId;
  }

  /**
   * Get the extension ID.
   */
  getExtensionId(): string {
    return this.config.extensionId;
  }

  /**
   * Dispose of the worker and clean up resources.
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject any pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject({
        code: 'DISPOSED',
        message: 'Worker sandbox was disposed',
      });
    }
    this.pendingRequests.clear();

    this.isReady = false;
    logging.info(`WorkerSandbox ${this.config.sandboxId} disposed`);
  }
}

/**
 * Factory function to create and initialize a WorkerSandbox.
 */
export async function createWorkerSandbox(
  config: WorkerSandboxConfig,
): Promise<WorkerSandbox> {
  const sandbox = new WorkerSandbox(config);
  await sandbox.initialize();
  return sandbox;
}

export default WorkerSandbox;
export type { WorkerSandboxConfig };
