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
  /**
   * The path, relative to the application root, as in
   * `/extensions/pages/acme.tools.queue/42`.
   *
   * The deployment's root prefix is not included: on a Superset served from
   * `/analytics`, that same page reports exactly the path above, not
   * `/analytics/extensions/pages/...`. So a page can strip its own root and
   * read the remainder without knowing where the deployment is mounted. Use
   * {@link getApplicationRoot} where a full URL is needed, as when calling
   * the API.
   */
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

/**
 * The prefix this Superset is served under, or `''` when it is at the root
 * of its domain.
 *
 * Never a trailing slash, so a path is formed by appending one:
 *
 * ```typescript
 * const url = `${navigation.getApplicationRoot()}/api/v1/chart/`;
 * ```
 *
 * Paths handed to {@link navigateTo} do not need it -- the host's router
 * applies the root itself -- and {@link getLocation} has already removed it.
 * It is needed for a request made with `fetch`, which goes to the browser
 * rather than through the router, and would miss the prefix without it.
 */
export declare function getApplicationRoot(): string;

/**
 * A path within this Superset, carrying the deployment's application root.
 *
 * An extension forms `href`s to host screens, and a bare path resolves
 * against the wrong place wherever Superset is served under a subdirectory,
 * or inside a host application's iframe. The root is deployment
 * configuration the extension has no way to read, so the host answers.
 *
 * For `href`s, not for router pushes: a router already carries the root as
 * its basename, and prefixing there would apply it twice. An absolute or
 * protocol-relative URL is returned untouched, and a path already under the
 * root is not rooted again.
 *
 * {@link getApplicationRoot} reports the prefix on its own, which is what a
 * caller concatenating its own path wants. This takes the path instead and
 * returns it rooted.
 *
 * @example
 * navigation.appRoot('/explore/?slice_id=42')
 * // '/explore/?slice_id=42', or '/analytics/explore/?slice_id=42'
 * // where APPLICATION_ROOT is '/analytics'
 */
export declare function appRoot(path: string): string;
