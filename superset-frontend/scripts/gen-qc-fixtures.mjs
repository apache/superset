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

// Generates a minimal-but-valid form_data fixture + frontend golden for every viz
// type in the generated REGISTRY, by actually running each plugin's buildQuery under
// Node's V8. A viz is COVERED if its builder returns a real query_context on the base
// form_data; otherwise it's honestly SKIPPED (reason recorded) — never faked.
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FEX = 'src/backend-querycontext/__fixtures__';

const res = await build({
  entryPoints: ['src/backend-querycontext/entry.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const shim = (k, v) => {
  try {
    if (globalThis[k] === undefined) globalThis[k] = v;
  } catch {
    /* read-only builtin */
  }
};
shim('self', globalThis);
shim('window', globalThis);
shim('navigator', { userAgent: 'superset-fixtures-node' });
shim('document', {});
const mod = { exports: {} };
// eslint-disable-next-line no-new-func -- evaluating our own freshly built bundle
const load = new Function(
  'module',
  'exports',
  'require',
  res.outputFiles[0].text,
);
load(mod, mod.exports, require);
const gen = mod.exports.generateQueryContext;
const VIZ_TYPES = mod.exports.VIZ_TYPES || globalThis.SUPERSET_QC_VIZ_TYPES;

// A deliberately broad base form_data — each plugin's buildQuery reads the fields it
// needs and ignores the rest. Family-specific fields are all populated so most
// builders find what they require without per-viz hand-tuning.
const baseFor = (viz) => ({
  datasource: '1__table',
  viz_type: viz,
  metric: 'count',
  metrics: ['count'],
  groupby: ['gender'],
  columns: ['gender'],
  all_columns: ['gender', 'name'],
  entity: 'gender',
  series: 'gender',
  series_columns: ['gender'],
  x_axis: 'ds',
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: 'No filter',
  row_limit: 100,
  adhoc_filters: [],
  // graph/sankey/tree
  source: 'gender',
  target: 'name',
  source_category: 'gender',
  target_category: 'name',
  // heatmap
  x_axis_column: 'gender',
  y_axis: 'name',
  // bubble
  x: 'count',
  y: 'count',
  size: 'count',
  // histogram
  column: 'num',
  // mixed timeseries second query
  metrics_b: ['count'],
  groupby_b: ['gender'],
  adhoc_filters_b: [],
});

mkdirSync(`${FEX}/formdata`, { recursive: true });
mkdirSync(`${FEX}/expected`, { recursive: true });

const covered = [];
const skipped = [];
for (const viz of VIZ_TYPES) {
  const fd = baseFor(viz);
  let out;
  try {
    out = JSON.parse(gen(viz, JSON.stringify(fd)));
  } catch (e) {
    skipped.push([viz, `threw: ${String(e).slice(0, 120)}`]);
    continue;
  }
  if (!out || out.__unsupported__ || out.__error__) {
    skipped.push([viz, out && out.__error__ ? `builder error: ${String(out.__error__).slice(0, 140)}` : 'unsupported']);
    continue;
  }
  if (!Array.isArray(out.queries) || out.queries.length === 0) {
    skipped.push([viz, 'no queries produced']);
    continue;
  }
  writeFileSync(`${FEX}/formdata/${viz}.json`, `${JSON.stringify(fd, null, 2)}\n`);
  writeFileSync(`${FEX}/expected/${viz}.json`, `${JSON.stringify(out, null, 2)}\n`);
  covered.push(viz);
}

console.log(`REGISTRY viz types: ${VIZ_TYPES.length}`);
console.log(`COVERED (fixture+golden written): ${covered.length}`);
console.log(`  ${covered.join(', ')}`);
console.log(`SKIPPED (base form_data insufficient): ${skipped.length}`);
for (const [v, r] of skipped) console.log(`  - ${v}: ${r}`);
