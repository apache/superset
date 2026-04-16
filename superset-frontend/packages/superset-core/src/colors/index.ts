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

// Types & enums for color scheme configuration — usable by extensions and host alike
export type { ColorSchemeConfig, SequentialSchemeConfig } from './types';
export { ColorSchemeGroup } from './types';

/**
 * Minimal interface for the categorical color scheme registry.
 * Mirrors the public surface of @superset-ui/core's ColorSchemeRegistry.
 */
export interface CategoricalScheme {
  id: string;
  label?: string;
  colors: string[];
}

export interface CategoricalSchemeRegistryLike {
  keys(): string[];
  get(name: string): CategoricalScheme | null | undefined;
}

/**
 * Returns an alphabetically sorted list of all registered categorical color
 * scheme names. The host app (ExtensionsStartup) provides the implementation
 * via window.superset.colors.
 */
export declare function getCategoricalSchemeNames(): string[];

/**
 * Returns the color array for a named scheme, or null if not found.
 * The host app (ExtensionsStartup) provides the implementation
 * via window.superset.colors.
 */
export declare function getSchemeColors(schemeName: string): string[] | null;
