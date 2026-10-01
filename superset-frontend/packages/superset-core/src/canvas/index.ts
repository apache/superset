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
 * @fileoverview Canvas API for Superset extensions.
 *
 * A canvas places widgets; widgets are separate entities that bring their own
 * renderers. This module lets a widget provider register the React component
 * that renders a widget type on a canvas, and lets tools (such as the chat)
 * know which canvas the user has open.
 *
 * @example
 * ```typescript
 * import { canvas } from '@apache-superset/core';
 *
 * canvas.registerWidgetRenderer('my_ext.kpi', KpiTile);
 * ```
 */

import { ComponentType, ReactNode } from 'react';
import { Disposable, Event } from '../common';

/**
 * What can drive other widgets: filters, cross-filter sources (charts that
 * filter others when clicked) and customizations (e.g. dynamic group-by).
 */
export type ScopeKind = 'filter' | 'crossFilter' | 'customization';

/** A value set by a node, as it reaches the widgets its scope includes. */
export interface FilterValue {
  /** The node id of the filter, cross-filter source or customization. */
  filterNodeId: string;
  /** The value, in the setting widget's own format. */
  value: unknown;
}

/** Colors shared by every widget on a canvas. */
export interface CanvasColors {
  /** Categorical color scheme; the default scheme when unset. */
  scheme?: string;
  /** Fixed colors for series labels, e.g. `{ France: '#1f77b4' }`. */
  labelColors: Record<string, string>;
}

/** A child node of a container, for containers that arrange children. */
export interface CanvasChild {
  nodeId: string;
  /** The child's widget type, when its widget still resolves. */
  widgetType?: string;
  /** The child's stored layout within this container. */
  layout: Record<string, unknown>;
  /** The rendered child. */
  element: ReactNode;
}

/** The props the canvas passes to a widget renderer. */
export interface CanvasWidgetProps {
  canvasId: number;
  nodeId: string;
  widgetId: string;
  widgetType: string;
  /** Values of the filters whose scope includes this node. */
  filters: FilterValue[];
  /** Values of the cross-filter sources whose scope includes this node. */
  crossFilters: FilterValue[];
  /** Values of the customizations whose scope includes this node. */
  customizations: FilterValue[];
  /**
   * For filter widgets: publish the filter's value to the widgets it drives.
   * Pass `undefined` to clear it.
   */
  setFilterValue: (value: unknown) => void;
  /**
   * For cross-filter sources: publish a cross-filter, or clear it with
   * `undefined`. Ignored while cross-filters are turned off.
   */
  setCrossFilter: (value: unknown) => void;
  /** Whether cross-filters are turned on for this canvas. */
  crossFiltersEnabled: boolean;
  /** For customization widgets: publish the value, or clear it. */
  setCustomizationValue: (value: unknown) => void;
  /** Colors shared across the canvas. */
  colors: CanvasColors;
  /** Whether to show when the widget's data was last refreshed. */
  showTimestamp: boolean;
  /**
   * Increments on every automatic refresh that reaches this node; refetch
   * data when it changes. Stays 0 for nodes exempt from refresh.
   */
  refreshKey: number;
  /** For containers: the child nodes, already rendered. */
  childNodes: CanvasChild[];
  /**
   * For grid containers: the children laid out on the container's grid. Other
   * containers arrange `childNodes` themselves.
   */
  renderGrid: () => ReactNode;
}

/** The canvas the user has open. */
export interface ActiveCanvas {
  id: number;
  title: string;
  revision: number;
}

/**
 * Registers the component that renders a widget type on a canvas.
 *
 * @param widgetType The widget type, as the widget provider names it.
 * @param component The renderer.
 * @returns A Disposable that unregisters the renderer when disposed.
 */
export declare function registerWidgetRenderer(
  widgetType: string,
  component: ComponentType<CanvasWidgetProps>,
): Disposable;

/**
 * Returns the renderer registered for a widget type, if any.
 */
export declare function getWidgetRenderer(
  widgetType: string,
): ComponentType<CanvasWidgetProps> | undefined;

/**
 * Returns the canvas the user has open, if any.
 */
export declare function getActiveCanvas(): ActiveCanvas | undefined;

/**
 * Fires when the user opens or leaves a canvas, or the open canvas changes.
 */
export declare const onDidChangeActiveCanvas: Event<ActiveCanvas | undefined>;
