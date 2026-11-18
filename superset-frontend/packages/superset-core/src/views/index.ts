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
 * Optional settings for a registered view.
 */
export interface ViewOptions {
  /**
   * FAB view menu of the permission gating this view, e.g. the
   * `class_permission_name` of the extension's own `@api` class, or a host
   * one such as `'Dashboard'`. Set together with `methodPermissionName`.
   */
  classPermissionName?: string;
  /**
   * FAB action of the permission gating this view, e.g. `'read'`; checked
   * as `can_<name>` on `classPermissionName`. Set together with
   * `classPermissionName`.
   */
  methodPermissionName?: string;
}

/**
 * Host view locations outside SQL Lab.
 */
export declare const Locations: {
  /**
   * Full-page views. A view registered here is URL-addressable at
   * `/extensions/pages/<id>` (and any sub-path below it), and its id must
   * start with the registering extension's id (e.g. `acme.tools.` for
   * `acme.tools`).
   */
  readonly page: 'global.page';
};

/**
 * Registers a custom view at a specific UI location.
 *
 * The view provider function is called when the UI renders the location,
 * and should return a React element to display.
 *
 * @param view The view descriptor (id and name).
 * @param location The location where this view should appear (e.g. "sqllab.panels").
 * @param component The React component to render at that location.
 * @param options Optional settings, e.g. a permission gating a `global.page` view.
 *   The host hides the page's menu entries from users without it and shows a
 *   not-authorized state on the page; the data behind the page stays protected
 *   by the extension's own `@protect()`ed endpoints.
 * @returns A Disposable that unregisters the view when disposed.
 * @throws If a view with the same id is already registered, if only one of
 *   the two permission fields is set, or if a `global.page` id doesn't start
 *   with the registering extension's id.
 *
 * @example
 * ```typescript
 * views.registerView(
 *   { id: 'my_ext.result_stats', name: 'Result Stats' },
 *   'sqllab.panels',
 *   ResultStatsPanel,
 * );
 *
 * // A full page, only for users who can review in the extension's own API:
 * views.registerView(
 *   { id: 'acme.tools.approvals', name: 'Approvals' },
 *   views.Locations.page,
 *   Approvals,
 *   { classPermissionName: 'AcmeApprovalsApi', methodPermissionName: 'review' },
 * );
 * ```
 */
export declare function registerView(
  view: View,
  location: string,
  component: ComponentType,
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
