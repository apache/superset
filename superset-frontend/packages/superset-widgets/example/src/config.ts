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

// Vite injects env only where the source literally reads `import.meta.env`,
// so this must not be destructured (oxlint's prefer-destructuring would).
const viteEnv = import.meta.env;

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

export const config = {
  supersetUrl: (viteEnv.SUPERSET_URL ?? 'http://localhost:8088').replace(
    /\/+$/,
    '',
  ),
  // `session` uses the viewer's Superset login cookie; `guest` uses the token broker.
  authMode: (viteEnv.EMBED_AUTH === 'guest' ? 'guest' : 'session') as
    'guest' | 'session',
  savedWidgetIds: list(viteEnv.EMBED_WIDGET_IDS),
  /**
   * A widget type contributed by a Superset extension, e.g.
   * `extensions.<publisher>.<name>.<type>`. Set it and the page renders one:
   * the provider fetches that extension from Superset and loads its code at
   * runtime. Left empty, no extension is referenced at all.
   */
  extensionWidgetType: viteEnv.EMBED_EXTENSION_WIDGET ?? '',
  datasetId: Number(viteEnv.FILTER_DATASET_ID ?? 17),
  // The dataset's shape. Defaults describe Superset's own `birth_names`
  // example; point the app at another dataset and these are what you change.
  // `filterColumn` doubles as the dimension the charts group by — the host
  // filter only narrows them if they are grouped by the column it filters.
  filterColumn: viteEnv.FILTER_COLUMN ?? 'state',
  filterValues: list(viteEnv.FILTER_VALUES),
  metric: viteEnv.EMBED_METRIC ?? 'sum__num',
  /** A numeric column, for the ad hoc aggregate the saved metric demo contrasts with. */
  metricColumn: viteEnv.EMBED_METRIC_COLUMN ?? 'num',
  secondMetric: viteEnv.EMBED_SECOND_METRIC ?? 'count',
  /** A low-cardinality column, for the pie and the scoped filter. */
  category: viteEnv.EMBED_CATEGORY ?? 'gender',
  categoryValues: list(viteEnv.EMBED_CATEGORY_VALUES || 'boy,girl'),
  /** A high-cardinality column, for the table's rows. */
  label: viteEnv.EMBED_LABEL ?? 'name',
};

export async function fetchGuestToken(): Promise<string> {
  const response = await fetch('/api/guest-token', { method: 'POST' });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Token broker responded ${response.status}: ${body}`);
  }
  return body;
}

interface DatasetColumn {
  column_name: string;
  type_generic?: number;
}

const NUMERIC = 0;
const STRING = 1;

async function read<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(`${config.supersetUrl}${path}`, {
      mode: 'cors',
      credentials: 'include',
    });
    if (!response.ok) return undefined;
    return ((await response.json()) as { result: T }).result;
  } catch {
    return undefined;
  }
}

/** Distinct values of a column, through the widget API rather than the dataset API. */
async function valuesOf(column: string): Promise<string[]> {
  try {
    const response = await fetch(`${config.supersetUrl}/api/v1/widget/values`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widget: {
          type: 'filter.select',
          props: { datasetId: config.datasetId, column },
        },
      }),
    });
    if (!response.ok) return [];
    const { result } = (await response.json()) as { result: unknown[] };
    return result.slice(0, 5).map(String);
  } catch {
    return [];
  }
}

/**
 * Points the demo at a dataset that can actually answer it.
 *
 * Example dataset ids shift every time the examples are reloaded, and a
 * widget asking for a column its dataset does not have fails its query — so
 * the values above are a preference, not a promise. Whatever the dataset
 * turns out to hold wins. Guests cannot read the dataset API, so guest mode
 * keeps the configured values and relies on them being right.
 */
export async function resolveDatasetShape(): Promise<void> {
  if (config.authMode === 'guest') return;

  const wanted = viteEnv.FILTER_DATASET_TABLE ?? 'birth_names';
  const query = `(filters:!((col:table_name,opr:eq,value:${wanted})),columns:!(id,table_name))`;
  const found = await read<{ id: number }[]>(
    `/api/v1/dataset/?q=${encodeURIComponent(query)}`,
  );
  if (found?.length) config.datasetId = found[0].id;

  const dataset = await read<{
    columns: DatasetColumn[];
    metrics: { metric_name: string }[];
  }>(`/api/v1/dataset/${config.datasetId}`);
  if (!dataset) return;

  const named = (generic: number) =>
    dataset.columns
      .filter(column => column.type_generic === generic)
      .map(column => column.column_name);
  const strings = named(STRING);
  const numbers = named(NUMERIC);
  const metrics = dataset.metrics.map(entry => entry.metric_name);
  const keep = <T,>(value: T, available: T[], fallback: T | undefined) =>
    available.includes(value) ? value : (fallback ?? value);

  const dimension = keep(config.filterColumn, strings, strings[0]);
  if (dimension !== config.filterColumn) {
    config.filterColumn = dimension;
    config.filterValues = await valuesOf(dimension);
  }
  const category = keep(
    config.category,
    strings,
    strings.find(column => column !== dimension) ?? strings[0],
  );
  if (category !== config.category) {
    config.category = category;
    config.categoryValues = await valuesOf(category);
  }
  config.label = keep(
    config.label,
    strings,
    strings.find(column => column !== dimension && column !== category) ??
      dimension,
  );
  config.metricColumn = keep(config.metricColumn, numbers, numbers[0]);
  config.metric = keep(
    config.metric,
    metrics,
    metrics.find(name => name !== 'count') ?? metrics[0],
  );
  config.secondMetric = keep(
    config.secondMetric,
    metrics,
    metrics.includes('count') ? 'count' : metrics[0],
  );
}
