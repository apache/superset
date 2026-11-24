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
 * that renders a widget type on a canvas, lets tools (such as the chat)
 * know which canvas the user has open, and tells either what the canvas page
 * did to the draft it shows.
 *
 * @example
 * ```typescript
 * import { canvas } from '@apache-superset/core';
 *
 * // Extension widget types are namespaced by the backend as
 * // `extensions.<publisher>.<extension>.<type>`.
 * canvas.registerWidgetRenderer('extensions.acme.kpi.kpi', KpiTile);
 * ```
 */

import { ComponentType } from 'react';
import { Disposable, Event } from '../common';

/** A value set by a node, as it reaches the widgets its scope includes. */
export interface FilterValue {
  /** The node id of the filter or cross-filter source. */
  filterNodeId: string;
  /** The value, in the setting widget's own format. */
  value: unknown;
}

/** The props the canvas passes to a widget renderer. */
export interface CanvasWidgetProps {
  canvasId: number;
  /** The placement's id, unique within the canvas, e.g. `revenue-trend`. */
  nodeId: string;
  /**
   * The saved widget's UUID, the same on every canvas that places it. Unset
   * for containers and text.
   */
  widgetId?: string;
  /** The widget id, e.g. `echarts` or `extensions.acme.kpi.kpi`. */
  widgetType: string;
  /**
   * The widget's props, valid against its schema. Only explicitly set values;
   * defaults come from the schema.
   */
  props?: Record<string, unknown>;
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
  /**
   * Publish a value under a kind of your choosing, or clear it with
   * `undefined`. It reaches every widget in this node's auto scope. Namespace
   * the kind, e.g. `acme.highlight`; `filter`, `crossFilter` and
   * `customization` are reserved and ignored here.
   */
  publish: (kind: string, value: unknown) => void;
  /**
   * Increments on every automatic refresh that reaches this node; refetch
   * data when it changes. Stays 0 for nodes exempt from refresh.
   */
  refreshKey: number;
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
 * Registering a type that already has a renderer replaces it, with a warning.
 *
 * @param widgetType The widget type, as the backend names it; an extension's
 *   is `extensions.<publisher>.<extension>.<type>`.
 * @param component The renderer.
 * @returns A Disposable that unregisters the renderer when disposed.
 */
export declare function registerWidgetRenderer(
  widgetType: string,
  component: ComponentType<CanvasWidgetProps>,
): Disposable;

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

/** The draft that the canvas page published or discarded. */
export interface CanvasDraftEvent {
  canvasId: number;
  /**
   * The draft's token, which only its owner can use: compare it, and never
   * log it or send it anywhere but the requests that name the draft.
   */
  token: string;
}

/** A step of its draft's history that the canvas page undid or redid. */
export interface CanvasDraftStepEvent extends CanvasDraftEvent {
  /**
   * The saved widgets whose content the step moved, when it was a step
   * recorded on the server (`superset_core.canvas.drafts`), which the
   * canvas's definition doesn't show: their renderers fetch it again.
   */
  steppedWidgetIds: string[];
}

/**
 * Fires after the canvas page published the draft it shows. Only the page's
 * own publish fires it: not an edit of the draft, nor a commit asked for
 * elsewhere (another tab, the REST API, an agent's tool), which the server's
 * listeners (`superset_core.canvas.drafts.on_draft_event`) hear of.
 */
export declare const onDidPublishDraft: Event<CanvasDraftEvent>;

/**
 * Fires after the canvas page discarded the draft it shows. Only the page's
 * own discard fires it, as for `onDidPublishDraft`.
 */
export declare const onDidDiscardDraft: Event<CanvasDraftEvent>;

/**
 * Fires after the canvas page undid a step of the draft it shows. Only the
 * page's own undo fires it, not one asked for elsewhere, which the server's
 * listeners hear of.
 */
export declare const onDidUndoDraftStep: Event<CanvasDraftStepEvent>;

/**
 * Fires after the canvas page redid a step of the draft it shows. Only the
 * page's own redo fires it, as for `onDidUndoDraftStep`.
 */
export declare const onDidRedoDraftStep: Event<CanvasDraftStepEvent>;
