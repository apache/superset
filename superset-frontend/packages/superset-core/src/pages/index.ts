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
 * to register a URL rule, so a cold load of the page resolves; the runtime
 * registration is what supplies the component to render there.
 *
 * The path is the extension author's to choose, but it is not theirs to take.
 * The server checks every declared path against the routes the deployment
 * actually serves, on every boot, and refuses a page whose path is already
 * answered by Superset, by an operator's blueprint, or by another extension.
 *
 * @example
 * ```typescript
 * // extension.json
 * // "contributions": { "pages": [{ "path": "/review-queue", "name": "Queue" }] }
 * import { pages } from '@apache-superset/core';
 *
 * pages.registerPage({ path: '/review-queue', name: 'Queue' }, ReviewQueue);
 * ```
 */

import { ComponentType } from 'react';
import { Disposable, Event } from '../common';

/**
 * A page contributed by an extension.
 */
export interface Page {
  /**
   * The absolute path the page is served at, such as `/review-queue`.
   *
   * Lowercase segments, leading slash, no trailing slash, no parameters: a
   * page owns a fixed prefix and routes within it on the client. The page
   * also owns everything beneath that prefix, so pick a path specific enough
   * that nothing else will want it.
   *
   * Must match a path declared in the extension's manifest. The host registers
   * rules from the manifest, so a component registered against an undeclared
   * path would mount on client navigation and 404 on a cold load; the host
   * rejects that registration rather than let the two disagree.
   */
  path: string;
  /** The display name of the page. */
  name: string;
  /** Optional description, for display in contribution manifests. */
  description?: string;
  /**
   * Opt the page into Superset's navigation bar.
   *
   * Without this a page is reachable only by its URL, which is rarely what
   * an extension wants: there is otherwise nowhere in Superset a user could
   * discover it. Omit it for a page reached from somewhere the extension
   * renders itself, such as a button on one of its own screens.
   */
  nav?: {
    /** Defaults to the page's `name`. */
    label?: string;
  };
}

/**
 * A page together with the extension that contributed it.
 */
export interface ResolvedPage extends Page {
  /** The extension that contributed the page, as `publisher.name`. */
  extensionId: string;
}

/**
 * Registers a page, mounted by the host as a client-side route.
 *
 * The component renders inside the host's own chrome, under an error
 * boundary.
 *
 * It cannot import the host's router or store directly: `react-router-dom`
 * and `react-redux` are not in the Module Federation share scope, so an
 * extension importing either gets a second module instance with its own
 * React context, and `useLocation()` throws at runtime. Use `useSubPath` and
 * `useNavigate` below, which read the host's router from inside the host
 * bundle, and `@superset-ui/core` -- which is shared -- for `SupersetClient`.
 *
 * Registering the same path twice within one extension replaces the first
 * registration and logs a warning. Across extensions it cannot happen: the
 * server refuses a duplicate path at boot, before either page loads.
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
 * `/review-queue/42` and `/review-queue/42/edit` both reach the page, and
 * this reports `/42` and `/42/edit`. On the page's own root it reports `/`.
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
 * navigate(`/${row.id}`);   // -> /review-queue/42
 * navigate('/');            // back to the page root
 * ```
 */
export declare function useNavigate(): (subPath: string) => void;

/** Event fired when a page is registered. */
export declare const onDidRegisterPage: Event<ResolvedPage>;

/** Event fired when a page is unregistered. */
export declare const onDidUnregisterPage: Event<ResolvedPage>;
