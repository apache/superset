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
 * @fileoverview Pages API for Superset extensions.
 *
 * A page is a screen of the extension's own, at its own URL, as opposed to a
 * view that occupies a slot inside a screen the host already ships.
 *
 * An extension names a page by a bare `slug`; the host derives the URL from
 * the extension's identity, exactly as it does for an extension's REST APIs.
 * An extension cannot choose, prefix or spoof its own URL space.
 *
 * @example
 * ```typescript
 * import { pages } from '@apache-superset/core';
 *
 * pages.registerPage({ slug: 'queue', name: 'Review queue' }, ReviewQueue);
 * // served at /extensions/<publisher>.<name>/queue
 * ```
 */

import { ComponentType } from 'react';
import { Disposable, Event } from '../common';

/**
 * A page contributed by an extension.
 */
export interface Page {
  /**
   * Names the page within its extension. Lowercase letters, digits and
   * hyphens.
   *
   * This is a slug, not a path: the host prefixes it with the extension's own
   * namespace. A slug of `queue` becomes `/extensions/<publisher>.<name>/queue`.
   * Declaring a full path would let one extension claim another's URL, or the
   * host's.
   */
  slug: string;
  /** The display name of the page. */
  name: string;
  /** Optional description, for display in contribution manifests. */
  description?: string;
}

/**
 * A page together with the URL the host derived for it.
 */
export interface ResolvedPage extends Page {
  /** The extension that contributed the page, as `publisher.name`. */
  extensionId: string;
  /** The application-root-relative path the page is served at. */
  path: string;
}

/**
 * Registers a page, mounted by the host as a client-side route.
 *
 * The component renders inside the host's own chrome, under an error
 * boundary, and may use the router and store hooks as a host page does.
 *
 * Registering the same slug twice within one extension replaces the first
 * registration and logs a warning; slugs cannot collide across extensions,
 * because each extension's pages live under its own namespace.
 *
 * @param page The page descriptor.
 * @param component The React component to render at that route.
 * @returns A Disposable that unmounts the page when disposed.
 */
export declare function registerPage(
  page: Page,
  component: ComponentType,
): Disposable;

/**
 * Retrieves every registered page, in registration order.
 */
export declare function getPages(): ResolvedPage[];

/** Event fired when a page is registered. */
export declare const onDidRegisterPage: Event<ResolvedPage>;

/** Event fired when a page is unregistered. */
export declare const onDidUnregisterPage: Event<ResolvedPage>;
