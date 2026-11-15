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
 * @fileoverview Named bindings: their data, fetched through the canvas
 * placement data endpoint as the viewer, and the host-side checks of what the
 * frame asks for.
 *
 * The server builds every query from the stored definition; the frame only
 * names a declared binding. A request names the binding, and carries the
 * token of the draft the page shows, so that a draft's placement is read from
 * the draft.
 */

// TODO: the endpoint runs `props.bindings[name]`, and an artifact's props hold
// only its id and version; until the endpoint resolves bindings from the
// artifact's manifest, these requests answer that the placement has no
// binding of that name.
// TODO: typed parameters, so that `query` can send new values.
// TODO: accept only cross-filter values the host delivered, and rate-limit
// parameters.

import type {
  ArtifactFilter,
  BindingData,
  DataEventValue,
  DataRow,
  EventKind,
  QueryRequest,
} from '@apache-superset/artifact-sdk';
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

/** The filter values reaching the widget, in the data request's shape. */
export function runtimeFilters(
  values: readonly canvas.FilterValue[],
): SelectFilterValue[] {
  return values
    .map(filter => filter.value)
    .filter(isSelectFilterValue)
    .filter(value => value.values.length > 0)
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
    ...filters.map(({ filterNodeId, value }) => ({
      kind: 'filter' as const,
      source: filterNodeId,
      value,
    })),
    ...crossFilters.map(({ filterNodeId, value }) => ({
      kind: 'cross_filter' as const,
      source: filterNodeId,
      value,
    })),
  ];
}

interface PlacementDataResponse {
  result?: { datasets?: { inline_data?: DataRow[] }[] };
}

/** Where a placement's bindings run: its canvas, the draft, the filters. */
export interface BindingRequest {
  canvasId: number;
  placementId: string;
  draftToken?: string;
  filters: SelectFilterValue[];
}

/** One named binding's rows, run on the server as the viewer. */
export async function fetchBinding({
  canvasId,
  placementId,
  binding,
  draftToken,
  filters,
}: BindingRequest & { binding: string }): Promise<BindingData> {
  const json = await requestJson<PlacementDataResponse>(
    `/api/v1/canvas/${canvasId}/placement/${encodeURIComponent(placementId)}/data`,
    {
      method: 'POST',
      body: { runtime_filters: filters, binding },
      headers: draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {},
    },
  );
  // TODO: columns, and the definitions and formats of the metrics.
  return { rows: json.result?.datasets?.[0]?.inline_data ?? [] };
}

/** Every binding the manifest declares, fetched together. */
export async function fetchBindings(
  manifest: HostManifest,
  request: BindingRequest,
): Promise<Record<string, BindingData>> {
  const names = Object.keys(manifest.bindings ?? {});
  const results = await Promise.all(
    names.map(binding => fetchBinding({ ...request, binding })),
  );
  return Object.fromEntries(names.map((name, index) => [name, results[index]]));
}

/** A `query` request, if it names a declared binding and declared parameters. */
export function checkQuery(
  manifest: HostManifest,
  request: QueryRequest,
): Checked<string> {
  const binding = manifest.bindings?.[request.binding];
  if (!binding) {
    return { ok: false, reason: `no binding named "${request.binding}"` };
  }
  const declared = binding.parameters ?? {};
  const unknown = Object.keys(request.params).filter(
    name => !(name in declared),
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

/** An event value, if the manifest declares that event on its dimension. */
export function checkEvent(
  manifest: HostManifest,
  kind: EventKind,
  value: DataEventValue,
): Checked<DataEventValue> {
  const declared = (manifest.events ?? []).some(
    event =>
      event.kind === kind &&
      event.binding === value.binding &&
      event.dimension === value.dimension,
  );
  return declared
    ? { ok: true, value }
    : {
        ok: false,
        reason: `no ${kind} event on ${value.binding}.${value.dimension}`,
      };
}

/** A declared cross-filter, as the canvas filter bus carries it. */
export function crossFilterValue(
  manifest: HostManifest,
  value: DataEventValue,
): Checked<SelectFilterValue> {
  const checked = checkEvent(manifest, 'cross_filter', value);
  if (!checked.ok) return checked;
  const source = manifest.bindings?.[value.binding]?.source;
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
