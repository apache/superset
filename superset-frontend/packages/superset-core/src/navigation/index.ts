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
 * @fileoverview Navigation namespace for Superset extensions.
 *
 * Exposes the current application surface so extensions can react to route
 * changes without polling. Entity-level context (chart, dashboard, dataset)
 * is intentionally not included here — surface-specific namespaces that
 * resolve entity payloads are introduced in later phases.
 */

import { Event } from '../common';

/**
 * The set of top-level application surfaces.
 *
 * `'explore'`, `'dashboard'` and `'dataset'` are the single-entity
 * editing/viewing surfaces. `'chart_list'`, `'dashboard_list'` and
 * `'dataset_list'` are the browse/list surfaces, distinct from those because no
 * single entity is active. `'sqllab'` is the SQL editor where
 * `sqlLab.getCurrentTab()` resolves; `'query_history'` and `'saved_queries'`
 * are the related SQL Lab browse pages, which are not the editor.
 * `'extension'` is an extension-owned page under `/extensions/pages/`. `'home'` is
 * the welcome surface and the fallback for any route not explicitly enumerated.
 */
export type Page =
  | 'dashboard'
  | 'dashboard_list'
  | 'explore'
  | 'chart_list'
  | 'sqllab'
  | 'query_history'
  | 'saved_queries'
  | 'dataset'
  | 'dataset_list'
  | 'extension'
  | 'home';

/**
 * Returns the current page surface.
 *
 * @example
 * ```typescript
 * const page = navigation.getPage();
 * if (page === 'dashboard') {
 *   // react to being on a dashboard surface
 * }
 * ```
 */
export declare function getPage(): Page;

/**
 * Event fired whenever the user navigates to a different surface.
 *
 * @example
 * ```typescript
 * const sub = navigation.onDidChangePage(page => {
 *   if (page === 'dashboard') {
 *     // react to navigating onto a dashboard surface
 *   }
 * });
 * // later:
 * sub.dispose();
 * ```
 */
export declare const onDidChangePage: Event<Page>;

/**
 * The current location, as router-relative path and query string.
 */
export interface Location {
  /** Path below the application root, e.g. `/extensions/pages/acme.catalog.main/42`. */
  pathname: string;
  /** Query string including the leading `?`, or `''`. */
  search: string;
}

/**
 * Navigates to a router-relative path (starting with `/`) without a full
 * page reload when the host can route it client-side, and with a regular
 * navigation otherwise.
 *
 * @throws If `path` is not a router-relative path.
 *
 * To open an extension page by id, the built-in `core.navigation.openPage`
 * command does the same: `commands.executeCommand('core.navigation.openPage', 'acme.catalog.main')`.
 *
 * @example
 * ```typescript
 * navigation.navigateTo('/extensions/pages/acme.catalog.main/42/edit');
 * ```
 */
export declare function navigateTo(path: string): void;

/**
 * Returns the current location. An extension page reads its own sub-path
 * (everything below `/extensions/pages/<id>/`) and query params from here.
 */
export declare function getLocation(): Location;

/**
 * Event fired whenever the path or query string changes, including
 * navigation within the same page.
 *
 * @example
 * ```typescript
 * const sub = navigation.onDidChangeLocation(({ pathname, search }) => {
 *   // re-render for the new sub-path / query params
 * });
 * ```
 */
export declare const onDidChangeLocation: Event<Location>;
