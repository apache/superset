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
 * Grouping/tier for a color scheme — controls how it appears in the
 * scheme picker UI (e.g. Featured palettes are shown first).
 *
 * Mirrors @superset-ui/core's ColorSchemeGroup; kept here so
 * palette configs have no dependency on @superset-ui/core.
 */
export enum ColorSchemeGroup {
  Custom = 'custom',
  Featured = 'featured',
  Other = 'other',
}

/** Plain configuration object for a categorical color scheme. */
export interface CategoricalScheme {
  id: string;
  label?: string;
  colors: string[];
  description?: string;
  isDefault?: boolean;
  group?: ColorSchemeGroup;
}

/**
 * A sequential / diverging color scheme. The only difference from a
 * categorical scheme is the optional `isDiverging` flag.
 */
export interface SequentialScheme extends CategoricalScheme {
  isDiverging?: boolean;
}

/**
 * Minimal interface for the categorical color scheme registry.
 * Mirrors the public surface of @superset-ui/core's ColorSchemeRegistry.
 */
export interface CategoricalSchemeRegistryLike {
  keys(): string[];
  get(name: string): CategoricalScheme | null | undefined;
}

/**
 * Returns an alphabetically sorted list of all registered categorical color
 * scheme names. The host app provides the implementation via
 * window.superset.theme.
 */
export declare function getCategoricalSchemeNames(): string[];

/**
 * Returns the full list of registered categorical color schemes (id, colors,
 * and any other available metadata), sorted alphabetically by id. Prefer
 * this over `getCategoricalSchemeNames` when scheme metadata (label,
 * description, etc.) is needed, since extracting just the names would
 * require a second round-trip through `getSchemeColors` per scheme.
 * The host app provides the implementation via window.superset.theme.
 */
export declare function getCategoricalSchemes(): CategoricalScheme[];

/**
 * Returns the color array for a named scheme, or null if not found.
 * The host app provides the implementation via window.superset.theme.
 */
export declare function getSchemeColors(schemeName: string): string[] | null;
