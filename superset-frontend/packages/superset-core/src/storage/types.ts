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
  get(key: string): Promise<unknown>;

  /**
   * Set a value in storage.
   *
   * @param key The key to store.
   * @param value The value to store (must be JSON-serializable).
   * @param options Optional settings (varies by tier).
   */
  set(
    key: string,
    value: unknown,
    options?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Remove a value from storage.
   *
   * @param key The key to remove.
   */
  remove(key: string): Promise<void>;
}

/**
 * Base interface for a storage tier.
 * All storage tiers implement this interface with user-scoped default and shared() accessor.
 */
export interface StorageTier extends StorageAccessor {
  /**
   * Get a shared storage accessor.
   * Data stored via shared() is visible to all users.
   *
   * @returns An accessor for shared storage.
   */
  shared(): StorageAccessor;
}
