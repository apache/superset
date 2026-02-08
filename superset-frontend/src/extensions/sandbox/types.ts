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
 * @fileoverview Type definitions for the Superset extension sandbox system.
 *
 * This module defines the types and interfaces for the tiered sandbox architecture
 * that provides security isolation for extensions. The sandbox system supports three
 * trust levels:
 *
 * - **Tier 1 (core)**: Trusted extensions run in the main context with full access
 * - **Tier 2 (iframe)**: Semi-trusted extensions run in sandboxed iframes with controlled API access
 * - **Tier 3 (wasm)**: Untrusted logic runs in WASM sandboxes with no DOM access
 */

/**
 * Trust levels for extension sandboxing.
 *
 * @remarks
 * The trust level determines how an extension is loaded and what APIs it can access:
 *
 * - `core`: Full access, runs in main context (requires signature verification)
 * - `iframe`: Runs in sandboxed iframe with postMessage API bridge (for UI extensions)
 * - `worker`: Runs in Web Worker with postMessage API bridge (for command-only extensions)
 * - `wasm`: Runs in WASM sandbox (QuickJS) for logic-only extensions
 */
export type SandboxTrustLevel = 'core' | 'iframe' | 'worker' | 'wasm';

/**
 * Configuration for extension sandbox behavior.
 */
export interface SandboxConfig {
  /**
   * The trust level for this extension.
   * Determines how the extension is loaded and sandboxed.
   */
  trustLevel: SandboxTrustLevel;

  /**
   * Permissions requested by the extension.
   * Only applies to sandboxed extensions (iframe/wasm).
   */
  permissions?: SandboxPermission[];

  /**
   * Content Security Policy directives for iframe sandboxes.
   * Allows fine-grained control over what resources the iframe can load.
   */
  csp?: ContentSecurityPolicy;

  /**
   * Resource limits for WASM sandboxes.
   */
  resourceLimits?: WASMResourceLimits;
}

/**
 * Permissions that sandboxed extensions can request.
 *
 * @remarks
 * Permissions follow a least-privilege model. Extensions must explicitly
 * request each permission they need, and users can review these requests
 * before enabling an extension.
 */
export type SandboxPermission =
  | 'api:read' // Read-only access to Superset APIs
  | 'api:write' // Write access to Superset APIs
  | 'sqllab:read' // Read SQL Lab state (queries, results)
  | 'sqllab:execute' // Execute SQL queries
  | 'dashboard:read' // Read dashboard data
  | 'dashboard:write' // Modify dashboards
  | 'chart:read' // Read chart data
  | 'chart:write' // Modify charts
  | 'user:read' // Read current user info
  | 'notification:show' // Show notifications to user
  | 'modal:open' // Open modal dialogs
  | 'navigation:redirect' // Navigate to other pages
  | 'clipboard:write' // Write to clipboard
  | 'download:file'; // Trigger file downloads

/**
 * Content Security Policy configuration for iframe sandboxes.
 */
export interface ContentSecurityPolicy {
  /** Allowed sources for default content */
  defaultSrc?: string[];
  /** Allowed sources for scripts */
  scriptSrc?: string[];
  /** Allowed sources for styles */
  styleSrc?: string[];
  /** Allowed sources for images */
  imgSrc?: string[];
  /** Allowed sources for fonts */
  fontSrc?: string[];
  /** Allowed sources for fetch/XHR */
  connectSrc?: string[];
  /** Allowed sources for frames */
  frameSrc?: string[];
}

/**
 * Resource limits for WASM sandbox execution.
 */
export interface WASMResourceLimits {
  /** Maximum memory in bytes (default: 10MB) */
  maxMemory?: number;
  /** Maximum execution time in milliseconds (default: 5000ms) */
  maxExecutionTime?: number;
  /** Maximum call stack depth (default: 1000) */
  maxStackSize?: number;
}

/**
 * Message types for sandbox bridge communication.
 */
export type SandboxMessageType =
  | 'api-call' // Extension calling a host API
  | 'api-response' // Host responding to an API call
  | 'event' // Host pushing an event to extension
  | 'event-subscribe' // Extension subscribing to an event
  | 'event-unsubscribe' // Extension unsubscribing from an event
  | 'ready' // Extension signaling it's ready
  | 'error'; // Error message

/**
 * Base message structure for sandbox bridge communication.
 */
export interface SandboxMessage {
  /** Type of message */
  type: SandboxMessageType;
  /** Unique correlation ID for request/response matching */
  id: string;
  /** Extension ID that sent/receives the message */
  extensionId: string;
}

/**
 * API call message from extension to host.
 */
export interface SandboxApiCallMessage extends SandboxMessage {
  type: 'api-call';
  /** The API method being called */
  method: string;
  /** Arguments to pass to the method */
  args: unknown[];
}

/**
 * API response message from host to extension.
 */
export interface SandboxApiResponseMessage extends SandboxMessage {
  type: 'api-response';
  /** The result of the API call (if successful) */
  result?: unknown;
  /** Error details (if failed) */
  error?: SandboxError;
}

