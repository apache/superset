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

import { GenericDataType } from '@apache-superset/core/common';
import { SupersetClient } from '@superset-ui/core';
import { DRAFT_TOKEN_HEADER, VERSION_HEADER } from '../useCanvasDefinition';
import type { DataRow } from './resolveBindings';

/** A widget's `dataBinding` prop: the query the server runs for it. */
export interface DataBinding {
  datasetId: number;
  metrics: unknown[];
  dimensions?: string[];
  filters?: Record<string, unknown>[];
  rowLimit?: number;
  orderBy?: { field: string; descending?: boolean }[];
}

/** The value a `filter.select` widget publishes to the widgets in its scope. */
export interface SelectFilterValue {
  datasetId: number;
  column: string;
  values: string[];
}

const isSelectFilterValue = (value: unknown): value is SelectFilterValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SelectFilterValue).datasetId === 'number' &&
  typeof (value as SelectFilterValue).column === 'string' &&
  Array.isArray((value as SelectFilterValue).values);

/**
 * The select filter values reaching a widget, sent with its data request.
 * The server applies those on the binding's own dataset.
 */
export function runtimeFilters(
  filters: { value: unknown }[],
): SelectFilterValue[] {
  return filters
    .map(filter => filter.value)
    .filter(isSelectFilterValue)
    .filter(value => value.values.length > 0)
    .map(({ datasetId, column, values }) => ({ datasetId, column, values }));
}

export interface PlacementData {
  /** Temporal values arrive as epoch ms and are turned into date strings. */
  rows: DataRow[];
  /** Each column's type, by name. */
  coltypes?: Record<string, GenericDataType>;
  /** The query that ran; only for users who can view queries. */
  query?: string;
  language?: string;
}

/**
 * An epoch-ms timestamp as the UTC date it stands for: `2024-01-31`, with the
 * time only when it has one.
 */
export const formatTemporal = (value: unknown): unknown => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const iso = new Date(value).toISOString();
  return iso.endsWith('T00:00:00.000Z')
    ? iso.slice(0, 10)
    : iso.slice(0, 19).replace('T', ' ');
};

/** `rows` with every temporal column's values as dates rather than numbers. */
export function withTemporalValues(
  rows: DataRow[],
  coltypes: Record<string, GenericDataType> = {},
): DataRow[] {
  const temporal = Object.keys(coltypes).filter(
    name => coltypes[name] === GenericDataType.Temporal,
  );
  if (temporal.length === 0) return rows;
  return rows.map(row => {
    const next = { ...row };
    temporal.forEach(name => {
      if (name in next) next[name] = formatTemporal(next[name]);
    });
    return next;
  });
}

/** Both data endpoints answer a widget's binding as a dataset of its own. */
function firstDataset(json: {
  result?: {
    datasets?: {
      inline_data?: DataRow[];
      coltypes?: Record<string, GenericDataType>;
      query?: string;
      language?: string;
    }[];
  };
}): PlacementData {
  const dataset = json?.result?.datasets?.[0];
  const coltypes = dataset?.coltypes ?? {};
  return {
    rows: withTemporalValues(dataset?.inline_data ?? [], coltypes),
    coltypes,
    query: dataset?.query,
    language: dataset?.language,
  };
}

/**
 * A placement's data. The server builds the query from the placement's
 * stored binding, so the page, MCP tools and reports run the same query.
 */
export async function fetchPlacementData({
  canvasId,
  placementId,
  draftToken,
  versionUuid,
  filters,
}: {
  canvasId: number;
  placementId: string;
  draftToken?: string;
  /** Read the placement as this version saved it. */
  versionUuid?: string;
  filters: SelectFilterValue[];
}): Promise<PlacementData> {
  const headers = {
    ...(draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {}),
    ...(versionUuid ? { [VERSION_HEADER]: versionUuid } : {}),
  };
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/canvas/${canvasId}/placement/${encodeURIComponent(
      placementId,
    )}/data`,
    headers,
    jsonPayload: { runtime_filters: filters },
  });
  return firstDataset(json);
}

/**
 * A saved widget's data on its own, without a canvas: the same query its
 * placements run, built on the server from its stored binding.
 */
export async function fetchWidgetData({
  widgetId,
  filters,
}: {
  widgetId: string;
  filters: SelectFilterValue[];
}): Promise<PlacementData> {
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/widget/${encodeURIComponent(widgetId)}/data`,
    jsonPayload: { runtime_filters: filters },
  });
  return firstDataset(json);
}
