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
 * @fileoverview Dashboard building API for Superset extensions (prototype).
 *
 * Structural/layout operations on the "Dashboard v2" prototype dashboard: a
 * flat, addressable tree of nodes (not nested JSX-in-JSON) so small,
 * targeted edits are cheap — the shape an AI agent (most likely a `chat`
 * extension) or any other extension calls to place, move, resize, and
 * remove nodes. This is an early sketch of the design doc's platform-API
 * section, not yet backed by persistence, real chart execution, or the
 * `ChartPlugin`/widget catalog — every method here is synchronous
 * and in-memory.
 *
 * Deliberately granular, matching `sqlLab`'s own style (`getCurrentTab()`,
 * `tab.getEditor()`, ...): there is no single "get everything" call. Start
 * from {@link getRoot}, walk down via each node's `children` and
 * {@link getNode}, and re-query after {@link onDidLayoutChange} fires.
 *
 * `dashboard` owns node placement and layout only. Widget-instance content
 * (props/style/dataBinding) is intentionally out of scope here — it belongs
 * to a future `widgets` namespace mirroring this one.
 *
 * @example
 * ```typescript
 * import { dashboard } from '@apache-superset/core';
 *
 * const root = dashboard.getRoot();
 * const id = dashboard.addWidget(root.id, 0, {
 *   type: 'text',
 *   props: { content: 'Hello dashboard' },
 * });
 * dashboard.updateLayout(id, { colSpan: 12 });
 * ```
 */

import type { Event } from '../common';

/**
 * Layout of a single node: a grid it lays out its own children in (only
 * meaningful when the node is a container — ignored on leaf nodes), plus
 * where the node itself sits within its *parent's* grid. A node can be both
 * at once — a `canvas` nested inside another `canvas` both holds a grid for
 * its own children and occupies cells in its parent's.
 *
 * There is no separate "flow" or "absolute" mode: a single-column grid with
 * every child left at its default full-width span behaves like a plain
 * top-to-bottom stack — it falls out of the same schema rather than
 * requiring a different one.
 */
export interface LayoutProps {
  // --- Container side: how this node arranges its own children. Ignored
  // on a node with no `children`. ---
  /** Number of equal fractional column tracks. Default: 24. */
  columns?: number;
  gap?: number;
  /**
   * Pixel height of one row track. Rows are never predivided from a fixed
   * total — the grid creates as many as its content needs, each this tall,
   * so a fixed unit keeps every child's height predictable without
   * requiring a canvas of a predetermined total height.
   */
  rowUnit?: number;

  // --- Child side: where this node sits within its parent's grid. ---
  /** How many of the parent's columns this node spans. Default: every column (full width). */
  colSpan?: number;
  /** How many row tracks this node spans. Default: 1. */
  rowSpan?: number;
  /** Explicit start column (1-based). Omit to let the grid auto-place this node in the next available cell. */
  col?: number;
  /** Explicit start row (1-based). Omit to let the grid auto-place this node in the next available cell. */
  row?: number;
}

/**
 * A single node in the dashboard tree. `canvas` and `text` are native
 * layout primitives; any other `type` is a widget registry key (a
 * chart, metric tile, or extension-contributed widget).
 *
 * `props`/`style` are inlined directly on the node for now. Once a
 * `widgets` content namespace exists, widget-type nodes will instead
 * carry a `ref` into it — matching the design doc's split between dashboard
 * layout and widget content.
 */
export interface DashboardNode {
  id: string;
  /** Registry key used to pick a renderer — not part of this API's concern. */
  type: string;
  layout?: LayoutProps;
  /**
   * `canvas` nodes only — child node ids, in reading/DOM/tab order. This is
   * independent of each child's visual position (its own `layout.col`/`row`)
   * — moving a node within this array never changes where it's drawn, and
   * repositioning a node on the canvas never changes this array.
   */
  children?: string[];
  /** Leaf/widget nodes only — functional/content config. */
  props?: Record<string, unknown>;
  /** Leaf/widget nodes only — visual customization. */
  style?: Record<string, unknown>;
}

