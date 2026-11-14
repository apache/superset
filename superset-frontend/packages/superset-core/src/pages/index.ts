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
 * A page is declared in the extension's manifest and registered at runtime.
 * Both halves are needed: the manifest declaration is what the server reads
 * to decide who may open the page, so a cold load of its URL resolves; the
 * runtime registration is what supplies the component to render there.
 *
 * A page names itself and the host decides where it lives. The id is the
 * author's to choose -- within their own extension's namespace -- and the
 * host serves the page at `/extensions/pages/<id>`, which is why a page can
 * no longer land on a route Superset, an operator's blueprint, or another
 * extension already answers.
 *
 * The component is registered as a view at the page's reserved location,
 * `views.PAGE_LOCATION`, under the id the manifest declares.
 *
 * @example
 * ```typescript
 * // extension.json
 * // "contributions": {
 * //   "pages": [{ "id": "acme.tools.review-queue", "name": "Queue" }]
 * // }
 * import { views } from '@apache-superset/core';
 *
 * views.registerView(
 *   { id: 'acme.tools.review-queue', name: 'Queue' },
 *   views.PAGE_LOCATION,
 *   ReviewQueue,
 * );
 * ```
 */

import { Event } from '../common';

/**
 * A page contributed by an extension.
 */
export interface Page {
  /**
   * The id of the view this page renders, as registered at
   * `views.PAGE_LOCATION`. It must begin with the extension's own id, so one
   * extension cannot claim or overwrite another's page.
   *
   * The host serves the page at `/extensions/pages/<id>`. An extension names
   * its page; it does not choose where the page is served from, which is what
   * keeps a page from landing on a route the host already answers.
   */
  id: string;
  /** The display name of the page. */
  name: string;
  /** Optional description, for display in contribution manifests. */
  description?: string;
  /**
   * Permission a user must hold to open the page.
   *
   * Declared in the manifest; the host creates it against the extension when
   * the extension loads, so an administrator can grant it in the Roles
   * screen as, for example, `can_review on extension:acme.tools` -- the
   * host names the view menu after the extension, with that prefix. The
   * server refuses the page with 403 to anyone without it.
   *
   * Omit to require only that the user is signed in, which is how every page
   * behaves without this field. A page that declares a `featureFlag` is
   * additionally hidden whenever that flag is off, whatever this field says.
   */
  permission?: string;
  /**
   * Feature flag the page follows, such as `CHANGE_MANAGEMENT`.
   *
   * Declared in the manifest. While the flag is off the page is left out of
   * the navigation and its URL answers 404; turning the flag on makes it
   * reachable again without a restart, because the flag is read per request
   * rather than when the route is registered.
   *
   * 404 rather than 403, and tested before `permission`: with the flag off
   * the feature is not running, so there is no page -- which is not a
   * question about who is asking, and an administrator holding every
   * permission there is must not see it either.
   *
   * The flag is the operator's, not the extension's: it is a key of the
   * deployment's `FEATURE_FLAGS`, and a name that config does not define
   * reads as off everywhere.
   *
   * Omit for a page that does not depend on a flag.
   */
  featureFlag?: string;
}

/**
 * A page together with the extension that contributed it.
 */
export interface ResolvedPage extends Page {
  /** The extension that contributed the page, as `publisher.name`. */
  extensionId: string;
  /**
   * Whether the signed-in user may open this page.
   *
   * False for two different reasons, which the host tells apart and callers
   * should too: the user does not hold the page's `permission`, or the
   * page's `featureFlag` is off. Read `featureFlag` to know which -- with
   * the flag off the feature is not running and the page's URL answers 404,
   * so a refusal is the wrong thing to show, including to an Admin.
   *
   * True for a page that declares neither. The host hides a
   * page the user may not open from the navigation bar and renders a refusal
   * in its place, and the server refuses it independently -- this is what
   * the host knows, not what enforces it.
   */
  permitted: boolean;
}

/**
 * The path beneath this page's own root, always beginning with `/`.
 *
 * The host serves every path under a page and resolves it back to the same
 * component, so a page can own a sub-path the way a host screen owns one.
 * For a page registered as `acme.tools.review-queue`, both
 * `/extensions/pages/acme.tools.review-queue/42` and `.../42/edit` reach the
 * page, and this reports `/42` and `/42/edit`. On the page's own root it
 * reports `/`.
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
 * The argument is relative to the page's own root, so a page never writes its
 * own URL. A target that resolves outside the page -- through `..` segments,
 * say -- is logged and ignored rather than followed. It is a client-side
 * transition through the host's router, so the back button, the host's scroll
 * restoration and its navigation logging all behave as they do on a host
 * screen.
 *
 * @example
 * ```typescript
 * const navigate = pages.useNavigate();
 * navigate(`/${row.id}`);   // -> /extensions/pages/acme.tools.review-queue/42
 * navigate('/');            // back to the page root
 * ```
 */
export declare function useNavigate(): (subPath: string) => void;

/**
 * The contributed page the user is on, or `undefined` on a host screen.
 *
 * Finer than `navigation.getPage()`, which names the surface: every
 * contributed page is `'extension'` there, so moving from one to another is
 * not a change in that value.
 *
 * @example
 * ```typescript
 * const page = pages.getCurrentPage();
 * if (page?.extensionId === 'acme.tools') {
 *   // the user is on one of this extension's pages
 * }
 * ```
 */
export declare function getCurrentPage(): ResolvedPage | undefined;

/**
 * Event fired when the user moves to or from a contributed page.
 *
 * Fires with `undefined` when the user leaves for a host screen, and with
 * the page when one arrives -- including when an extension registers a page
 * for the URL the user is already sitting on.
 *
 * @example
 * ```typescript
 * const sub = pages.onDidChangeCurrentPage(page => {
 *   if (page) {
 *     // the user opened `page`
 *   }
 * });
 * ```
 */
export declare const onDidChangeCurrentPage: Event<ResolvedPage | undefined>;

/** Event fired when a page is registered. */
export declare const onDidRegisterPage: Event<ResolvedPage>;

/** Event fired when a page is unregistered. */
export declare const onDidUnregisterPage: Event<ResolvedPage>;
