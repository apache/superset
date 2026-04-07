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
 * @fileoverview Session State API for Superset extensions (Tier 1 Storage).
 *
 * Provides client-side KV storage backed by the browser's sessionStorage.
 * Data is cleared when the browser tab/window is closed. Use this for
 * truly transient UI state that should not persist across sessions.
 *
 * By default, all operations are user-scoped (private to the current user).
 * Use shared() to access state visible to all users on the same browser tab.
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
 * import { sessionState } from '@apache-superset/core/storage';
 *
 * // User-scoped state (default - private to current user, cleared on tab close)
 * const wizardStep = await sessionState.get('wizard_step');
 * await sessionState.set('wizard_step', 3);
 * await sessionState.remove('wizard_step');
 *
 * // Shared state (visible to all users on same tab)
 * const tempData = await sessionState.shared().get('temp_data');
 * await sessionState.shared().set('temp_data', { draft: true });
 * ```
 */

/**
 * Interface for scoped session state access.
 * Returned by `shared()` for shared operations.
 */
export interface SessionStateAccessor {
  /**
   * Get a value from scoped session state.
   *
   * @param key The key to retrieve.
   * @returns The stored value, or null if not found.
   */
  get(key: string): Promise<unknown>;

  /**
   * Set a value in scoped session state.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Remove a value from scoped session state.
   *
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}

/**
 * Get a value from user-scoped session state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users on the same browser tab cannot see or modify this data.
 * Data is cleared when the tab/window is closed.
 *
 * @param key The key to retrieve.
 * @returns The stored value, or null if not found.
 *
 * @example
 * ```typescript
 * const wizardStep = await sessionState.get('wizard_step');
 * if (wizardStep !== null) {
 *   resumeWizard(wizardStep);
 * }
 * ```
 */
export declare function get(key: string): Promise<unknown>;

/**
 * Set a value in user-scoped session state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users on the same browser tab cannot see or modify this data.
 * Data is cleared when the tab/window is closed.
 *
 * @param key The key to store.
 * @param value The value to store (must be JSON-serializable).
 *
 * @example
 * ```typescript
 * await sessionState.set('wizard_step', 3);
 * await sessionState.set('unsaved_form', formData);
 * ```
 */
export declare function set(key: string, value: unknown): Promise<void>;

/**
 * Remove a value from user-scoped session state.
 *
 * @param key The key to remove.
 *
 * @example
 * ```typescript
 * await sessionState.remove('wizard_step');
 * ```
 */
export declare function remove(key: string): Promise<void>;

/**
 * Get a shared session state accessor.
 *
 * Returns an accessor for state that is shared across all users on the
 * same browser tab. Data is cleared when the tab/window is closed.
 *
 * WARNING: Data stored via shared() is visible to all users on this tab.
 * Do not store user-specific or sensitive data here.
 *
 * @returns An accessor for shared session state.
 *
 * @example
 * ```typescript
 * // Store temporary shared data
 * await sessionState.shared().set('temp_computation', result);
 *
 * // Retrieve temporary shared data
 * const result = await sessionState.shared().get('temp_computation');
 * ```
 */
export declare function shared(): SessionStateAccessor;
