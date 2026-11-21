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
 * are the related SQL Lab browse pages, which are not the editor. `'home'` is
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
 * @example
 * navigation.appRoot('/explore/?slice_id=42')
 * // '/explore/?slice_id=42', or '/analytics/explore/?slice_id=42'
 * // where APPLICATION_ROOT is '/analytics'
 */
export declare function appRoot(path: string): string;
