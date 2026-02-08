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
 * @fileoverview Sandbox API types for Superset extensions.
 *
 * This module defines the types and interfaces for the extension sandbox system.
 * Extensions use these types to declare their security requirements and access
 * the sandboxed API when running in iframe or WASM sandboxes.
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
 * Permissions that sandboxed extensions can request.
 *
 * @remarks
 * Permissions follow a least-privilege model. Extensions must explicitly
 * request each permission they need.
 */
export type SandboxPermission =
  | 'api:read'
  | 'api:write'
  | 'sqllab:read'
  | 'sqllab:execute'
  | 'dashboard:read'
  | 'dashboard:write'
  | 'chart:read'
  | 'chart:write'
  | 'user:read'
  | 'notification:show'
  | 'modal:open'
  | 'navigation:redirect'
  | 'clipboard:write'
  | 'download:file';

/**
 * Content Security Policy configuration for iframe sandboxes.
 */
export interface ContentSecurityPolicy {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
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
 * Sandbox configuration for extension.json manifest.
 *
 * @example
 * ```json
 * {
 *   "sandbox": {
 *     "trustLevel": "iframe",
 *     "permissions": ["sqllab:read", "notification:show"],
 *     "csp": {
 *       "connectSrc": ["https://api.example.com"]
 *     }
 *   }
 * }
 * ```
 */
export interface SandboxManifest {
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

// ============================================================================
// Sandboxed Extension Client API
// ============================================================================

/**
 * SQL Lab tab information available to sandboxed extensions.
 */
export interface SQLLabTab {
  id: string;
  title: string;
  databaseId: number | null;
  catalog: string | null;
  schema: string | null;
  sql: string;
}

/**
 * Query result information available to sandboxed extensions.
 */
export interface QueryResult {
  queryId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data: Record<string, unknown>[] | null;
  columns: string[];
  error: string | null;
}

/**
 * Dashboard context available to sandboxed extensions.
 */
export interface DashboardContext {
  id: number;
  title: string;
  slug: string | null;
}

/**
 * Dashboard filter information.
 */
export interface DashboardFilter {
  id: string;
  column: string;
  value: unknown;
}

/**
 * Chart data available to sandboxed extensions.
 */
export interface ChartData {
  chartId: number;
  data: Record<string, unknown>[];
  columns: string[];
}

/**
 * User information available to sandboxed extensions.
 */
export interface UserInfo {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

/**
 * Modal dialog configuration.
 */
export interface ModalConfig {
  title: string;
  content: string;
  okText?: string;
  cancelText?: string;
  type?: 'info' | 'confirm' | 'warning' | 'error';
}

/**
 * Modal dialog result.
 */
export interface ModalResult {
  confirmed: boolean;
}

/**
 * API available to sandboxed extensions running in iframes.
 *
 * @remarks
 * This interface is available as `window.superset` inside sandboxed iframes.
 * Each method requires specific permissions to be granted in the extension manifest.
 *
 * @example
 * ```typescript
 * // Inside a sandboxed extension
 * const tab = await window.superset.sqlLab.getCurrentTab();
 * await window.superset.ui.showNotification('Hello!', 'success');
 * ```
 */
export interface SandboxedExtensionAPI {
  /** SQL Lab APIs (requires sqllab:read or sqllab:execute) */
  sqlLab: {
    getCurrentTab(): Promise<SQLLabTab | null>;
    getQueryResults(queryId: string): Promise<QueryResult | null>;
  };

  /** Dashboard APIs (requires dashboard:read) */
  dashboard: {
    getContext(): Promise<DashboardContext | null>;
    getFilters(): Promise<DashboardFilter[]>;
  };

  /** Chart APIs (requires chart:read) */
  chart: {
    getData(chartId: number): Promise<ChartData | null>;
  };

  /** User APIs (requires user:read) */
  user: {
    getCurrentUser(): Promise<UserInfo>;
  };

  /** UI APIs */
  ui: {
    showNotification(
      message: string,
      type: 'info' | 'success' | 'warning' | 'error',
    ): void;
    openModal(config: ModalConfig): Promise<ModalResult>;
    navigateTo(path: string): void;
  };

  /** Utility APIs */
  utils: {
    copyToClipboard(text: string): Promise<boolean>;
    downloadFile(data: Blob | string, filename: string): void;
    getCSRFToken(): Promise<string>;
  };

  /** Subscribe to events from the host */
  on(eventName: string, handler: (data: unknown) => void): () => void;
}

/**
 * Note: In sandboxed iframes, window.superset is available as SandboxedExtensionAPI.
 * The actual type declaration is injected into the iframe's runtime, not here,
 * to avoid conflicts with the main Superset application's window type.
 */
