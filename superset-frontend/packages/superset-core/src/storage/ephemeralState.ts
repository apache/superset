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

import type { JsonValue, StorageAccessor } from './types';

/**
 * @fileoverview Ephemeral State API for Superset extensions (Tier 2 Storage).
 *
 * Provides short-lived KV storage backed by the configured server-side cache
 * backend (Redis, Memcached, or filesystem). Automatically expires based on TTL.
 * Not guaranteed to survive server restarts.
 *
 * By default, all operations are user-scoped (private to the current user).
 * Use `shared` to access state that is visible to all users.
 *
 * Cache keys are namespaced automatically:
 * - User-scoped (default): superset-ext:{extension_id}:user:{user_id}:{key}
 * - Shared (global): superset-ext:{extension_id}:{key}
 *
 * @example
 * ```typescript
 * import { ephemeralState } from '@apache-superset/core/storage';
 *
 * // User-scoped state (default - private to current user)
 * const progress = await ephemeralState.get('job_progress');
 * await ephemeralState.set('job_progress', { pct: 42 }, { ttl: 3600 });
 * await ephemeralState.remove('job_progress');
 *
 * // Shared state (explicit opt-in - visible to all users)
 * const result = await ephemeralState.shared.get('shared_result');
 * await ephemeralState.shared.set('shared_result', { data: [1, 2, 3] });
 * await ephemeralState.shared.remove('shared_result');
 * ```
 */

/**
 * Default TTL in seconds (1 hour).
 */
export const DEFAULT_TTL = 3600;

/**
 * Options for setting ephemeral state values.
 */
export interface SetOptions {
  /**
   * Time-to-live in seconds. Defaults to 3600 (1 hour).
   */
  ttl?: number;
}

/**
 * Interface for scoped ephemeral state access.
 * Extends StorageAccessor with TTL-specific options for set().
 */
export interface EphemeralStateAccessor extends StorageAccessor {
  /**
   * Set a value in scoped ephemeral state with TTL.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   * @param options Optional settings including TTL.
   */
  set(key: string, value: JsonValue, options?: SetOptions): Promise<void>;
}

/**
 * Get a value from user-scoped ephemeral state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users cannot see or modify this data.
 *
 * @param key The key to retrieve.
 * @returns The stored value, or null if not found or expired.
 *
 * @example
 * ```typescript
 * const progress = await ephemeralState.get('job_progress');
 * if (progress !== null) {
 *   updateProgressBar(progress.pct);
 * }
 * ```
 */
export declare function get(key: string): Promise<JsonValue | null>;

/**
 * Set a value in user-scoped ephemeral state with TTL.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users cannot see or modify this data.
 *
 * @param key The key to store.
 * @param value The value to store (must be JSON-serializable).
 * @param options Optional settings including TTL (default: 3600 seconds).
 *
 * @example
 * ```typescript
 * // Store with default TTL (1 hour)
 * await ephemeralState.set('recent_items', ['item1', 'item2']);
 *
 * // Store with custom TTL (5 minutes)
 * await ephemeralState.set('temp_selection', data, { ttl: 300 });
 * ```
 */
export declare function set(
  key: string,
  value: JsonValue,
  options?: SetOptions,
): Promise<void>;

/**
 * Remove a value from user-scoped ephemeral state.
 *
 * @param key The key to remove.
 *
 * @example
 * ```typescript
 * await ephemeralState.remove('recent_items');
 * ```
 */
export declare function remove(key: string): Promise<void>;

/**
 * Shared (global) ephemeral state accessor.
 *
 * Accessor for state that is shared across all users.
 * Use this for data that needs to be visible to everyone, such as
 * job progress indicators or shared computation results.
 *
 * WARNING: Data stored via shared is visible to all users of the extension.
 * Do not store user-specific or sensitive data here.
 *
 * @example
 * ```typescript
 * // Get shared job progress
 * const progress = await ephemeralState.shared.get('computation_progress');
 *
 * // Update shared job progress
 * await ephemeralState.shared.set('computation_progress', { pct: 75 });
 *
 * // Clear shared state
 * await ephemeralState.shared.remove('computation_progress');
 * ```
 */
export declare const shared: EphemeralStateAccessor;
