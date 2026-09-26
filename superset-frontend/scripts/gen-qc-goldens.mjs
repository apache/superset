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

// Records frontend query_context goldens by running the SAME buildQuery entry
// under Node's V8 (independent of the backend mini-racer runtime). Pure buildQuery
// logic → identical output to the browser. Writes __fixtures__/expected/<stem>.json.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
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
const code = res.outputFiles[0].text;
// Same minimal browser-global shims the backend mini-racer runner injects — the
// browser-target bundle touches `window`/`self` at module load.
const shim = (k, v) => {
  try {
    if (globalThis[k] === undefined) globalThis[k] = v;
  } catch {
    /* read-only builtin (e.g. Node's navigator) — leave it */
  }
};
shim('self', globalThis);
shim('window', globalThis);
shim('navigator', { userAgent: 'superset-goldens-node' });
shim('document', {});
const mod = { exports: {} };
// eslint-disable-next-line no-new-func -- evaluating our own freshly built bundle
const load = new Function('module', 'exports', 'require', code);
load(mod, mod.exports, require);
const gen = mod.exports.generateQueryContext || globalThis.generateQueryContext;
if (typeof gen !== 'function') throw new Error('generateQueryContext not found in bundle');

mkdirSync(`${FEX}/expected`, { recursive: true });
for (const f of readdirSync(`${FEX}/formdata`)) {
  if (!f.endsWith('.json')) continue;
  const stem = f.replace(/\.json$/, '');
  const fdJson = readFileSync(`${FEX}/formdata/${f}`, 'utf8');
  const outStr = gen(stem, fdJson);
  const parsed = JSON.parse(outStr);
  if (parsed && (parsed.__unsupported__ || parsed.__error__)) {
    throw new Error(`golden gen failed for ${stem}: ${outStr}`);
  }
  writeFileSync(
    `${FEX}/expected/${stem}.json`,
    `${JSON.stringify(parsed, null, 2)}\n`,
  );
  console.log(`golden recorded: ${stem} (queries=${(parsed.queries || []).length})`);
}
