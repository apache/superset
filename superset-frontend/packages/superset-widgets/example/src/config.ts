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
  filterColumn: viteEnv.FILTER_COLUMN ?? 'state',
  filterValues: list(viteEnv.FILTER_VALUES),
};

export async function fetchGuestToken(): Promise<string> {
  const response = await fetch('/api/guest-token', { method: 'POST' });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Token broker responded ${response.status}: ${body}`);
  }
  return body;
}
