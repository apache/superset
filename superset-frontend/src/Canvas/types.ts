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
 * CDL (Canvas Definition Language) — the typed, declarative tree an AI (or a
 * human) emits to describe a v2 dashboard. Nothing here is executable code:
 * presentation is a data `option`, data is a `queryContext` + `encoding`, and
 * behaviour is a bounded `action` enum. See canvas-v2-design.md.
 */

export type Primitive = string | number | boolean;

/** A reference to a declared variable, written `$name` anywhere a value is expected. */
export type VarRef = `$${string}`;

export type VariableScope = 'query' | 'ui';

export interface VariableDecl {
  type: 'string' | 'number' | 'boolean';
  default: Primitive;
  /**
   * `query` variables project onto the host dashboard's dataMask (governed,
   * re-queries bound Viz nodes). `ui` variables live client-side only.
   */
  scope: VariableScope;
}

export type VariableValues = Record<string, Primitive>;

/** A value that may be a literal or a `$var` reference resolved at render time. */
export type Bindable<T extends Primitive> = T | VarRef;

export interface CdlFilter {
  col: string;
  op: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE';
  /** May be a literal or a `$var` reference. */
  val: Primitive | Primitive[] | VarRef;
}

/** Declarative formatter vocabulary — resolved into a real function client-side. */
export type Formatter =
  | { kind: 'number'; decimals?: number }
  | { kind: 'currency'; currency: string; decimals?: number }
  | { kind: 'percent'; decimals?: number }
  | { kind: 'date'; format?: string }
  | { kind: 'template'; template: string };

/** Minimal query spec; expands into a Superset query_context at fetch time. */
export interface CdlQueryContext {
  datasetId: number;
  metrics: string[];
  groupby?: string[];
  filters?: CdlFilter[];
  rowLimit?: number;
  /**
   * Sort the result. Combine with `rowLimit` for top-N charts, e.g.
   * `[{ by: 'SUM(global_sales)', desc: true }]` with `rowLimit: 10`.
   * `by` may name a metric (from `metrics`) or a groupby column.
   */
  orderby?: Array<{ by: string; desc?: boolean }>;
}

/**
 * How the query result is shaped onto the echarts series. Inferred from the
 * series type when omitted:
 *  - `categoryValue` — xAxis categories + numeric series (bar, line, area)
 *  - `nameValue`     — [{name, value}] (pie, funnel, treemap, sunburst, gauge)
 *  - `pairs`         — [[x, y]] from two metrics (scatter)
 *  - `matrix`        — [[xIndex, yIndex, value]] (heatmap; needs `series`)
 *  - `radar`         — indicators from categories, one ring per metric
 */
export type EncodingShape =
  'categoryValue' | 'nameValue' | 'pairs' | 'matrix' | 'radar';

/** How query result columns map onto an echarts option. */
export interface Encoding {
  /** Category/x dimension column. */
  x: string;
  /** Value column(s) for the series. */
  y: string | string[];
  /** Optional column whose distinct values fan out into one series each. */
  series?: string | null;
  /** Override the inferred data shape. */
  shape?: EncodingShape;
}

export type CdlAction =
  | { action: 'setVariable'; name: string; value: Primitive | VarRef }
  | {
      action: 'applyFilter';
      col: string;
      op: CdlFilter['op'];
      val: CdlFilter['val'];
    }
  | {
      action: 'crossFilter';
      col: string;
      op: CdlFilter['op'];
      val: CdlFilter['val'];
    }
  | { action: 'clearFilters'; scope?: VariableScope }
  | { action: 'navigateTab'; tabsId: string; tab: string }
  | { action: 'openModal'; modalId: string }
  | { action: 'closeModal'; modalId: string }
  | { action: 'openUrl'; url: string; newTab?: boolean }
  | { action: 'refresh'; target?: string };

export type CdlActionName = CdlAction['action'];

/**
 * Declarative styling: an allowlisted CSS-property object (never a CSS string).
 * Values may be literals or `@themeToken` references resolved from the antd
 * theme at render time. See style.ts.
 */
export type CdlStyle = Record<string, string | number>;

/**
 * Placement for a node inside a `Board` (freeform) container, in grid units:
 * `x`/`y` are the top-left cell (0-based), `w`/`h` the span, `z` the stacking
 * order for deliberate overlap. Ignored outside a Board.
 */
export interface BoardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
}

export interface BaseNode {
  /** Stable id — AI-addressable for targeted edits/diffs. */
  id: string;
  type: string;
  props?: Record<string, unknown>;
  /** Allowlisted inline styling, theme-token aware. */
  style?: CdlStyle;
  /** Position within a parent Board (grid units). */
  layout?: BoardLayout;
  /** Two-way binding of a prop to a `$var`. */
  bind?: Record<string, VarRef>;
  /** Declarative event handlers: event name -> ordered action list. */
  on?: Record<string, CdlAction[]>;
  children?: CdlNode[];
}

export interface VizNode extends BaseNode {
  type: 'Viz';
  renderer: 'echarts' | 'supersetChart';
  /** supersetChart: reference an existing governed Slice. */
  chartId?: number;
  /** supersetChart: extra dataMask filters. */
  filters?: CdlFilter[];
  /** echarts: bound data spec. */
  data?: { queryContext: CdlQueryContext; encoding: Encoding };
  /** echarts: the presentation option (data, not code). */
  option?: Record<string, unknown>;
}

export type CdlNode = BaseNode | VizNode;

export interface CanvasDefinition {
  cdlVersion: number;
  variables: Record<string, VariableDecl>;
  tree: CdlNode;
  /**
   * Outer width cap. `"full"` (default) is full-bleed like a dashboard; a CSS
   * width (e.g. `"820px"`) centres a narrower reading measure for documents.
   */
  canvasWidth?: string;
}

export const isVizNode = (node: CdlNode): node is VizNode =>
  node.type === 'Viz';
