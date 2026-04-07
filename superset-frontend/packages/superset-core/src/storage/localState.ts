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
 * @fileoverview Local State API for Superset extensions (Tier 1 Storage).
 *
 * Provides client-side KV storage backed by the browser's localStorage.
 * Data persists across browser sessions but is per-device (not shared across
 * devices or synced to the server).
 *
 * By default, all operations are user-scoped (private to the current user).
 * Use shared() to access state visible to all users on the same browser.
 *
 * Key patterns:
 * - User-scoped (default): superset-ext:{extension_id}:user:{user_id}:{key}
 * - Shared: superset-ext:{extension_id}:{key}
 *
 * The API is async to maintain compatibility with a future sandboxed execution
 * model where storage calls would go through a postMessage bridge.
 *
 * @example
 * ```typescript
 * import { localState } from '@apache-superset/core/storage';
 *
 * // User-scoped state (default - private to current user)
 * const isCollapsed = await localState.get('sidebar_collapsed');
 * await localState.set('sidebar_collapsed', true);
 * await localState.remove('sidebar_collapsed');
 *
 * // Shared state (visible to all users on same browser)
 * const deviceId = await localState.shared().get('device_id');
 * await localState.shared().set('device_id', 'abc-123');
 * ```
 */

/**
 * Interface for scoped local state access.
 * Returned by `shared()` for shared operations.
 */
export interface LocalStateAccessor {
  /**
   * Get a value from scoped local state.
   *
   * @param key The key to retrieve.
   * @returns The stored value, or null if not found.
   */
  get(key: string): Promise<unknown>;

  /**
   * Set a value in scoped local state.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Remove a value from scoped local state.
   *
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}

/**
 * Get a value from user-scoped local state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users on the same browser cannot see or modify this data.
 *
 * @param key The key to retrieve.
 * @returns The stored value, or null if not found.
 *
 * @example
 * ```typescript
 * const isCollapsed = await localState.get('sidebar_collapsed');
 * if (isCollapsed) {
 *   collapseSidebar();
 * }
 * ```
 */
export declare function get(key: string): Promise<unknown>;

/**
 * Set a value in user-scoped local state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users on the same browser cannot see or modify this data.
 *
 * @param key The key to store.
 * @param value The value to store (must be JSON-serializable).
 *
 * @example
 * ```typescript
 * await localState.set('sidebar_collapsed', true);
 * await localState.set('panel_width', 300);
 * ```
 */
export declare function set(key: string, value: unknown): Promise<void>;

/**
 * Remove a value from user-scoped local state.
 *
 * @param key The key to remove.
 *
 * @example
 * ```typescript
 * await localState.remove('sidebar_collapsed');
 * ```
 */
export declare function remove(key: string): Promise<void>;

/**
 * Get a shared local state accessor.
 *
 * Returns an accessor for state that is shared across all users on the
 * same browser/device. Use this for device-specific settings that should
 * persist regardless of which user is logged in.
 *
 * WARNING: Data stored via shared() is visible to all users on this browser.
 * Do not store user-specific or sensitive data here.
 *
 * @returns An accessor for shared local state.
 *
 * @example
 * ```typescript
 * // Get device-specific setting
 * const deviceId = await localState.shared().get('device_id');
 *
 * // Set device-specific setting
 * await localState.shared().set('last_used_printer', 'HP-1234');
 * ```
 */
export declare function shared(): LocalStateAccessor;
