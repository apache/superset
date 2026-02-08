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
 * @fileoverview Host-side implementation of the sandboxed extension API.
 *
 * This module provides the actual implementations for API methods that
 * sandboxed extensions can call through the SandboxBridge. It enforces
 * permission checks and provides safe access to Superset functionality.
 */

import { logging } from '@apache-superset/core';
import {
  SandboxPermission,
  SandboxError,
  SQLLabTab,
  QueryResult,
  DashboardContext,
  DashboardFilter,
  ChartData,
  UserInfo,
  ModalConfig,
  ModalResult,
} from './types';

/**
 * Permission requirement for each API method.
 */
const PERMISSION_MAP: Record<string, SandboxPermission | null> = {
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
  'utils.getCSRFToken': null, // No permission required
};

/**
 * Implementation of the host API for sandboxed extensions.
 *
 * @remarks
 * This class provides the actual functionality for API calls made by
 * sandboxed extensions. Each method checks permissions before executing
 * and returns results in a format safe for postMessage serialization.
 */
export class SandboxedExtensionHostImpl {
  // @ts-expect-error Reserved for future use in logging/auditing
  private _extensionId: string;

  private permissions: Set<SandboxPermission>;

  constructor(extensionId: string, permissions: SandboxPermission[]) {
    this._extensionId = extensionId;
    this.permissions = new Set(permissions);
  }

  /**
   * Check if the extension has a specific permission.
   */
  hasPermission(permission: SandboxPermission): boolean {
    return this.permissions.has(permission);
  }

