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
 * @fileoverview Navigation namespace for Superset extensions (P3).
 *
 * Exposes the current application surface so extensions can react to route
 * changes without polling. Entity-level context (chart, dashboard, dataset)
 * is intentionally not included here — use the surface-specific namespace
 * (`explore`, `dashboard`, `dataset`) to retrieve entity payloads.
 */

import { Event } from '../common';

/**
 * The set of top-level application surfaces.
 * `'other'` covers any route not explicitly enumerated.
 */
export type PageType =
  | 'dashboard'
  | 'explore'
  | 'sqllab'
  | 'dataset'
  | 'home'
  | 'other';

/**
 * Returns the current page surface type.
 *
 * @example
 * ```typescript
 * const pageType = navigation.getPageType();
 * if (pageType === 'dashboard') {
 *   const ctx = dashboard.getCurrentDashboard();
 * }
 * ```
 */
export declare function getPageType(): PageType;

/**
 * Event fired whenever the user navigates to a different surface.
 * Use the surface-specific namespace to read entity context after the event.
 *
 * @example
 * ```typescript
 * const sub = navigation.onDidChangePage(pageType => {
 *   if (pageType === 'dashboard') {
 *     const ctx = dashboard.getCurrentDashboard();
 *   }
 * });
 * // later:
 * sub.dispose();
 * ```
 */
export declare const onDidChangePage: Event<PageType>;
