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
 * Exposes stable routing and page-surface context to extensions.
 * Extensions use this namespace to react to page changes without polling.
 */

import { Event } from '../common';

/**
 * The set of top-level application surfaces the chatbot is aware of.
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
 * Lightweight page descriptor: the current surface and the focused entity id,
 * if the surface has one (dashboard id, chart id, dataset id). Does not embed
 * full entity payloads — use the surface-specific namespace for those.
 */
export interface PageContext {
  pageType: PageType;
  /**
   * The numeric id of the primary entity on this page, if applicable.
   * `null` when the surface has no focused entity, or when the entity is
   * addressed by a non-numeric slug (e.g. dashboard accessed via slug URL).
   */
  entityId: number | null;
}

/**
 * Returns the current page surface type.
 *
 * @example
 * ```typescript
 * const pageType = navigation.getPageType();
 * if (pageType === 'dashboard') { ... }
 * ```
 */
export declare function getPageType(): PageType;

/**
 * Returns lightweight context about the current page: surface type and focused
 * entity id. Does not embed entity payloads; use the surface namespace for those.
 *
 * @example
 * ```typescript
 * const { pageType, entityId } = navigation.getCurrentPage();
 * ```
 */
export declare function getCurrentPage(): PageContext;

/**
 * Event fired whenever the user navigates to a different page or entity.
 * Provides the new `PageContext` as the event payload.
 *
 * @example
 * ```typescript
 * const sub = navigation.onDidChangePage(({ pageType, entityId }) => {
 *   chatbot.updateContext({ pageType, entityId });
 * });
 * // later:
 * sub.dispose();
 * ```
 */
export declare const onDidChangePage: Event<PageContext>;
