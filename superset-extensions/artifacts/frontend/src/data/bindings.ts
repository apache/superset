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
 * @fileoverview Named bindings: their data, fetched as the viewer through the
 * canvas placement data endpoint, or the saved widget's own on a page of its
 * own, and the host-side checks of what the frame asks for.
 *
 * The server builds every query from the stored manifest of the version the
 * frame loads; the frame only names a declared binding. A placement's request
 * carries the token of the draft the page shows, so that a draft's placement
 * is read from the draft.
 */

// TODO: typed parameters, so that `query` can send new values.

import type {
  ArtifactFilter,
  BindingData,
  DataEventValue,
  DataRow,
  QueryRequest,
} from '@superset-oss/artifacts-sdk';
import type { canvas } from '@apache-superset/core';
import { DRAFT_TOKEN_HEADER } from '../constants';
import type { HostManifest } from '../frames/api';
import { requestJson } from '../http';

/** A canvas filter-bus value, as the placement data endpoint takes it. */
export interface SelectFilterValue {
  datasetId: number;
  column: string;
  values: (string | number | boolean)[];
}

/** A check that passed with a value, or failed with a reason. */
export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

/** `record[name]`, if `record` holds `name` itself: never an inherited one. */
function own<T>(record: Readonly<Record<string, T>> | undefined, name: string) {
  return record !== undefined &&
    Object.prototype.hasOwnProperty.call(record, name)
    ? record[name]
    : undefined;
}

const isFilterScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const isSelectFilterValue = (value: unknown): value is SelectFilterValue => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.datasetId === 'number' &&
    typeof candidate.column === 'string' &&
    Array.isArray(candidate.values) &&
    candidate.values.every(isFilterScalar)
  );
};

/**
 * The filter values that select something. A cleared filter can still reach
 * the widget: the canvas's select filter publishes `null` when it is cleared,
 * and a select value can hold no values.
 */
function activeFilters(
  values: readonly canvas.FilterValue[],
): canvas.FilterValue[] {
  return values.filter(
    ({ value }) =>
      value !== null &&
      value !== undefined &&
      !(isSelectFilterValue(value) && value.values.length === 0),
  );
}

/** The filter values reaching the widget, in the data request's shape. */
export function runtimeFilters(
  values: readonly canvas.FilterValue[],
): SelectFilterValue[] {
  return activeFilters(values)
    .map(filter => filter.value)
    .filter(isSelectFilterValue)
    .map(({ datasetId, column, values: selected }) => ({
      datasetId,
      column,
      values: selected,
    }));
}

/** The filters reaching the widget, as the frame's state carries them. */
export function artifactFilters(
  filters: readonly canvas.FilterValue[],
  crossFilters: readonly canvas.FilterValue[],
): ArtifactFilter[] {
  return [
    ...activeFilters(filters).map(({ filterNodeId, value }) => ({
      kind: 'filter' as const,
      source: filterNodeId,
      value,
    })),
    ...activeFilters(crossFilters).map(({ filterNodeId, value }) => ({
      kind: 'cross_filter' as const,
      source: filterNodeId,
      value,
    })),
  ];
}

interface PlacementDataResponse {
  result?: { datasets?: { inline_data?: DataRow[] }[] };
}

/**
 * Where a frame's bindings run: the canvas placement that shows it, in the
 * draft the page shows if any, or the saved widget on a page of its own.
 */
export type BindingSource =
  | {
      kind: 'placement';
      canvasId: number;
      placementId: string;
      draftToken?: string;
    }
  | { kind: 'widget'; widgetId: string };

function dataEndpoint(source: BindingSource): {
  path: string;
  headers: Record<string, string>;
} {
  if (source.kind === 'widget') {
    return {
      path: `/api/v1/widget/${encodeURIComponent(source.widgetId)}/data`,
      headers: {},
    };
  }
  const { canvasId, placementId, draftToken } = source;
  return {
    path: `/api/v1/canvas/${canvasId}/placement/${encodeURIComponent(placementId)}/data`,
    headers: draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {},
  };
}

/** One named binding's rows, run on the server as the viewer. */
export async function fetchBinding(
  source: BindingSource,
  binding: string,
  filters: SelectFilterValue[],
): Promise<BindingData> {
  const { path, headers } = dataEndpoint(source);
  const json = await requestJson<PlacementDataResponse>(path, {
    method: 'POST',
    body: { runtime_filters: filters, binding },
    headers,
  });
  // TODO: columns, and the definitions and formats of the metrics.
  return { rows: json.result?.datasets?.[0]?.inline_data ?? [] };
}

/** Every binding the manifest declares, fetched together. */
export async function fetchBindings(
  manifest: HostManifest,
  source: BindingSource,
  filters: SelectFilterValue[],
): Promise<Record<string, BindingData>> {
  const names = Object.keys(manifest.bindings ?? {});
  const results = await Promise.all(
    names.map(binding => fetchBinding(source, binding, filters)),
  );
  return Object.fromEntries(names.map((name, index) => [name, results[index]]));
}

/** A `query` request, if it names a declared binding and declared parameters. */
export function checkQuery(
  manifest: HostManifest,
  request: QueryRequest,
): Checked<string> {
  const binding = own(manifest.bindings, request.binding);
  if (!binding) {
    return { ok: false, reason: `no binding named "${request.binding}"` };
  }
  const declared = binding.parameters ?? {};
  const unknown = Object.keys(request.params).filter(
    name => own(declared, name) === undefined,
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `undeclared parameters: ${unknown.join(', ')}`,
    };
  }
  if (Object.keys(request.params).length > 0) {
    return {
      ok: false,
      reason: 'this host cannot send new parameter values yet',
    };
  }
  return { ok: true, value: request.binding };
}

/** A declared cross-filter, as the canvas filter bus carries it. */
export function crossFilterValue(
  manifest: HostManifest,
  value: DataEventValue,
): Checked<SelectFilterValue> {
  const declared = (manifest.events ?? []).some(
    event =>
      event.binding === value.binding && event.dimension === value.dimension,
  );
  if (!declared) {
    return {
      ok: false,
      reason: `no cross_filter event on ${value.binding}.${value.dimension}`,
    };
  }
  const source = own(manifest.bindings, value.binding)?.source;
  if (source?.kind !== 'dataset') {
    return { ok: false, reason: 'cross-filters need a dataset binding' };
  }
  const values = value.values.filter(isFilterScalar);
  if (values.length !== value.values.length) {
    return { ok: false, reason: 'cross-filter values cannot be null' };
  }
  return {
    ok: true,
    value: { datasetId: source.dataset_id, column: value.dimension, values },
  };
}
