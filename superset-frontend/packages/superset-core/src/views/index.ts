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
 * @fileoverview Views registration API for Superset extensions.
 *
 * This module provides functions for registering custom React views
 * at specific locations in the Superset UI. Views are registered as
 * module-level side effects at import time.
 *
 * @example
 * ```typescript
 * import { views } from '@apache-superset/core';
 *
 * views.registerView(
 *   { id: 'my_ext.result_stats', name: 'Result Stats', location: 'sqllab.panels' },
 *   ResultStatsPanel,
 * );
 * ```
 */

import { ComponentType } from 'react';
import { Disposable, Event } from '../common';

/**
 * Represents a contributed view in the application.
 */
export interface View {
  /** The unique identifier for the view. */
  id: string;
  /** The display name of the view. */
  name: string;
  /** Optional description of the view, for display in contribution manifests. */
  description?: string;
}

/**
 * Registers a custom view at a specific UI location.
 *
 * The view provider function is called when the UI renders the location,
 * and should return a React element to display.
 *
 * @param view The view descriptor (id and name).
 * @param location The location where this view should appear (e.g. "sqllab.panels").
 * @param component The React component to render at that location.
 * @returns A Disposable that unregisters the view when disposed.
 *
 * @example
 * ```typescript
 * views.registerView(
 *   { id: 'my_ext.result_stats', name: 'Result Stats' },
 *   'sqllab.panels',
 *   ResultStatsPanel,
 * );
 * ```
 */
export declare function registerView(
  view: View,
  location: string,
  component: ComponentType,
): Disposable;

/**
 * Retrieves all views registered at a specific location.
 *
 * @param location The location to retrieve registered views for (e.g. "sqllab.panels").
 * @returns An array of View objects, or undefined if none are registered.
 *
 * @example
 * ```typescript
 * const panelViews = views.getViews('sqllab.panels');
 * ```
 */
export declare function getViews(location: string): View[] | undefined;

/**
 * A top-level page contributed by an extension.
 *
 * A page is mounted by the host as a client-side route, so it owns the whole
 * content area rather than occupying a slot inside an existing surface. This
 * is what an extension needs in order to add a screen of its own - a settings
 * page, a queue, a report - instead of only decorating screens the host
 * already ships.
 */
export interface Page extends View {
  /**
   * The client-side route the page is mounted at, as an absolute path
   * beginning with `/` (for example `"/change-review/"`).
   *
   * The host matches this with the same prefix semantics as its own routes, so
   * `"/my-ext/"` also serves `"/my-ext/42/"`; read the remainder with the
   * router hooks in the usual way. Paths are namespaced only by convention -
   * prefix yours with something specific to the extension so it does not
   * collide with a host route or with another extension's page.
   */
  path: string;
}

/**
 * Registers a top-level page, mounted by the host as a client-side route.
 *
 * The component is rendered inside the host's own route machinery: it sits
 * under the application chrome, within an error boundary and a Suspense
 * fallback, and it can use the router and store hooks exactly as a host page
 * does.
 *
 * Registering a page whose `path` collides with a host route has no effect on
 * that route - the host's own routes are matched first, and the page is
 * unreachable. The host logs a warning when it detects this.
 *
 * @param page The page descriptor (id, name and route path).
 * @param component The React component to render at that route.
 * @returns A Disposable that unmounts the route when disposed.
 *
 * @example
 * ```typescript
 * views.registerPage(
 *   { id: 'my_ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
 *   ReviewQueuePage,
 * );
 * ```
 */
export declare function registerPage(
  page: Page,
  component: ComponentType,
): Disposable;

/**
 * Retrieves every registered page, in registration order.
 *
 * @returns An array of Page objects, empty when no extension contributes one.
 *
 * @example
 * ```typescript
 * const paths = views.getPages().map(page => page.path);
 * ```
 */
export declare function getPages(): Page[];

/**
 * Event fired when a view is registered.
 */
export interface ViewRegisteredEvent {
  /** The descriptor of the view that was registered. */
  view: View;
  /** The location where the view was registered. */
  location: string;
}

/**
 * Event fired when a view is unregistered.
 */
export interface ViewUnregisteredEvent {
  /** The descriptor of the view that was unregistered. */
  view: View;
  /** The location where the view was registered. */
  location: string;
}

/**
 * Event fired when a view is registered.
 */
export declare const onDidRegisterView: Event<ViewRegisteredEvent>;

/**
 * Event fired when a view is unregistered.
 */
export declare const onDidUnregisterView: Event<ViewUnregisteredEvent>;
