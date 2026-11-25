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
 * Options a view can carry at registration.
 *
 * Both permission fields are given together or not at all: they name one
 * permission between them -- `can_<methodPermissionName>` on
 * `<classPermissionName>` -- and either alone matches nothing. `registerView`
 * throws rather than let half a permission look like a guard.
 *
 * The permission must be one that already exists. The usual choice is the one
 * the extension's own `@api` class defines through `class_permission_name` and
 * `method_permission_name`, so a page is guarded by the same permission as the
 * data behind it and the two cannot come apart. A host permission works too,
 * as `{ classPermissionName: 'Dashboard', methodPermissionName: 'read' }`.
 *
 * Naming one gates reachability and advertisement: the host leaves the page out
 * of the navigation and renders its "Not authorized" state instead of the page.
 * It is not a data boundary -- the page's own endpoints are, and they check the
 * same permission server-side. Omitting it leaves the page open to any
 * signed-in user, which is what every page did before this existed.
 */
export interface ViewOptions {
  /**
   * The resource the permission hangs off -- an `@api` class's
   * `class_permission_name`, or a host one such as `'Dashboard'`. Set
   * `class_permission_name` explicitly on your API class: it defaults to the
   * Python class name, so renaming the class would silently close the page.
   */
  classPermissionName?: string;
  /**
   * The action, as it appears in `method_permission_name` -- `'read'`,
   * `'write'`, or whatever the class declares. Without the `can_` prefix; the
   * host adds it.
   */
  methodPermissionName?: string;
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
 * @param options Registration options. Only a page -- a view at
 * `PAGE_LOCATION` -- reads them today, to name the permission that guards it.
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
export declare function registerView<Props = {}>(
  view: View,
  location: string,
  component: ComponentType<Props>,
  options?: ViewOptions,
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
 * The reserved location at which a view becomes a top-level page.
 *
 * A view registered here owns the whole content area rather than occupying a
 * slot inside an existing surface, and the host gives it a URL of its own at
 * `/extensions/pages/<id>`. That URL is the host's to form: an extension
 * names the page, not the path it is served from, so no page can land on a
 * route the host already serves or on another extension's.
 *
 * A page is an ordinary registration otherwise: it is reported by `getViews`
 * and `onDidRegisterView` like any other view, so the page itself and a menu
 * item pointing at it resolve the same registration.
 *
 * Pass `options` to name the permission that guards the page.
 *
 * @example
 * ```typescript
 * views.registerView(
 *   { id: 'acme.tools.review-queue', name: 'Review queue' },
 *   views.PAGE_LOCATION,
 *   ReviewQueuePage,
 * );
 * ```
 */
export declare const PAGE_LOCATION: string;

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
