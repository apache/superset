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
