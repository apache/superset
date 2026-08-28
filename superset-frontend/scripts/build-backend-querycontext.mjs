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
 * Bundle the backend query-context entry (superset #33615) into a single,
 * self-contained IIFE that the Python backend evaluates in V8 (py_mini_racer)
 * to run the real frontend `buildQuery`. Output is a build artifact consumed by
 * `superset/commands/chart/query_context_generator.py`.
 *
 * Run: `npm run build:backend-querycontext` (from superset-frontend/).
 *
 * NOTE: the bundle targets `browser`, so it may reference browser globals
 * (self/window/navigator) at load. Do NOT add DOM shims here — the Python
 * runner injects the minimal globals V8 needs before evaluating the bundle.
 */
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const entry = path.resolve(__dirname, '..', 'src', 'backend-querycontext', 'entry.ts');
const outfile = path.resolve(
  repoRoot,
  'superset',
  'commands',
  'chart',
  '_bundles',
  'query_context_bundle.js',
);

mkdirSync(path.dirname(outfile), { recursive: true });

build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  globalName: 'SupersetQC',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'info',
  // `buildQuery` modules are pure query logic, but they are reached through
  // barrel imports that transitively pull in non-JS assets (fonts, CSS, SVGs,
  // images) from the theme/UI layer. The backend runs only `generateQueryContext`
  // in V8 and never renders any of that, so drop those assets with the `empty`
  // loader instead of failing to bundle. (esbuild infers the `ts` loader from the
  // .ts extension; these modules are pure TS, no JSX.)
  loader: {
    '.css': 'empty',
    '.svg': 'empty',
    '.png': 'empty',
    '.jpg': 'empty',
    '.jpeg': 'empty',
    '.gif': 'empty',
    '.woff': 'empty',
    '.woff2': 'empty',
    '.ttf': 'empty',
    '.eot': 'empty',
  },
})
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`[backend-querycontext] bundled -> ${outfile}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[backend-querycontext] build failed:', err);
    process.exit(1);
  });
