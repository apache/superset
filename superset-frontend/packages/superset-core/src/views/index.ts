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
 * `location` may be one of the host's built-in locations (e.g.
 * "sqllab.panels") or the id of a view container registered via
 * {@link registerViewContainer} — e.g. a rail-style sidebar registers a
 * container for its icon slot, and views target that container's id as
 * their location. Registration is rejected — with a console warning and an
 * inert Disposable — when `location` names neither.
 *
 * @param view The view descriptor (id and name).
 * @param location The location where this view should appear: a built-in
 *   location (e.g. "sqllab.panels") or a registered view container's id.
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
 * Represents a view container — a slot (e.g. an icon in a rail-style
 * sidebar) that hosts views registered into it via {@link registerView}
 * using the container's `id` as their `location`. A container has no
 * content of its own; it only supplies the trigger (`icon`) and metadata
 * that the host renders for the slot.
 */
export interface ViewContainer {
  /**
   * The unique identifier for the container. Namespace it with your
   * extension name (e.g. `acme.lineage`) — registration is rejected if the
   * id is already taken, or if it collides with one of the host's built-in
   * location names.
   */
  id: string;
  /** The display name of the container, e.g. the trigger's tooltip. */
  name: string;
  /**
   * The trigger component rendered for this container's slot (e.g. an icon
   * in a rail's icon strip). It receives no props and should render a
   * small, presentational element — the host owns click handling and
   * selection.
   */
  icon: ComponentType;
  /** Optional description of the container, for display in contribution manifests. */
  description?: string;
  /**
   * Optional sort weight, ascending — lower values sort earlier among
   * sibling containers at the same location. Containers without an
   * explicit order sort after those that specify one; ties are broken by
   * `id`, so the order is identical regardless of registration order.
   */
  order?: number;
}

/**
 * Registers a view container at a specific UI location — e.g. a slot in a
 * rail-style sidebar's icon strip. Once registered, its `id` becomes a
 * valid `location` for {@link registerView} calls that contribute content
 * into it.
 *
 * Registration is rejected — with a console warning and an inert
 * Disposable — if a container with the same `id` is already registered, or
 * if `id` collides with one of the host's built-in location names. The
 * first registration wins.
 *
 * @param location The location where this container should appear (e.g. "sqllab.leftSidebar").
 * @param container The container descriptor (id, name, icon, optional order).
 * @returns A Disposable that unregisters the container when disposed.
 *
 * @example
 * ```typescript
 * const registration = views.registerViewContainer('sqllab.leftSidebar', {
 *   id: 'acme.lineage',
 *   name: 'Lineage',
 *   icon: AcmeLineageIcon,
 *   order: 50,
 * });
 * ```
 */
export declare function registerViewContainer(
  location: string,
  container: ViewContainer,
): Disposable;

/**
 * Retrieves all view containers registered at a specific location, in
 * render order (ascending `order`, then ascending `id`).
 *
 * @param location The location to retrieve registered containers for (e.g. "sqllab.leftSidebar").
 * @returns An array of ViewContainer objects.
 *
 * @example
 * ```typescript
 * const containers = views.getViewContainers('sqllab.leftSidebar');
 * ```
 */
export declare function getViewContainers(location: string): ViewContainer[];

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
