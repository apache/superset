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
 * @fileoverview Dashboard component contribution API for Superset extensions.
 *
 * A dashboard component is a first-class dashboard layout element (like the
 * built-in Markdown or iframe) contributed by an extension. The extension
 * provides a single React component that renders the element's *content*; the
 * host owns the surrounding chrome (drag handle, resize, delete) so the
 * contributed component stays small and the contract stable.
 *
 * This replaces the legacy `DashboardComponentsRegistry` / `DYNAMIC_TYPE`
 * mechanism, which is deprecated.
 *
 * @example
 * ```typescript
 * import { dashboardComponents } from '@apache-superset/core';
 *
 * dashboardComponents.registerDashboardComponent(
 *   {
 *     id: 'acme.weather',
 *     name: 'Weather widget',
 *     icon: 'CloudOutlined',
 *     resizable: true,
 *     defaultMeta: { width: 4, height: 50 },
 *   },
 *   WeatherWidget,
 * );
 * ```
 */

import { ComponentType } from 'react';
import type { Disposable, Event } from '../common';

/**
 * Props passed by the host to a contributed dashboard component. The host
 * renders this component inside its own drag/resize/delete chrome, so the
 * component only needs to render content (and, in edit mode, its own editor
 * affordances). Persisted state lives in `meta`; mutate it via `updateMeta`.
 */
export interface DashboardComponentProps {
  /** The layout item id of this component instance. */
  id: string;
  /** The component instance's persisted meta (round-trips in the layout). */
  meta: Record<string, unknown>;
  /** Whether the dashboard is in edit mode. */
  editMode: boolean;
  /** Shallow-merge a patch into this component's persisted meta. */
  updateMeta: (patch: Record<string, unknown>) => void;
}

/**
 * Declarative descriptor for a contributed dashboard component. The behavior
 * fields replace what was historically hardcoded in the dashboard util maps
 * (resizability, default sizing, nesting, etc.).
 */
export interface DashboardComponentDefinition {
  /** Namespaced unique id, e.g. "acme.weather" or "superset.iframe". */
  id: string;
  /** Human-readable label shown in the builder palette. */
  name: string;
  /** Optional longer description. */
  description?: string;
  /** Icon id (a known Superset icon name) shown in the palette. */
  icon?: string;
  /** Whether instances can be resized. Defaults to true. */
  resizable?: boolean;
  /** Default `meta` seeded onto a newly created instance (e.g. width/height). */
  defaultMeta?: Record<string, unknown>;
  /**
   * Whether an instance counts as user content for "is this dashboard empty?"
   * detection. Defaults to true.
   */
  isUserContent?: boolean;
  /** Minimum width in grid columns. Defaults to 1. */
  minWidth?: number;
  /**
   * Restrict which container types may hold this component (e.g.
   * `['GRID', 'TAB']`). When omitted, the component is allowed wherever a
   * standard content leaf is allowed (grid, row, column, tab).
   */
  validParents?: string[];
  /**
   * Whether a drop into the grid or a tab auto-wraps the component in a row.
   * Defaults to true (matching built-in content components).
   */
  wrapInRow?: boolean;
}

/**
 * The subset of a definition's behavior that is seeded onto each instance's
 * `meta` at creation, so the dashboard layout engine can honor it (and so it
 * round-trips in the saved layout even if the extension later becomes
 * unavailable). Read by the dashboard util maps; not part of the rendered
 * component's concern.
 */
export interface DashboardComponentBehaviorMeta {
  extensionComponentId: string;
  resizable?: boolean;
  isUserContent?: boolean;
  minWidth?: number;
  validParents?: string[];
  wrapInRow?: boolean;
}

/**
 * A registered dashboard component: its definition plus the React component
 * the host renders.
 */
export interface RegisteredDashboardComponent {
  definition: DashboardComponentDefinition;
  Component: ComponentType<DashboardComponentProps>;
}

/**
 * Registers a dashboard component. Disposing the returned Disposable
 * unregisters it. Registering a second component with the same id replaces the
 * first.
 *
 * @param definition The component descriptor (id, name, behavior).
 * @param component The React component rendering the element's content.
 * @returns A Disposable that unregisters the component when disposed.
 */
export declare function registerDashboardComponent(
  definition: DashboardComponentDefinition,
  component: ComponentType<DashboardComponentProps>,
): Disposable;

/** Returns the registered component for `id`, or undefined. */
export declare function getDashboardComponent(
  id: string,
): RegisteredDashboardComponent | undefined;

/** Returns all registered dashboard components. */
export declare function getDashboardComponents(): RegisteredDashboardComponent[];

/** Event fired when a dashboard component is registered. */
export declare const onDidRegisterDashboardComponent: Event<DashboardComponentDefinition>;

/** Event fired when a dashboard component is unregistered. */
export declare const onDidUnregisterDashboardComponent: Event<DashboardComponentDefinition>;