/**
 * Event message from host to extension.
 */
export interface SandboxEventMessage extends SandboxMessage {
  type: 'event';
  /** The event name */
  eventName: string;
  /** Event payload data */
  data: unknown;
}

/**
 * Error structure for sandbox communication.
 */
export interface SandboxError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Host API interface exposed to sandboxed extensions.
 *
 * @remarks
 * This interface defines the controlled API surface that sandboxed extensions
 * can access. Each method requires specific permissions to be granted.
 */
export interface SandboxedExtensionHostAPI {
  // SQL Lab APIs (requires sqllab:read or sqllab:execute)
  sqlLab: {
    /** Get the current active SQL Lab tab */
    getCurrentTab(): Promise<SQLLabTab | null>;
    /** Get query results by query ID */
    getQueryResults(queryId: string): Promise<QueryResult | null>;
  };

  // Dashboard APIs (requires dashboard:read)
  dashboard: {
    /** Get current dashboard context */
    getContext(): Promise<DashboardContext | null>;
    /** Get dashboard filters */
    getFilters(): Promise<DashboardFilter[]>;
  };

  // Chart APIs (requires chart:read)
  chart: {
    /** Get chart data by chart ID */
    getData(chartId: number): Promise<ChartData | null>;
  };

  // User APIs (requires user:read)
  user: {
    /** Get current user info */
    getCurrentUser(): Promise<UserInfo>;
  };

  // UI APIs
  ui: {
    /** Show a notification (requires notification:show) */
    showNotification(
      message: string,
      type: 'info' | 'success' | 'warning' | 'error',
    ): void;
    /** Open a modal dialog (requires modal:open) */
    openModal(config: ModalConfig): Promise<ModalResult>;
    /** Navigate to a URL (requires navigation:redirect) */
    navigateTo(path: string): void;
  };

  // Utility APIs
  utils: {
    /** Copy text to clipboard (requires clipboard:write) */
    copyToClipboard(text: string): Promise<boolean>;
    /** Trigger a file download (requires download:file) */
    downloadFile(data: Blob, filename: string): void;
    /** Get CSRF token for API calls */
    getCSRFToken(): Promise<string>;
  };
}

// Supporting types for the host API

export interface SQLLabTab {
  id: string;
  title: string;
  databaseId: number | null;
  catalog: string | null;
  schema: string | null;
  sql: string;
}

export interface QueryResult {
  queryId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data: Record<string, unknown>[] | null;
  columns: string[];
  error: string | null;
}

export interface DashboardContext {
  id: number;
  title: string;
  slug: string | null;
}

export interface DashboardFilter {
  id: string;
  column: string;
  value: unknown;
}

export interface ChartData {
  chartId: number;
  data: Record<string, unknown>[];
  columns: string[];
}

export interface UserInfo {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

export interface ModalConfig {
  title: string;
  content: string;
  okText?: string;
  cancelText?: string;
  type?: 'info' | 'confirm' | 'warning' | 'error';
}

export interface ModalResult {
  confirmed: boolean;
}

/**
 * Configuration for iframe sandbox initialization.
 */
export interface IframeSandboxConfig {
  /** Unique ID for this sandbox instance */
  sandboxId: string;
  /** Extension ID being sandboxed */
  extensionId: string;
  /** HTML content to load in the iframe (srcdoc) */
  content: string;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** Callback when sandbox is ready */
  onReady?: () => void;
  /** Callback when sandbox encounters an error */
  onError?: (error: SandboxError) => void;
}

/**
 * Configuration for WASM sandbox initialization.
 */
export interface WASMSandboxConfig {
  /** Unique ID for this sandbox instance */
  sandboxId: string;
  /** Extension ID being sandboxed */
  extensionId: string;
  /** JavaScript code to execute */
  code: string;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** APIs to inject into the sandbox */
  injectedAPIs?: Record<string, unknown>;
}

/**
 * Result of WASM sandbox execution.
 */
export interface WASMExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Return value from the executed code */
  result?: unknown;
  /** Error if execution failed */
  error?: SandboxError;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Memory used in bytes */
  memoryUsed: number;
}

/**
 * Extension manifest sandbox configuration.
 *
 * @remarks
 * This is added to extension.json to declare sandbox requirements.
 */
export interface ExtensionSandboxManifest {
  /**
   * Trust level required for this extension.
   * @default 'iframe'
   */
  trustLevel?: SandboxTrustLevel;

  /**
   * Permissions requested by the extension.
   */
  permissions?: SandboxPermission[];

  /**
   * Custom CSP directives (for iframe sandboxes).
   */
  csp?: ContentSecurityPolicy;

  /**
   * Resource limits (for WASM sandboxes).
   */
  resourceLimits?: WASMResourceLimits;

  /**
   * Whether this extension requires signature verification.
   * Required for 'core' trust level.
   */
  requiresSignature?: boolean;
}
