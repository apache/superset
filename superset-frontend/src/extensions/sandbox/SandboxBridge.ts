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
 * @fileoverview Sandbox Bridge for secure postMessage RPC communication.
 *
 * This module provides a secure communication layer between the Superset host
 * application and sandboxed extensions running in iframes. It implements a
 * request/response pattern with correlation IDs for reliable async communication.
 */

import { logging } from '@apache-superset/core';
import { nanoid } from 'nanoid';
import {
  SandboxMessage,
  SandboxApiCallMessage,
  SandboxApiResponseMessage,
  SandboxEventMessage,
  SandboxError,
  SandboxPermission,
} from './types';

/**
 * Pending request tracker for async responses.
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: SandboxError) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Options for initializing the SandboxBridge.
 */
interface SandboxBridgeOptions {
  /** Unique ID for this bridge instance */
  bridgeId: string;
  /** Extension ID this bridge is communicating with */
  extensionId: string;
  /** Permissions granted to this extension */
  permissions: SandboxPermission[];
  /** Timeout for API calls in milliseconds */
  callTimeout?: number;
}

/**
 * Host-side sandbox bridge for communicating with iframe sandboxes.
 *
 * @remarks
 * The SandboxBridge handles all communication between the Superset host
 * and sandboxed extensions. It provides:
 *
 * - Request/response pattern with correlation IDs
 * - Permission checking before executing API calls
 * - Event subscriptions with automatic cleanup
 * - Timeout handling for unresponsive extensions
 *
 * @example
 * ```typescript
 * const bridge = new SandboxBridge({
 *   bridgeId: 'sandbox-123',
 *   extensionId: 'my-extension',
 *   permissions: ['sqllab:read', 'notification:show'],
 * });
 *
 * bridge.connect(iframeElement.contentWindow);
 *
 * // Listen for API calls from the extension
 * bridge.onApiCall(async (method, args) => {
 *   // Handle the call based on method
 * });
 * ```
 */
export class SandboxBridge {
  private bridgeId: string;

  private extensionId: string;

  private permissions: Set<SandboxPermission>;

  // @ts-expect-error Reserved for future use in timeout handling
  private _callTimeout: number;

  private targetWindow: Window | null = null;

  private pendingRequests: Map<string, PendingRequest> = new Map();

  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  private messageHandler: ((event: MessageEvent) => void) | null = null;

  private apiHandler:
    | ((method: string, args: unknown[]) => Promise<unknown>)
    | null = null;

  private readyCallback: (() => void) | null = null;

  private isConnected = false;

  constructor(options: SandboxBridgeOptions) {
    this.bridgeId = options.bridgeId;
    this.extensionId = options.extensionId;
    this.permissions = new Set(options.permissions);
    this._callTimeout = options.callTimeout ?? 30000;
  }

  /**
   * Connect the bridge to an iframe's content window.
   *
   * @param targetWindow - The iframe's contentWindow to communicate with
   * @param onReady - Optional callback when the extension signals ready
   */
  connect(targetWindow: Window, onReady?: () => void): void {
    if (this.isConnected) {
      logging.warn(
        `SandboxBridge ${this.bridgeId} is already connected. Disconnecting first.`,
      );
      this.disconnect();
    }

    this.targetWindow = targetWindow;
    this.readyCallback = onReady ?? null;

    // Set up message listener
    this.messageHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    window.addEventListener('message', this.messageHandler);
    this.isConnected = true;

    logging.info(`SandboxBridge ${this.bridgeId} connected`);
  }

  /**
   * Disconnect the bridge and clean up resources.
   */
  disconnect(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject({
        code: 'BRIDGE_DISCONNECTED',
        message: 'Sandbox bridge was disconnected',
      });
    }
    this.pendingRequests.clear();

    // Clear event listeners
    this.eventListeners.clear();

    this.targetWindow = null;
    this.isConnected = false;

