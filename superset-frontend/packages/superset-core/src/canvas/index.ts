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

/** A filter value set by a filter widget, as it reaches the widgets it drives. */
export interface FilterValue {
  /** The node id of the filter that set the value. */
  filterNodeId: string;
  /** The value, in the filter widget's own format. */
  value: unknown;
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
  /**
   * For filter widgets: publish the filter's value to the widgets it drives.
   * Pass `undefined` to clear it.
   */
  setFilterValue: (value: unknown) => void;
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
