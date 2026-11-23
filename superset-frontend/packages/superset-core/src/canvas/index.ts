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
  /**
   * The canvas that places this widget. Unset where a {@link WidgetHost}
   * shows a saved widget on its own, outside any canvas: there is no
   * placement then, and `nodeId` is the saved widget's UUID.
   */
  canvasId?: number;
  /**
   * The placement's id, unique within the canvas, e.g. `revenue-trend`.
   * Outside a canvas, the saved widget's UUID.
   */
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

/** What a {@link WidgetHost} needs to show one saved widget. */
export interface WidgetHostProps {
  /** The saved widget's UUID. */
  widgetId: string;
  /**
   * Values of the filters that reach the widget, as a canvas's filters reach
   * a placement: the controls of the page around it, say. The widget is the
   * only node of its filter bus, so what it publishes reaches nothing.
   */
  filters?: FilterValue[];
  /** Increment to refetch the widget's data, as a canvas refresh does. */
  refreshKey?: number;
  /**
   * Whether to draw the widget's name above it, as a canvas titles a
   * placement. On by default; leave it off when the page heads itself with
   * the same name.
   */
  showTitle?: boolean;
}

/**
 * Shows one saved widget on its own, outside any canvas, in the cell a
 * canvas draws around a placement: its title row, the slot its own controls
 * render into, its error boundary, and the placeholder a canvas shows for a
 * widget that can't render. The widget type's renderer runs unchanged, with
 * `canvasId` unset and the props of a filter bus of one node.
 *
 * It fills the height its parent gives it, as a cell fills its rows.
 */
export declare const WidgetHost: ComponentType<WidgetHostProps>;

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

/** What the canvas page did to the draft it shows. */
export type CanvasDraftEventKind =
  | 'discarded'
  | 'committed'
  | 'undone'
  | 'redone';

/** Something the canvas page did to the draft it shows. */
export interface CanvasDraftEvent {
  kind: CanvasDraftEventKind;
  canvasId: number;
  /**
   * The draft's token, which only its owner can use: compare it, and never
   * log it or send it anywhere but the requests that name the draft.
   */
  token: string;
  /**
   * For `undone` and `redone`: the saved widgets whose content a step
   * recorded on the server (`superset_core.canvas.drafts`) moved, which the
   * canvas's definition doesn't show. Their renderers fetch it again.
   */
  steppedWidgetIds: string[];
}

/**
 * Fires after the canvas page discarded, published, undid or redid the draft
 * it shows. Only what the page itself did: a draft that an agent's tool or
 * another tab ends fires nothing here, while the server's listeners
 * (`superset_core.canvas.drafts`) hear of every end.
 */
export declare const onDidChangeDraft: Event<CanvasDraftEvent>;

/** A saved widget that a canvas draft places. */
export interface CanvasDraftWidget {
  /** The placement's node id. */
  nodeId: string;
  /** The saved widget's UUID. */
  widgetId: string;
  /** Its widget type, when the widget resolves. */
  widgetType?: string;
  /** The title the canvas shows above the placement, if any. */
  title?: string;
}

/** The canvas draft about to be published, as a publish participant reads it. */
export interface CanvasDraftPublish {
  canvasId: number;
  /**
   * The draft's token: send it only as the `X-Canvas-Draft` header of the
   * requests that name the draft, and never log it.
   */
  token: string;
  /** The saved widgets the draft places, which publishing it shows viewers. */
  widgets: CanvasDraftWidget[];
}

/** Something published with a canvas draft, which its confirmation lists. */
export interface CanvasPublishPart {
  /** What is published, heading its lines in the confirmation. */
  title: string;
  /** What the person should know before they confirm, a sentence each. */
  lines: string[];
  /**
   * Publishes it once the person confirmed, before the canvas itself is
   * published. A rejection stops the publish: its message is shown, and the
   * canvas stays unpublished.
   */
  publish: () => Promise<void>;
}

/** Takes part in publishing canvas drafts from the canvas page. */
export interface CanvasPublishParticipant {
  /**
   * What publishing `draft` also publishes: none, for a draft it has nothing
   * in. A rejection stops the publish before anything is published.
   */
  prepare: (draft: CanvasDraftPublish) => Promise<CanvasPublishPart[]>;
}

/**
 * Takes part in publishing canvas drafts. When the person publishes a draft
 * from the canvas page, the page asks every participant what publishing it
 * also publishes, and lists every part in a confirmation before anything is
 * published; a draft with no parts is published at once, as without
 * participants. Once the person confirms, the page publishes the parts one
 * after another, then the canvas. The first part that fails stops the
 * publish, with its message shown.
 *
 * Only the page's publish asks: a draft that an agent commits through its
 * tool is published without the parts, which wait for the person.
 *
 * @param participant What it publishes with each draft.
 * @returns A Disposable that ends its part when disposed.
 */
export declare function registerPublishParticipant(
  participant: CanvasPublishParticipant,
): Disposable;
