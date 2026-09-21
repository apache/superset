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
import type { ComponentType } from 'react';
import type { common, dashboard as dashboardApi } from '@apache-superset/core';
import type { FilterOperator, ResolvedFilter } from './filterVocabulary';

export type Disposable = common.Disposable;
export type WidgetEvent = dashboardApi.WidgetEvent;
export type DataBindingSpec = dashboardApi.DataBindingSpec;
export type DataRow = dashboardApi.DataRow;
export type QueryDataResult = dashboardApi.QueryDataResult;

/** Everything a widget needs from its host, instead of reading a dashboard tree. */
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

export interface InlineWidgetRef {
  type: string;
  props: Record<string, unknown>;
}

export interface SavedWidgetRef extends InlineWidgetRef {
  id: string;
}

export type WidgetRef = InlineWidgetRef | SavedWidgetRef;

export interface SavedWidget {
  uuid: string;
  widget_type: string;
  title?: string | null;
  props: Record<string, unknown>;
  dataset_id?: number | null;
  changed_on?: string | null;
}

export interface WidgetDataClient {
  fetchData(request: {
    instanceId: string;
    widget: WidgetRef;
    filters: ResolvedFilter[];
  }): Promise<QueryDataResult>;
  fetchValues(request: {
    instanceId: string;
    widget: WidgetRef;
  }): Promise<unknown[]>;
  getSavedWidget?(id: string): Promise<SavedWidget>;
}

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

export interface HostFilter {
  datasetId: number;
  column: string;
  operator: FilterOperator;
  value: unknown;
  /** Instance ids to narrow to; omitted means every widget on `datasetId`. */
  targets?: string[];
}
