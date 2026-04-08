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
 * @fileoverview Extensions API for Superset extension management.
 *
 * This module provides functions and events for managing Superset extensions,
 * including querying extension metadata and monitoring extension lifecycle events.
 * Extensions can use this API to discover other extensions and react to changes
 * in the extension ecosystem.
 *
 * Extensions can access their own context via `getContext()`, which provides:
 * - Extension metadata (id, name, version, etc.)
 * - Extension-scoped storage (localStorage, sessionStorage, ephemeral cache)
 *
 * @example
 * ```typescript
 * import { extensions } from '@apache-superset/core';
 *
 * // Get the current extension's context
 * const ctx = extensions.getContext();
 *
 * // Access extension metadata
 * console.log(`Running ${ctx.extension.name} v${ctx.extension.version}`);
 *
 * // Access extension-scoped storage
 * await ctx.storage.local.set('preference', { theme: 'dark' });
 * await ctx.storage.ephemeral.set('cache', data, { ttl: 300 });
 * ```
 */

import { Extension } from '../common';
import { StorageTier } from '../storage/types';

/**
 * Extension-scoped storage accessor.
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
  ephemeral: StorageTier;
}

/**
 * Context object providing extension-specific resources.
 *
 * This context is only available during extension execution.
 * Calling `getContext()` outside of an extension will throw an error.
 */
export interface ExtensionContext {
  /**
   * Metadata about the current extension.
   */
  extension: Extension;

  /**
   * Extension-scoped storage across all tiers.
   * All keys are automatically namespaced to prevent collisions.
   */
  storage: ExtensionStorage;
}

/**
 * Get the current extension's context.
 *
 * This function returns the context for the currently executing extension,
 * providing access to extension metadata and scoped resources like storage.
 *
 * @returns The current extension's context.
 * @throws Error if called outside of an extension context.
 *
 * @example
 * ```typescript
 * import { extensions } from '@apache-superset/core';
 *
 * const ctx = extensions.getContext();
 *
 * // Access extension metadata
 * console.log(`Extension: ${ctx.extension.id}`);
 * console.log(`Version: ${ctx.extension.version}`);
 *
 * // Access extension-scoped storage
 * await ctx.storage.local.set('userPref', { sidebar: 'collapsed' });
 * const pref = await ctx.storage.local.get('userPref');
 *
 * // Use ephemeral storage with TTL
 * await ctx.storage.ephemeral.set('tempData', data, { ttl: 3600 });
 *
 * // Access shared (cross-user) storage
 * await ctx.storage.ephemeral.shared.set('globalCounter', count);
 * ```
 */
export declare function getContext(): ExtensionContext;

/**
 * Get an extension by its full identifier in the form of: `publisher.name`.
 * This function allows extensions to discover and interact with other extensions
 * in the Superset ecosystem.
 *
 * @param extensionId An extension identifier in the format "publisher.name".
 * @returns The extension object if found, or `undefined` if no extension matches the identifier.
 *
 * @example
 * ```typescript
 * const chartExtension = getExtension('superset.chart-plugins');
 * if (chartExtension) {
 *   console.log('Chart extension is available:', chartExtension.displayName);
 * } else {
 *   console.log('Chart extension not found');
 * }
 * ```
 */
export declare function getExtension(
  extensionId: string,
): Extension | undefined;

/**
 * Get all extensions currently known to the system.
 * This function returns a readonly array containing all extensions that are installed
 * and available, regardless of their activation status.
 *
 * @returns A readonly array of all extension objects in the system.
 *
 * @example
 * ```typescript
 * const extensions = getAllExtensions();
 * console.log(`Total extensions: ${extensions.length}`);
 * extensions.forEach(ext => {
 *   console.log(`- ${ext.id}: ${ext.name} (enabled: ${ext.enabled})`);
 * });
 * ```
 */
export declare function getAllExtensions(): readonly Extension[];