/** Everything needed to create a new node, passed to {@link addWidget}. */
export interface WidgetSpec {
  type: string;
  layout?: LayoutProps;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

/**
 * Returns the root `canvas` node — the entry point for walking the tree.
 * Its `children` array holds the top-level node ids.
 */
export declare function getRoot(): DashboardNode;

/**
 * Returns a specific node, or undefined if `id` doesn't exist.
 */
export declare function getNode(id: string): DashboardNode | undefined;

/**
 * Creates a new node and inserts it into a `canvas` parent's children at
 * `index`.
 *
 * @param parentId Id of an existing `canvas` node.
 * @param index Position among the parent's existing children; out-of-range
 *   values are clamped.
 * @param spec The new node's type, layout, props, and style.
 * @returns The new node's id.
 *
 * @example
 * ```typescript
 * const root = dashboard.getRoot();
 * dashboard.addWidget(root.id, 0, {
 *   type: 'canvas',
 *   layout: { colSpan: 12, columns: 4, gap: 16 },
 * });
 * ```
 */
export declare function addWidget(
  parentId: string,
  index: number,
  spec: WidgetSpec,
): string;

/**
 * Removes a node and its entire subtree (if it's a `canvas`), detaching it
 * from its parent. No-op if `id` doesn't exist. Throws if `id` is the root.
 */
export declare function removeWidget(id: string): void;

/**
 * Moves an existing node to a new `canvas` parent at `newIndex`, detaching
 * it from wherever it currently sits. Throws if `newParentId` is `id` itself
 * or one of its own descendants.
 */
export declare function moveWidget(
  id: string,
  newParentId: string,
  newIndex: number,
): void;

/**
 * Merges `layout` into a node's existing layout object.
 */
export declare function updateLayout(
  id: string,
  layout: Partial<LayoutProps>,
): void;

/**
 * Shallow-merges `props` into a node's existing props — the content-side
 * counterpart to {@link updateLayout}. Use this to edit an existing widget
 * in place (e.g. a chart's `dataBinding`/`echartsOptions`, or a markdown
 * node's `content`) rather than removing and re-adding the node just to
 * change what it renders, which loses its position, layout, and identity.
 */
export declare function updateProps(
  id: string,
  props: Record<string, unknown>,
): void;

/**
 * Event fired after any structural or layout change. Carries no payload —
 * re-query {@link getRoot}/{@link getNode} for whatever you need, since a
 * single mutation (e.g. a move) can touch more than one node.
 */
export declare const onDidLayoutChange: Event<void>;

/**
 * What an `echarts`-type widget queries. Deliberately generic (no
 * `viz_type`): {@link fetchQueryData} always hits the same code path
 * Superset falls back to when a form_data's `viz_type` has no registered
 * ChartPlugin, so it works for any chart shape without per-viz-type
 * integration.
 */
export interface DataBindingSpec {
  datasetId: number;
  /** Each entry is either a saved metric's exact name, or an ad hoc metric object. */
  metrics: unknown[];
  dimensions?: string[];
  filters?: Record<string, unknown>[];
  rowLimit?: number;
}

export type DataRow = Record<string, string | number | boolean | null>;

export interface QueryDataResult {
  columns: string[];
  rows: DataRow[];
}

/**
 * Runs an ad hoc query against a dataset and returns plain tabular rows.
 * Rejects with a descriptive error (e.g. an unknown column/metric name) if
 * the query is invalid — callers that create `echarts` nodes should await
 * this *before* calling {@link addWidget}, so a bad `dataBinding`
 * surfaces as an immediate, correctable tool error instead of a node that
 * silently fails to render later.
 */
export declare function fetchQueryData(
  binding: DataBindingSpec,
): Promise<QueryDataResult>;

/**
 * The categorical series colors of the active color scheme, in order.
 *
 * A widget that draws its own chart has to colour its series itself,
 * and an extension can't reach `CategoricalColorNamespace` — it isn't part of
 * this API. Without this, every renderer falls back to its own library's stock
 * palette (ECharts' blues, Vega-Lite's `category10`), so two widgets on one
 * dashboard disagree about what "the first series" looks like.
 */
export declare function getCategoricalColors(): string[];

/**
 * What the active theme means for a chart, stated without reference to any
 * charting library.
 *
 * A widget draws with whatever renderer it likes, and every charting library
 * ships its own palette and its own near-black text — so without this, a widget
 * looks like its library rather than like Superset, and two widgets on one
 * dashboard disagree about what "the first series" is. Map these few fields onto
 * your renderer's own config and merge your spec *over* the result, so a widget
 * that genuinely wants different colours can still say so while theme
 * compatibility is what it gets for free.
 *
 * `getColor` is how a series gets its colour: by what it is called, not by
 * where it sits. See the field's own note for why that matters across widgets.
 *
 * `sequentialColors` is for a continuous measure — heatmap cells, a colour ramp
 * — where a categorical palette is the wrong answer. It may be empty if the
 * deployment registers no sequential scheme, in which case keep your renderer's
 * own default rather than inventing one.
 */
export interface ChartTheme {
  /** Transparent, so a chart sits on the widget surface rather than over it. */
  background: string;
  text: {
    color: string;
    /** Text that labels rather than states — axis ticks, legend entries. */
    mutedColor: string;
    /** Present but inactive — a toggled-off legend entry. */
    disabledColor: string;
    fontFamily: string;
    fontSize: number;
  };
  axis: {
    lineColor: string;
    labelColor: string;
    gridColor: string;
    /** Minor gridlines, where a renderer draws them. */
    minorGridColor: string;
  };
  tooltip: {
    background: string;
    color: string;
  };
  /** Accent for hover markers, crosshairs, selection. */
  accent: string;
  /** The active categorical scheme, in order. One colour per series. */
  categoricalColors: string[];
  /**
   * The colour for a named series or category — "EMEA", "Direct", a product
   * name.
   *
   * Prefer this to indexing {@link categoricalColors} yourself. A dashboard is
   * read across its widgets, and by position "EMEA" is the second colour in a
   * chart that happens to list it second and the fifth in one that does not —
   * so the same thing is a different colour in every widget it appears in.
   * Asked for by name it is one colour everywhere, including in the v1 charts
   * beside it, which resolve their colours the same way.
   */
  getColor: (label: string) => string;
  /** The active sequential scheme, light to dark. Possibly empty. */
  sequentialColors: string[];
}

/**
 * The active theme, as a chart cares about it. See {@link ChartTheme}.
 *
 * Read it per render rather than once at module load: both the colour scheme and
 * the light/dark theme can change while a widget is mounted.
 */
export declare function getChartTheme(): ChartTheme;
