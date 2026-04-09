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
 * @fileoverview Persistent State API for Superset extensions (Tier 3 Storage).
 *
 * Provides durable KV storage backed by a dedicated database table.
 * Data survives server restarts, cache evictions, and browser clears.
 * Suitable for user preferences, saved state, and any data that must
 * not be lost.
 *
 * By default, all operations are user-scoped (private to the current user).
 * Use `shared` to access state that is visible to all users of the extension.
 *
 * Database keys are namespaced automatically:
 * - User-scoped (default): (extension_id, user_id, key)
 * - Shared (global): (extension_id, null, key)
 *
 * @example
 * ```typescript
 * import { persistentState } from '@apache-superset/core/storage';
 *
 * // User-scoped state (default - private to current user)
 * const prefs = await persistentState.get('preferences');
 * await persistentState.set('preferences', { theme: 'dark', locale: 'en' });
 * await persistentState.remove('preferences');
 *
 * // Shared state (explicit opt-in - visible to all users)
 * const config = await persistentState.shared.get('global_config');
 * await persistentState.shared.set('global_config', { version: 2 });
 * await persistentState.shared.remove('global_config');
 * ```
 */

/**
 * Get a value from user-scoped persistent state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users cannot see or modify this data.
 *
 * @param key The key to retrieve.
 * @returns The stored value, or null if not found.
 *
 * @example
 * ```typescript
 * const prefs = await persistentState.get('preferences');
 * if (prefs !== null) {
 *   applyPreferences(prefs);
 * }
 * ```
 */
export declare function get(key: string): Promise<JsonValue | null>;

/**
 * Set a value in user-scoped persistent state.
 *
 * Data is automatically scoped to the current authenticated user.
 * Other users cannot see or modify this data.
 * Data persists indefinitely until explicitly removed.
 *
 * @param key The key to store.
 * @param value The value to store (must be JSON-serializable).
 *
 * @example
 * ```typescript
 * await persistentState.set('preferences', { theme: 'dark', locale: 'en' });
 * ```
 */
export declare function set(key: string, value: JsonValue): Promise<void>;

/**
 * Remove a value from user-scoped persistent state.
 *
 * @param key The key to remove.
 *
 * @example
 * ```typescript
 * await persistentState.remove('preferences');
 * ```
 */
export declare function remove(key: string): Promise<void>;

/**
 * Shared (global) persistent state accessor.
 *
 * Accessor for state that is shared across all users of the extension.
 * Use this for extension-wide configuration, shared datasets, or any
 * data that should be accessible to all users regardless of identity.
 *
 * WARNING: Data stored via shared is visible to all users of the extension.
 * Do not store user-specific or sensitive data here.
 *
 * @example
 * ```typescript
 * // Read shared extension config
 * const config = await persistentState.shared.get('global_config');
 *
 * // Update shared config (typically admin-only)
 * await persistentState.shared.set('global_config', { version: 2 });
 *
 * // Remove shared config entry
 * await persistentState.shared.remove('global_config');
 * ```
 */
export declare const shared: StorageAccessor;
