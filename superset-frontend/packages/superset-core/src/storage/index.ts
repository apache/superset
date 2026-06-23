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
 * @fileoverview Shared types for extension storage APIs.
 *
 * These types are shared across all storage tiers (local, session, ephemeral,
 * persistent) to ensure a consistent API pattern.
 */

/**
 * JSON-compatible value type.
 * These are the only values that can be safely serialized/deserialized via JSON.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Base interface for a storage accessor.
 * All storage tiers implement this interface for both user-scoped and shared access.
 */
export interface StorageAccessor {
  /**
   * Get a value from storage.
   *
   * @param key The key to retrieve.
   * @returns The stored value, or null if not found.
   */
  get(key: string): Promise<JsonValue | null>;

  /**
   * Set a value in storage.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   */
  set(key: string, value: JsonValue): Promise<void>;

  /**
   * Remove a value from storage.
   *
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}

/**
 * Base interface for a storage tier.
 * All storage tiers implement this interface with user-scoped default and shared accessor.
 */
export interface StorageTier extends StorageAccessor {
  /**
   * Shared storage accessor.
   * Data stored via shared is visible to all users.
   */
  shared: StorageAccessor;
}

/**
 * Options required when setting ephemeral (server-cached) state.
 */
export interface EphemeralSetOptions {
  ttl: number;
}

/**
 * Options available when setting persistent (database-backed) state.
 */
export interface PersistentSetOptions {
  encrypt?: boolean;
}

/**
 * Storage accessor for ephemeral state, requiring TTL on every set.
 */
export interface EphemeralStorageAccessor {
  get(key: string): Promise<JsonValue | null>;
  set(
    key: string,
    value: JsonValue,
    options: EphemeralSetOptions,
  ): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Storage tier for ephemeral state with TTL-required set operations.
 */
export interface EphemeralStorageTier extends EphemeralStorageAccessor {
  shared: EphemeralStorageAccessor;
}

/**
 * Storage accessor for persistent state, supporting optional encryption.
 */
export interface PersistentStorageAccessor {
  get(key: string): Promise<JsonValue | null>;
  set(
    key: string,
    value: JsonValue,
    options?: PersistentSetOptions,
  ): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Storage tier for persistent (database-backed) state.
 */
export interface PersistentStorageTier extends PersistentStorageAccessor {
  shared: PersistentStorageAccessor;
}

/**
 * Extension-scoped storage accessor for all available tiers.
 *
 * All storage tiers are automatically namespaced to the current extension,
 * preventing key collisions between extensions.
 */
export interface ExtensionStorage {
  /**
   * Browser localStorage - persists across browser sessions.
   * Data is scoped to the current extension and user.
   */
  local: StorageTier;

  /**
   * Browser sessionStorage - cleared when the tab closes.
   * Data is scoped to the current extension and user.
   */
  session: StorageTier;

  /**
   * Server-side cache (Redis/Memcached) with TTL.
   * Data is scoped to the current extension and user.
   * Use `.shared` for data visible to all users.
   */
  ephemeral: EphemeralStorageTier;

  /**
   * Durable database-backed storage (Tier 3).
   * Data survives server restarts and cache evictions.
   * Use `.shared` for data visible to all users.
   */
  persistent: PersistentStorageTier;
}