    logging.info(`SandboxBridge ${this.bridgeId} disconnected`);
  }

  /**
   * Register a handler for API calls from the extension.
   *
   * @param handler - Function to handle API calls
   */
  onApiCall(
    handler: (method: string, args: unknown[]) => Promise<unknown>,
  ): void {
    this.apiHandler = handler;
  }

  /**
   * Send an event to the sandboxed extension.
   *
   * @param eventName - Name of the event
   * @param data - Event payload
   */
  emitEvent(eventName: string, data: unknown): void {
    if (!this.isConnected || !this.targetWindow) {
      logging.warn(
        `Cannot emit event ${eventName}: bridge is not connected`,
      );
      return;
    }

    const message: SandboxEventMessage = {
      type: 'event',
      id: nanoid(),
      extensionId: this.extensionId,
      eventName,
      data,
    };

    this.postMessage(message);
  }

  /**
   * Check if the extension has a specific permission.
   *
   * @param permission - The permission to check
   * @returns true if the permission is granted
   */
  hasPermission(permission: SandboxPermission): boolean {
    return this.permissions.has(permission);
  }

  /**
   * Get all granted permissions.
   */
  getPermissions(): SandboxPermission[] {
    return Array.from(this.permissions);
  }

  /**
   * Handle incoming messages from the sandbox.
   */
  private handleMessage(event: MessageEvent): void {
    // Validate the message origin and structure
    const message = event.data as SandboxMessage;

    if (!message || typeof message !== 'object') {
      return;
    }

    // Verify the message is from the correct extension
    if (message.extensionId !== this.extensionId) {
      return;
    }

    switch (message.type) {
      case 'ready':
        this.handleReady();
        break;
      case 'api-call':
        this.handleApiCall(message as SandboxApiCallMessage);
        break;
      case 'api-response':
        this.handleApiResponse(message as SandboxApiResponseMessage);
        break;
      case 'event-subscribe':
        // Extension subscribing to events (handled separately)
        break;
      default:
        logging.warn(
          `SandboxBridge ${this.bridgeId} received unknown message type: ${message.type}`,
        );
    }
  }

  /**
   * Handle ready signal from the extension.
   */
  private handleReady(): void {
    logging.info(
      `Extension ${this.extensionId} signaled ready via bridge ${this.bridgeId}`,
    );

    if (this.readyCallback) {
      this.readyCallback();
    }
  }

  /**
   * Handle API call from the extension.
   */
  private async handleApiCall(message: SandboxApiCallMessage): Promise<void> {
    const { id, method, args } = message;

    try {
      // Check if we have a handler
      if (!this.apiHandler) {
        this.sendResponse(id, undefined, {
          code: 'NO_HANDLER',
          message: 'No API handler registered',
        });
        return;
      }

      // Check permissions for the requested method
      const requiredPermission = this.getRequiredPermission(method);
      if (requiredPermission && !this.hasPermission(requiredPermission)) {
        this.sendResponse(id, undefined, {
          code: 'PERMISSION_DENIED',
          message: `Permission '${requiredPermission}' required for method '${method}'`,
        });
        return;
      }

      // Execute the API call
      const result = await this.apiHandler(method, args);
      this.sendResponse(id, result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.sendResponse(id, undefined, {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Handle API response for a pending request.
   */
  private handleApiResponse(message: SandboxApiResponseMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      logging.warn(
        `Received response for unknown request: ${message.id}`,
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(message.error);
    } else {
      pending.resolve(message.result);
    }
  }

  /**
   * Send a response to an API call.
   */
  private sendResponse(
    requestId: string,
    result?: unknown,
    error?: SandboxError,
  ): void {
    const response: SandboxApiResponseMessage = {
      type: 'api-response',
      id: requestId,
      extensionId: this.extensionId,
      result,
      error,
    };

    this.postMessage(response);
  }

  /**
   * Post a message to the sandboxed iframe.
   */
  private postMessage(message: SandboxMessage): void {
    if (!this.targetWindow) {
      logging.error('Cannot post message: no target window');
      return;
    }

    // Use '*' for targetOrigin since sandboxed iframes without allow-same-origin
    // have an opaque origin that we can't specify
    this.targetWindow.postMessage(message, '*');
  }

  /**
   * Get the required permission for an API method.
   *
   * @remarks
   * Maps API method names to their required permissions.
   * Methods without a mapping are allowed without permissions.
   */
  private getRequiredPermission(method: string): SandboxPermission | null {
    const permissionMap: Record<string, SandboxPermission> = {
      // SQL Lab
      'sqlLab.getCurrentTab': 'sqllab:read',
      'sqlLab.getQueryResults': 'sqllab:read',
      'sqlLab.executeQuery': 'sqllab:execute',

      // Dashboard
      'dashboard.getContext': 'dashboard:read',
      'dashboard.getFilters': 'dashboard:read',
      'dashboard.setFilter': 'dashboard:write',

      // Chart
      'chart.getData': 'chart:read',
      'chart.refresh': 'chart:write',

      // User
      'user.getCurrentUser': 'user:read',

      // UI
      'ui.showNotification': 'notification:show',
      'ui.openModal': 'modal:open',
      'ui.navigateTo': 'navigation:redirect',

      // Utils
      'utils.copyToClipboard': 'clipboard:write',
      'utils.downloadFile': 'download:file',
      // 'utils.getCSRFToken' - no permission required
    };

    return permissionMap[method] ?? null;
  }
}

/**
 * Client-side bridge for use inside sandboxed iframes.
 *
 * @remarks
 * This class is used by extensions running inside sandboxed iframes
 * to communicate with the Superset host. It provides a Promise-based
 * API for calling host methods.
 *
 * @example
 * ```typescript
 * // Inside the sandboxed extension
 * const client = new SandboxBridgeClient('my-extension');
 * client.connect(window.parent);
 *
 * // Call host APIs
 * const tab = await client.call('sqlLab.getCurrentTab');
 * await client.call('ui.showNotification', ['Hello!', 'info']);
 * ```
 */
export class SandboxBridgeClient {
  private extensionId: string;

  private targetWindow: Window | null = null;

  private pendingRequests: Map<string, PendingRequest> = new Map();

  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  private messageHandler: ((event: MessageEvent) => void) | null = null;

  private callTimeout: number;

  constructor(extensionId: string, callTimeout = 30000) {
    this.extensionId = extensionId;
    this.callTimeout = callTimeout;
  }

  /**
   * Connect to the parent window (Superset host).
   *
   * @param parentWindow - Usually window.parent
   */
  connect(parentWindow: Window): void {
    this.targetWindow = parentWindow;

    this.messageHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    window.addEventListener('message', this.messageHandler);

    // Signal ready to the host
    this.sendReady();
  }

  /**
   * Disconnect from the host.
   */
  disconnect(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject({
        code: 'DISCONNECTED',
        message: 'Bridge disconnected',
      });
    }
    this.pendingRequests.clear();

    this.targetWindow = null;
  }

  /**
   * Call a host API method.
   *
   * @param method - The API method to call (e.g., 'sqlLab.getCurrentTab')
   * @param args - Arguments to pass to the method
   * @returns Promise resolving to the method result
   */
  call<T = unknown>(method: string, args: unknown[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.targetWindow) {
        reject({
          code: 'NOT_CONNECTED',
          message: 'Bridge is not connected',
        });
        return;
      }

      const id = nanoid();

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject({
          code: 'TIMEOUT',
          message: `Call to ${method} timed out after ${this.callTimeout}ms`,
        });
      }, this.callTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const message: SandboxApiCallMessage = {
        type: 'api-call',
        id,
        extensionId: this.extensionId,
        method,
        args,
      };

      this.targetWindow.postMessage(message, '*');
    });
  }

  /**
   * Subscribe to events from the host.
   *
   * @param eventName - Name of the event to subscribe to
   * @param handler - Function to call when the event is received
   * @returns Function to unsubscribe
   */
  on(eventName: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }

    this.eventHandlers.get(eventName)!.add(handler);

    return () => {
      this.eventHandlers.get(eventName)?.delete(handler);
    };
  }

  /**
   * Handle messages from the host.
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data as SandboxMessage;

    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.extensionId !== this.extensionId) {
      return;
    }

    switch (message.type) {
      case 'api-response':
        this.handleApiResponse(message as SandboxApiResponseMessage);
        break;
      case 'event':
        this.handleEvent(message as SandboxEventMessage);
        break;
      default:
        // Ignore unknown message types
        break;
    }
  }

  /**
   * Handle API response from the host.
   */
  private handleApiResponse(message: SandboxApiResponseMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(message.error);
    } else {
      pending.resolve(message.result);
    }
  }

  /**
   * Handle event from the host.
   */
  private handleEvent(message: SandboxEventMessage): void {
    const handlers = this.eventHandlers.get(message.eventName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.data);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Error in event handler for ${message.eventName}:`, error);
        }
      }
    }
  }

  /**
   * Send ready signal to the host.
   */
  private sendReady(): void {
    if (!this.targetWindow) {
      return;
    }

    const message: SandboxMessage = {
      type: 'ready',
      id: nanoid(),
      extensionId: this.extensionId,
    };

    this.targetWindow.postMessage(message, '*');
  }
}

export default SandboxBridge;
