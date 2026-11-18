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
 * A canvas places widget instances: inline ones, stored on the placement as a
 * widget id and props, or persisted ones, referenced by UUID. Widgets bring
 * their own renderers. This module lets a widget provider register the React component
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

/** The props the canvas passes to a widget renderer. */
export interface CanvasWidgetProps {
  canvasId: number;
  /** The placement's id, unique within the canvas, e.g. `revenue-trend`. */
  nodeId: string;
  /** The widget id, e.g. `echarts` or `extensions.acme.kpi.kpi`. */
  widgetType: string;
  /** For a widget entity (anything but a container or text): its UUID. */
  widgetId?: string;
  /**
   * The widget's props, valid against its schema at `schemaVersion`. Only
   * explicitly set values; defaults come from the schema.
   */
  props?: Record<string, unknown>;
  schemaVersion?: number;
  /**
   * The title the canvas shows above this placement, if any. A renderer that
   * draws a title of its own leaves it out while this is set, so the widget
   * isn't titled twice.
   */
  title?: string;
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
   *
   * A renderer that turns a raw click into one of these owes the canvas two
   * things while a canvas is being arranged, because the same press would
   * otherwise move the widget and the same click would select it: mark the
   * element `data-canvas-no-drag`, and stop the click from propagating. The
   * marker is a DOM attribute rather than a prop because a chart's click
   * lands on a pixel of a canvas element, with nothing for a selector to
   * match otherwise.
   */
  setCrossFilter: (value: unknown) => void;
  /** Whether cross-filters are turned on for this canvas. */
  crossFiltersEnabled: boolean;
  /** For customization widgets: publish the value, or clear it. */
  setCustomizationValue: (value: unknown) => void;
  /**
   * Events of any kind published by the nodes whose auto scope includes this
   * node; a node's latest value per kind.
   */
  events: CanvasEvent[];
  /**
   * Publish a value under any kind other than a {@link ScopeKind}, or clear it
   * with `undefined`. It reaches every widget in this node's auto scope.
   * Namespace the kind, e.g. `acme.highlight`; the scope kinds have their own
   * setters and are ignored here.
   */
  publish: (kind: string, value: unknown) => void;
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
   *
   * Pass `chromeAbove` when the container draws something of its own above
   * that grid, such as a title. A container's handles sit at the top right of
   * its box, so a child in the first row reaching the right edge would paint
   * over them -- unless the container's own chrome already holds that strip,
   * in which case there is nothing for the child to clear.
   */
  renderGrid: (options?: { chromeAbove?: boolean }) => ReactNode;
}

/**
 * The draft open on the active canvas. Its `token` authorizes reading,
 * changing, publishing and discarding the draft as the current user: treat it
 * as a credential, never log it or send it anywhere the user hasn't asked for.
 * `pending` is true while a change to the draft is in flight or its last
 * refresh failed, and `revision` is there only once it has settled.
 */
export type ActiveCanvasDraft =
  | {
      readonly token: string;
      readonly pending: true;
      readonly revision?: undefined;
    }
  | {
      readonly token: string;
      readonly pending: false;
      /**
       * The draft revision on screen, and the one a publish must name. A
       * present token alone is no evidence the user has seen any revision.
       * If a publish naming it is rejected with a conflict, don't retry with
       * a revision the user hasn't seen; wait for the next value.
       */
      readonly revision: number;
    };

/** A saved version, as version history names it. */
export interface ActiveCanvasVersion {
  readonly uuid: string;
  readonly number: number;
}

/** The canvas the user has open. Values are frozen snapshots. */
export interface ActiveCanvas {
  readonly id: number;
  readonly title: string;
  /**
   * Revision of the canvas or draft definition the page last fetched; a
   * version preview doesn't change it, and a draft's layout edits move past
   * it until the next fetch. To publish a draft, name `draft.revision`.
   */
  readonly revision: number;
  /**
   * The draft open in the page, present once its own definition has loaded
   * and until the user leaves it, or the draft turns out to be gone. Absent
   * during a version preview.
   */
  readonly draft?: ActiveCanvasDraft;
  /** The saved version on screen, while one is previewed. */
  readonly previewedVersion?: ActiveCanvasVersion;
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
 * Fires when the user opens or leaves a canvas, or the open canvas changes:
 * entering or leaving a draft, a draft change starting or settling, and
 * entering, leaving or switching a version preview. To tell a switch to
 * another canvas apart, compare `id`.
 */
export declare const onDidChangeActiveCanvas: Event<ActiveCanvas | undefined>;