  /**
   * Handle an API call from the sandboxed extension.
   *
   * @param method - The method name (e.g., 'sqlLab.getCurrentTab')
   * @param args - Arguments passed to the method
   * @returns The result of the API call
   * @throws SandboxError if permission denied or method not found
   */
  async handleApiCall(method: string, args: unknown[]): Promise<unknown> {
    // Check permission
    const requiredPermission = PERMISSION_MAP[method];
    if (requiredPermission !== null && requiredPermission !== undefined) {
      if (!this.hasPermission(requiredPermission)) {
        throw {
          code: 'PERMISSION_DENIED',
          message: `Permission '${requiredPermission}' required for '${method}'`,
        } as SandboxError;
      }
    }

    // Route to the appropriate handler
    const [namespace, methodName] = method.split('.');

    switch (namespace) {
      case 'sqlLab':
        return this.handleSqlLabCall(methodName, args);
      case 'dashboard':
        return this.handleDashboardCall(methodName, args);
      case 'chart':
        return this.handleChartCall(methodName, args);
      case 'user':
        return this.handleUserCall(methodName, args);
      case 'ui':
        return this.handleUICall(methodName, args);
      case 'utils':
        return this.handleUtilsCall(methodName, args);
      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown API namespace: ${namespace}`,
        } as SandboxError;
    }
  }

  /**
   * Handle SQL Lab API calls.
   */
  private async handleSqlLabCall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'getCurrentTab': {
        // Access the SQL Lab state from the Redux store
        // This is a simplified implementation - in production, this would
        // interface with the actual SQL Lab state
        const state = this.getReduxState();
        const sqlLab = state?.sqlLab as Record<string, unknown> | undefined;

        if (!sqlLab) {
          return null;
        }

        const queryEditors = sqlLab.queryEditors as Array<Record<string, unknown>> | undefined;
        const tabHistory = sqlLab.tabHistory as string[] | undefined;

        const activeTab = queryEditors?.find(
          (qe: Record<string, unknown>) => qe.id === tabHistory?.slice(-1)[0],
        );

        if (!activeTab) {
          return null;
        }

        return {
          id: activeTab.id as string,
          title: (activeTab.title as string) || 'Untitled',
          databaseId: (activeTab.dbId as number) ?? null,
          catalog: (activeTab.catalog as string) ?? null,
          schema: (activeTab.schema as string) ?? null,
          sql: (activeTab.sql as string) ?? '',
        } as SQLLabTab;
      }

      case 'getQueryResults': {
        const queryId = args[0] as string;
        if (!queryId) {
          throw {
            code: 'INVALID_ARGUMENT',
            message: 'Query ID is required',
          } as SandboxError;
        }

        const state = this.getReduxState();
        const sqlLab = state?.sqlLab as Record<string, unknown> | undefined;
        const queries = sqlLab?.queries as Record<string, Record<string, unknown>> | undefined;
        const query = queries?.[queryId];

        if (!query) {
          return null;
        }

        const results = query.results as Record<string, unknown> | undefined;
        const columns = results?.columns as Array<Record<string, unknown>> | undefined;

        return {
          queryId: query.id as string,
          status: query.state as string,
          data: (results?.data as Record<string, unknown>[]) ?? null,
          columns: columns?.map((c: Record<string, unknown>) => c.name as string) ?? [],
          error: (query.errorMessage as string) ?? null,
        } as QueryResult;
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown sqlLab method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Handle Dashboard API calls.
   */
  private async handleDashboardCall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'getContext': {
        const state = this.getReduxState();
        const dashboard = state?.dashboardInfo as Record<string, unknown> | undefined;

        if (!dashboard) {
          return null;
        }

        return {
          id: dashboard.id as number,
          title: dashboard.dash_edit_perm
            ? (dashboard.dashboard_title as string)
            : 'Dashboard',
          slug: (dashboard.slug as string) ?? null,
        } as DashboardContext;
      }

      case 'getFilters': {
        const state = this.getReduxState();
        const nativeFilters = state?.nativeFilters as Record<string, unknown> | undefined;
        const filters = nativeFilters?.filters as Record<string, Record<string, unknown>> | undefined;

        if (!filters) {
          return [];
        }

        return Object.entries(filters).map(
          ([id, filter]: [string, Record<string, unknown>]) => {
            const targets = filter.targets as Array<Record<string, unknown>> | undefined;
            const column = targets?.[0]?.column as Record<string, unknown> | undefined;
            return {
              id,
              column: (column?.name as string) ?? '',
              value: filter.currentValue ?? null,
            };
          },
        ) as DashboardFilter[];
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown dashboard method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Handle Chart API calls.
   */
  private async handleChartCall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'getData': {
        const chartId = args[0] as number;
        if (typeof chartId !== 'number') {
          throw {
            code: 'INVALID_ARGUMENT',
            message: 'Chart ID must be a number',
          } as SandboxError;
        }

        const state = this.getReduxState();
        const charts = state?.charts as Record<number, { queriesResponse?: Array<{ data?: unknown[]; colnames?: string[] }> }> | undefined;
        const chartState = charts?.[chartId];

        if (!chartState?.queriesResponse?.[0]) {
          return null;
        }

        const queryResponse = chartState.queriesResponse[0];
        return {
          chartId,
          data: queryResponse.data ?? [],
          columns: queryResponse.colnames ?? [],
        } as ChartData;
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown chart method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Handle User API calls.
   */
  private async handleUserCall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'getCurrentUser': {
        const state = this.getReduxState();
        const user = state?.user as Record<string, unknown> | undefined;

        if (!user) {
          throw {
            code: 'NO_USER',
            message: 'No user information available',
          } as SandboxError;
        }

        const roles = user.roles as Record<string, unknown> | undefined;

        return {
          id: user.userId as number,
          username: user.username as string,
          firstName: (user.firstName as string) ?? '',
          lastName: (user.lastName as string) ?? '',
          email: (user.email as string) ?? '',
          roles: Object.keys(roles ?? {}),
        } as UserInfo;
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown user method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Handle UI API calls.
   */
  private async handleUICall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'showNotification': {
        const [message, type] = args as [
          string,
          'info' | 'success' | 'warning' | 'error',
        ];

        // Use the browser's notification API or a toast library
        // For now, we'll dispatch to the global message system
        const { message: antdMessage } = await import('antd');
        antdMessage[type || 'info'](message);
        return undefined;
      }

      case 'openModal': {
        const config = args[0] as ModalConfig;

        // Use antd's Modal.confirm for simple modals
        const { Modal } = await import('antd');

        return new Promise<ModalResult>(resolve => {
          const modalType = config.type === 'confirm' ? 'confirm' : config.type || 'info';
          const modalMethod = Modal[modalType as keyof typeof Modal] as (
            config: Record<string, unknown>,
          ) => void;

          modalMethod({
            title: config.title,
            content: config.content,
            okText: config.okText ?? 'OK',
            cancelText: config.cancelText ?? 'Cancel',
            onOk: () => resolve({ confirmed: true }),
            onCancel: () => resolve({ confirmed: false }),
          });
        });
      }

      case 'navigateTo': {
        const path = args[0] as string;

        // Validate the path is a relative URL within Superset
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
          throw {
            code: 'INVALID_PATH',
            message: 'Only relative paths are allowed',
          } as SandboxError;
        }

        // Use React Router's history if available, otherwise window.location
        window.location.href = path;
        return undefined;
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown ui method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Handle Utils API calls.
   */
  private async handleUtilsCall(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case 'copyToClipboard': {
        const text = args[0] as string;
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          logging.warn('Failed to copy to clipboard:', err);
          return false;
        }
      }

      case 'downloadFile': {
        const [data, filename] = args as [Blob | string, string];

        // Handle both Blob and base64 string data
        let blob: Blob;
        if (typeof data === 'string') {
          // Assume base64 encoded data
          const byteCharacters = atob(data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i += 1) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray]);
        } else {
          blob = data;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return undefined;
      }

      case 'getCSRFToken': {
        // Get CSRF token from cookie or meta tag
        const csrfToken =
          document
            .querySelector('meta[name="csrf_token"]')
            ?.getAttribute('content') ??
          document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf_access_token='))
            ?.split('=')[1] ??
          '';

        return csrfToken;
      }

      default:
        throw {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown utils method: ${method}`,
        } as SandboxError;
    }
  }

  /**
   * Get the Redux state.
   *
   * @remarks
   * This accesses the global Redux store. In a production implementation,
   * this should be injected via dependency injection.
   */
  private getReduxState(): Record<string, unknown> | null {
    // Access the global Redux store
    // This is a simplified approach - in production, use proper DI
    const windowWithStore = window as unknown as {
      __REDUX_STORE__?: { getState: () => Record<string, unknown> };
    };
    const store = windowWithStore.__REDUX_STORE__;
    if (store && typeof store.getState === 'function') {
      return store.getState();
    }
    return null;
  }
}

export default SandboxedExtensionHostImpl;
