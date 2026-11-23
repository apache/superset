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
 * @fileoverview The host's own renderer types: what the built-in renderers
 * get, a superset of the `@apache-superset/core` widget props. Members land in
 * core only once an extension needs them.
 */

import { ReactNode } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';

export type FilterValue = canvasApi.FilterValue;

/**
 * What can drive other widgets: filters, cross-filter sources (charts that
 * filter others when clicked) and customizations (e.g. dynamic group-by).
 */
export type ScopeKind = 'filter' | 'crossFilter' | 'customization';

/**
 * A value published under a kind of the publisher's choosing, as it reaches
 * the widgets in the publisher's auto scope.
 */
export interface CanvasEvent {
  /** The kind it was published under, e.g. `acme.highlight`. */
  kind: string;
  /** The node id of the publisher. */
  sourceNodeId: string;
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
  /** The child's props, valid against its widget's schema. */
  props?: Record<string, unknown>;
  /** The child's stored layout within this container. */
  layout: Record<string, unknown>;
  /** The rendered child. */
  element: ReactNode;
}

/** Everything the canvas passes to a renderer; extensions see a subset. */
export interface CanvasRendererProps extends canvasApi.CanvasWidgetProps {
  /** For a widget entity (anything but a container or text): its UUID. */
  widgetId?: string;
  /** The schema version `props` is valid against. */
  schemaVersion?: number;
  /** Values of the customizations whose scope includes this node. */
  customizations: FilterValue[];
  /**
   * For filter widgets: publish the filter's value to the widgets it drives.
   * Pass `undefined` to clear it.
   */
  setFilterValue: (value: unknown) => void;
  /** For customization widgets: publish the value, or clear it. */
  setCustomizationValue: (value: unknown) => void;
  /**
   * Events of any kind published by the nodes whose auto scope includes this
   * node; a node's latest value per kind.
   */
  events: CanvasEvent[];
  /** Colors shared across the canvas. */
  colors: CanvasColors;
  /** Whether to show when the widget's data was last refreshed. */
  showTimestamp: boolean;
  /** For containers: the child nodes, already rendered. */
  childNodes: CanvasChild[];
  /**
   * For grid containers: the children laid out on the container's grid. Other
   * containers arrange `childNodes` themselves.
   *
   * Pass `chromeAbove` when the container draws something of its own above
   * that grid, such as a title. A container's handles sit at the top right of
   * its box, so a child in the first row reaching the right edge would paint
   * over them -- unless the container's own chrome already holds that strip,
   * in which case there is nothing for the child to clear.
   */
  renderGrid: (options?: { chromeAbove?: boolean }) => ReactNode;
}
