#!/usr/bin/env node
/*
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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied.  See the License for the specific language governing
 * permissions and limitations under the License.
 */

// Reduces a webpack `--json` stats file down to the handful of headline
// numbers worth tracking over time, in the flat array format
// benchmark-action/github-action-benchmark expects for its
// "customSmallerIsBetter" tool. The full stats file also includes a
// `modules`/`chunks` graph across ~15k modules, which is enormous and not
// useful for this purpose, so we only ever read `entrypoints`.
//
// Usage: node scripts/bundle-size-summary.js <path-to-stats.json>

const fs = require('fs');

// Entrypoints worth tracking: the two user-facing app shells. `menu`,
// `preamble`, `theme`, and `service-worker` are small, low-variance
// infrastructure chunks, not where bundle bloat actually shows up.
const TRACKED_ENTRYPOINTS = ['spa', 'embedded'];

function entrypointSizeByExt(entrypoint, ext) {
  return (entrypoint.assets || [])
    .filter(asset => asset.name.endsWith(ext))
    .reduce((total, asset) => total + asset.size, 0);
}

function main() {
  const statsPath = process.argv[2];
  if (!statsPath) {
    console.error('Usage: bundle-size-summary.js <path-to-stats.json>');
    process.exit(1);
  }

  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  const { entrypoints } = stats;
  if (!entrypoints) {
    console.error(
      'stats.json has no `entrypoints` key -- was it built with ' +
        '`BUNDLE_SIZE_STATS=true` set? Without it, webpack.config.js uses ' +
        '`stats: "minimal"`, which omits `entrypoints`.',
    );
    process.exit(1);
  }

  const results = [];
  TRACKED_ENTRYPOINTS.forEach(name => {
    const entrypoint = entrypoints[name];
    if (!entrypoint) {
      console.error(`stats.json is missing the "${name}" entrypoint`);
      process.exit(1);
    }
    results.push({
      name: `${name} entrypoint (JS)`,
      unit: 'bytes',
      value: entrypointSizeByExt(entrypoint, '.js'),
    });
    results.push({
      name: `${name} entrypoint (CSS)`,
      unit: 'bytes',
      value: entrypointSizeByExt(entrypoint, '.css'),
    });
  });

  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { entrypointSizeByExt, main, TRACKED_ENTRYPOINTS };
