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

// Types & enums — single source of truth for ColorSchemeGroup and config shapes
export type { ColorSchemeConfig, SequentialSchemeConfig } from './types';
export { ColorSchemeGroup } from './types';

// Categorical palette configs — raw data with no class dependencies
export {
  categoricalAirbnb,
  categoricalBlueToGreen,
  categoricalColorsOfRainbow,
  categoricalD3,
  categoricalEcharts,
  categoricalGoogle,
  categoricalLyft,
  categoricalModernSunset,
  categoricalPreset,
  categoricalPresetAndSuperset,
  categoricalRedToYellow,
  categoricalSuperset,
  categoricalWavesOfBlue,
  allCategoricalColorSchemeConfigs,
  DEFAULT_CATEGORICAL_SCHEME,
} from './categorical';

// Sequential / diverging palette configs
export {
  sequentialCommon,
  sequentialD3,
  allSequentialColorSchemeConfigs,
  DEFAULT_SEQUENTIAL_SCHEME,
} from './sequential';

// ─── Registry bridge for extensions ──────────────────────────────────────────
//
// The host app (ExtensionsStartup) calls `registerCategoricalSchemeRegistry()`
// to inject @superset-ui/core's live singleton.  Extensions then call
// `getCategoricalSchemeNames()` / `getSchemeColors()` and receive the same
// palettes that the host app registered (including any custom extra schemes).

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

let _registry: CategoricalSchemeRegistryLike | null = null;

/**
 * Called by the Superset host app (ExtensionsStartup) to inject the
 * categorical color scheme registry so extensions can access it without
 * depending directly on @superset-ui/core.
 */
export function registerCategoricalSchemeRegistry(
  registry: CategoricalSchemeRegistryLike,
): void {
  _registry = registry;
}

/**
 * Returns the categorical color scheme registry registered by the host app,
 * or null if not yet injected (e.g. in tests or isolated builds).
 */
export function getCategoricalSchemeRegistry(): CategoricalSchemeRegistryLike | null {
  return _registry;
}

/**
 * Returns an alphabetically sorted list of all registered scheme names.
 */
export function getCategoricalSchemeNames(): string[] {
  return _registry?.keys().sort() ?? [];
}

/**
 * Returns the color array for a named scheme, or null if not found.
 */
export function getSchemeColors(schemeName: string): string[] | null {
  return _registry?.get(schemeName)?.colors ?? null;
}
