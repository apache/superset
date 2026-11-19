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
 * `'extension'` is a page contributed by an extension, whichever one -- the
 * surface is identified, not the page, so it does not distinguish two
 * contributed pages from one another. `'home'` is the welcome surface and the
 * fallback for any route not explicitly enumerated.
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
 * Where the user is: the pathname, and the query string if there is one.
 */
export interface AppLocation {
  /** The path, rooted at the application, as in `/extensions/pages/acme.tools.queue/42`. */
  pathname: string;
  /** The query string including its `?`, or `''` when there is none. */
  search: string;
}

/**
 * The current location.
 *
 * This is how a page reads its own sub-path: everything after
 * `/extensions/pages/<its own id>` belongs to it. A plain function rather
 * than a hook, so a command handler or any code outside a component can ask.
 */
export declare function getLocation(): AppLocation;

/**
 * Fired whenever the location changes, including between two addresses
 * inside the same page.
 */
export declare const onDidChangeLocation: Event<AppLocation>;

/**
 * Moves the user to `path` as a client-side transition, without a reload.
 *
 * `react-router-dom` is not in the module federation share scope, so an
 * extension importing it gets a second router instance the host's own
 * `<Router>` never populates, and `history.push` on it fires no `popstate`.
 * This goes through the host's router instead.
 *
 * `path` is rooted at the application. A page navigating within itself passes
 * its own address and the sub-path below it.
 */
export declare function navigateTo(path: string): void;
