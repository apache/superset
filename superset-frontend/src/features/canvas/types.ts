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

export interface GridPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/**
 * A child's *stored* layout, as opposed to the rectangle it resolved to. Any
 * field may be absent: an auto-placed child has no `col`/`row` at all.
 */
export interface GridLayout {
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
}

/**
 * The span limits a widget declares. Absent limits are open; the client
 * clamps to these so a drag or resize can't produce a layout the server
 * would reject.
 */
export interface SpanConstraints {
  minColSpan?: number;
  maxColSpan?: number;
  minRowSpan?: number;
  maxRowSpan?: number;
}

interface CanvasNodeBase {
  layout: Record<string, unknown>;
  children?: string[];
}

/** A placement of a widget entity, by UUID. */
export interface PersistedCanvasNode extends CanvasNodeBase {
  widgetId: string;
  widgetType?: never;
  schemaVersion?: never;
  props?: never;
}

/** A placement holding a structural widget (a container or text). */
export interface InlineCanvasNode extends CanvasNodeBase {
  widgetType: string;
  schemaVersion: number;
  props: Record<string, unknown>;
  widgetId?: never;
}

export type CanvasNode = PersistedCanvasNode | InlineCanvasNode;

export interface CanvasDefinition {
  version: number;
  root: {
    layout: { columns: number; gap: number; rowUnit: number };
    children: string[];
  };
  nodes: Record<string, CanvasNode>;
  interactions: {
    filters: Record<string, unknown>;
    crossFilters: Record<string, unknown>;
    customizations: Record<string, unknown>;
  };
  settings: CanvasSettings;
}

export interface CanvasSettings {
  refresh: { interval: number; stagger: number; exempt: string[] };
  colors: { scheme?: string; labelColors: Record<string, string> };
  display: { showTimestamps: boolean };
  crossFilters: { enabled: boolean };
}

/** `GET /api/v1/canvas/<id>/definition` */
export interface CanvasDefinitionResult {
  version: number;
  revision: number;
  definition: CanvasDefinition;
  /** Filter node id -> node ids it drives. */
  filterScopes: Record<string, string[]>;
  /** Cross-filter source node id -> node ids it drives; empty when off. */
  crossFilterScopes: Record<string, string[]>;
  /** Customization node id -> node ids it drives. */
  customizationScopes: Record<string, string[]>;
  /** Resolved grid placement of every node on a grid. */
  placements: Record<string, GridPlacement>;
  /**
   * The stored layout of every node on a grid, which the server resolves
   * placement from. Not derivable from `placements`: an auto-placed node has
   * no stored `col`/`row`, and a collided node's stored `row` is the
   * pushed-down one. A drag preview has to resolve from these to agree with
   * the write that follows.
   */
  layouts: Record<string, GridLayout>;
  /** Node id -> widget type, for nodes whose widget resolves. */
  widgetTypes: Record<string, string>;
  /** Grid container node id -> its column count. */
  gridColumns: Record<string, number>;
  /** Node id -> its widget's span limits, for nodes that declare any. */
  layoutConstraints: Record<string, SpanConstraints>;
  /** Widget UUID -> the content of each widget entity placements hold. */
  widgets?: Record<string, StoredWidget>;
  /** Whether the current user may apply operations to this canvas. */
  canEdit: boolean;
}

/** A widget entity's content, as a canvas renders it. */
export interface StoredWidget {
  widgetType: string;
  schemaVersion: number;
  name: string;
  props: Record<string, unknown>;
}

/**
 * `PATCH /api/v1/canvas/<id>/definition` — the revision the write produced
 * and the placements resolved from it, so a client that just moved a widget
 * renders the server's collision push-down without refetching.
 */
export interface ApplyOperationsResult {
  revision: number;
  ops: Record<string, unknown>[];
  placements: Record<string, GridPlacement>;
  /**
   * The stored layouts the write produced. A write can change a node's stored
   * layout without being asked to: a collided sibling is pushed down and its
   * new `row` is written back. Without these the next drag's preview would
   * resolve from a layout the server has already moved on from.
   */
  layouts: Record<string, GridLayout>;
  widgetTypes: Record<string, string>;
  gridColumns: Record<string, number>;
  layoutConstraints: Record<string, SpanConstraints>;
}

/** A row of `GET /api/v1/canvas/`. */
export interface CanvasObject {
  id: number;
  uuid: string;
  title: string;
  description?: string | null;
  url: string;
  slug?: string | null;
  certified_by?: string | null;
  certification_details?: string | null;
  changed_on_delta_humanized?: string;
  changed_by?: { id: number; first_name: string; last_name: string } | null;
  editors?: { id: number; label: string; type: number }[];
}

/** `GET /api/v1/canvas/<id>`. */
export interface CanvasMetadata {
  id: number;
  title: string;
  description?: string | null;
  slug?: string | null;
  css?: string | null;
  certified_by?: string | null;
  certification_details?: string | null;
  theme?: { id: number; theme_name: string; json_data: string } | null;
}
