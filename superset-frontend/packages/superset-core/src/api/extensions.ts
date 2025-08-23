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
 */

import { Extension } from './core';

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
