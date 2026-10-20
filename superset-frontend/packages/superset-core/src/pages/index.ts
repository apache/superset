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
 * boundary.
 *
 * It cannot use the host's router or store. `react-router-dom` and
 * `react-redux` are not in the Module Federation share scope, so an
 * extension importing either gets a second module instance with its own
 * React context, and `useLocation()` throws at runtime. A page is therefore
 * a single screen today: there is no supported way to navigate within it or
 * to read a sub-path, even though the host serves every path beneath the
 * page and resolves it back to this component. Keep sub-screen state in the
 * component until the host offers a navigation primitive.
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

/**
 * The path beneath this page's own root, always beginning with `/`.
 *
 * The host serves every path under a page and resolves it back to the same
 * component, so a page can own a sub-path the way a host screen owns one --
 * `/queue/42` and `/queue/42/edit` both reach the `queue` page, and this
 * reports `/42` and `/42/edit`. On the page's own root it reports `/`.
 *
 * This exists because `react-router-dom` is not shared: an extension that
 * imported it would get a second module instance with its own React context
 * and `useLocation()` would throw. This reads the host's router instead.
 *
 * @example
 * ```typescript
 * const subPath = pages.useSubPath();          // '/42'
 * const id = subPath.split('/')[1];
 * ```
 */
export declare function useSubPath(): string;

/**
 * Returns a function that navigates within this page.
 *
 * The argument is relative to the page's own root, so a page never writes
 * its own URL and cannot navigate out of its namespace by accident. It is a
 * client-side transition through the host's router, so the back button, the
 * host's scroll restoration and its navigation logging all behave as they do
 * on a host screen.
 *
 * @example
 * ```typescript
 * const navigate = pages.useNavigate();
 * navigate(`/${row.id}`);   // -> /extensions/<publisher>.<name>/queue/42
 * navigate('/');            // back to the page root
 * ```
 */
export declare function useNavigate(): (subPath: string) => void;

/** Event fired when a page is registered. */
export declare const onDidRegisterPage: Event<ResolvedPage>;

/** Event fired when a page is unregistered. */
export declare const onDidUnregisterPage: Event<ResolvedPage>;
