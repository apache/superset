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
 * @fileoverview What a widget is, and what it may ask of whoever renders it.
 *
 * The companion to {@link dashboard}, which owns node placement and layout:
 * this is the widget-instance side the design note there points to. It is the
 * contract only — types plus the few names two parties must spell the same
 * way. The widgets themselves, the bus and the data clients that implement it
 * live in `@apache-superset/widgets`, which every renderer depends on and
 * this package deliberately does not: a page that only places nodes, or an
 * extension that only declares a widget type, should not pull a charting
 * runtime with it.
 *
 * The same contract holds wherever a widget is drawn — the Dashboard v2
 * builder, a host application embedding one, or a Claude artifact — so a
 * widget is written once and never learns which of them it is inside.
 */

import type { ComponentType } from 'react';
import type { Disposable } from '../common';
import type {
  DataBindingSpec,
  DataRow,
  QueryDataResult,
  WidgetEvent,
} from '../dashboard';

/**
 * The `views` location a widget type registers its renderer at. An extension
 * contributes a widget through the same `views.registerView` call the host
 * uses for its built-in ones, and a host application resolves the same
 * location when it loads that extension.
 */
export const DASHBOARD_WIDGETS_LOCATION = 'dashboard.widgets';

/**
 * Prefix for sources that are not widgets: a host page emits its own filters
 * under `host:<key>`, so a consumer reading {@link WidgetBus.getSourceIds} can
 * tell them from node ids without asking the tree.
 */
export const HOST_SOURCE_PREFIX = 'host:';

/**
 * Everything a widget needs from its host in order to interoperate with the
 * other widgets on the page, instead of reading a dashboard tree it may not
 * be inside. The builder implements this over its node store; an embedding
 * host gets one from its provider.
 */
export interface WidgetBus {
  emit(sourceId: string, eventType: string, payload: unknown): void;
  on(eventType: string, listener: (event: WidgetEvent) => void): Disposable;
  getValue(sourceId: string, eventType: string): unknown;
  /** Every id that has emitted `eventType` and still counts as a source. */
  getSourceIds(eventType: string): string[];
  /** An explicit scope the host knows for a source; `undefined` defers to the payload's own `targets`. */
  getScopeTargets(sourceId: string): string[] | undefined;
  /** Ticks on every emit. */
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}

/**
 * The operator vocabulary a query constraint can express — deliberately
 * narrow, so any consumer can interpret one without knowing what produced it.
 * It is the query side of a filter, not the event payload widgets publish to
 * each other: that stays `unknown` to this package (see `filterVocabulary` in
 * `@apache-superset/widgets` for the convention the built-in widgets share).
 */
export type FilterOperator =
  'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'RANGE' | 'TIME_RANGE';

/**
 * A constraint to AND onto a widget's query. Mirrors the adhoc-filter shape
 * the backend already takes, so a client can hand one to the server without a
 * translation step of its own.
 */
export interface ResolvedFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
  /** Narrows which dataset this constraint applies to, for cross-dataset pages. */
  datasource?: number;
}

/** A filter the host owns, rather than one a widget on the page produced. */
export interface HostFilter {
  datasetId: number;
  column: string;
  operator: FilterOperator;
  value: unknown;
  /** Instance ids to narrow to; omitted means every widget on `datasetId`. */
  targets?: string[];
}

/** A widget defined in place: the type and the props that configure it. */
export interface InlineWidgetRef {
  type: string;
  props: Record<string, unknown>;
}

/** A widget saved in Superset, whose stored definition the server runs. */
export interface SavedWidgetRef extends InlineWidgetRef {
  id: string;
}

export type WidgetRef = InlineWidgetRef | SavedWidgetRef;

/** A saved widget as the API returns it. */
export interface SavedWidget {
  uuid: string;
  widget_type: string;
  title?: string | null;
  props: Record<string, unknown>;
  dataset_id?: number | null;
  changed_on?: string | null;
}

/**
 * How a widget gets its rows. Always a round trip: the query is built from a
 * definition the server holds or validates, never sent from the browser, so
 * the same widget can be rendered for a signed-in author or an embedded guest
 * without changing what it is allowed to read.
 */
export interface WidgetDataClient {
  fetchData(request: {
    instanceId: string;
    widget: WidgetRef;
    filters: ResolvedFilter[];
  }): Promise<QueryDataResult>;
  /** Distinct selectable values, for a filter-like widget. */
  fetchValues(request: {
    instanceId: string;
    widget: WidgetRef;
  }): Promise<unknown[]>;
  getSavedWidget?(id: string): Promise<SavedWidget>;
}

/** What every widget component is rendered with. */
export interface WidgetProps<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Identity on the bus: what this widget emits under and what filter `targets` name. */
  instanceId: string;
  props: P;
  /** Set when the widget is a saved one, so the server runs the stored definition. */
  savedId?: string;
}

export type WidgetComponent = ComponentType<WidgetProps>;

// Re-exported so writing a widget is one import: these describe the query a
// widget binds to and the rows it gets back, and every widget touches them.
export type { DataBindingSpec, DataRow, QueryDataResult, WidgetEvent };
