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
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
  get<T = JsonValue>(key: string): Promise<T | null>;

  /**
   * Set a value in storage.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   */
  set<T = JsonValue>(key: string, value: T): Promise<void>;

  /**
   * Remove a value from storage.
   *
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}

/**
 * Options required when setting ephemeral (server-cached) state.
 */
export interface EphemeralSetOptions {
  ttl: number;
  /** Name of the codec used to encode the value, e.g. "json" (default). */
  codec?: string;
}

/**
 * Options available when setting persistent (database-backed) state.
 */
export interface PersistentSetOptions {
  encrypt?: boolean;
  /** Name of the codec used to encode the value, e.g. "json" (default). */
  codec?: string;
}

/**
 * Options for listing persistent (database-backed) state entries.
 *
 * `page` and `pageSize` are required (no default): `list` returns one page
 * of a caller's entries, not the whole result set, and a default would let
 * that fact go unnoticed at the call site. Check the returned
 * `PersistentListResult.count` against `pageSize` to know whether more
 * pages exist.
 *
 * `resourceType`/`resourceUuid` are optional filters; omitting them lists
 * every entry in the caller's scope (global or user-scoped, depending on
 * whether `list` is called via `.shared` or directly).
 */
export interface PersistentListOptions {
  /** Zero-indexed page number. */
  page: number;
  /**
   * Entries per page. There is no fixed ceiling on this value, but a page
   * whose combined value size exceeds MAX_LIST_PAYLOAD_SIZE from config is
   * rejected — reduce pageSize and retry if that happens.
   */
  pageSize: number;
  resourceType?: string;
  resourceUuid?: string;
}

/**
 * A single entry returned by a persistent state `list` call.
 */
export interface PersistentListEntry<T = JsonValue> {
  key: string;
  value: T | null;
  /** Name of the codec `value` was encoded with, e.g. "json" or "base64". */
  codec: string;
}

/**
 * Result of a persistent state `list` call.
 */
export interface PersistentListResult<T = JsonValue> {
  entries: PersistentListEntry<T>[];
  /**
   * Total number of entries matching the given scope/filters, across all
   * pages — not just the number returned in `entries`.
   */
  count: number;
}

/**
 * Storage accessor for ephemeral state, requiring TTL on every set.
 */
export interface EphemeralStorageAccessor {
  get<T = JsonValue>(key: string): Promise<T | null>;
  set<T = JsonValue>(
    key: string,
    value: T,
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
  get<T = JsonValue>(key: string): Promise<T | null>;
  set<T = JsonValue>(
    key: string,
    value: T,
    options?: PersistentSetOptions,
  ): Promise<void>;
  list<T = JsonValue>(
    options: PersistentListOptions,
  ): Promise<PersistentListResult<T>>;
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
   * Data is scoped to the current extension and user. There is no
   * `.shared` accessor for this tier: browser storage is per-device, so a
   * "shared" value would only be visible to other users of the same
   * browser, not to other users of the extension generally.
   */
  local: StorageAccessor;

  /**
   * Browser sessionStorage - cleared when the tab closes.
   * Data is scoped to the current extension and user. There is no
   * `.shared` accessor for this tier; see `local` above.
   */
  session: StorageAccessor;

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
