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
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'dist', 'index.html');
const bytes = statSync(out).size;
const kib = (bytes / 1024).toFixed(1);
const mib = (bytes / (1024 * 1024)).toFixed(2);
// ---- Budget policy -------------------------------------------------------
//
// The widget ships as ONE self-contained HTML file with everything inlined,
// so its size is the whole cost of a render. These numbers are measured:
//
//   ~870 KiB   today (React + ECharts + our code)
//   +359 KiB   five of Superset's real transformProps, measured in a throwaway
//              bundle with react/react-dom/echarts already present
//   ~16 KiB    marginal cost of each ADDITIONAL chart type after the first —
//              the ~290 KiB of shared @superset-ui/core is paid once
//
// That projects to ~1.23 MiB. HARD_LIMIT sits above it with room for roughly
// ten more chart types, and below the 1.5 MiB the hosts make practical — so a
// cliff is a failed build here rather than a discovery in a chat window.
const HARD_LIMIT = 1.4 * 1024 * 1024;

// One chart type's worth of growth. A commit adding more than this is either
// pulling in a new shared dependency or doing something unintended; either way
// it deserves a decision rather than a silent slide.
const STEP_WARN = 24 * 1024;

const BASELINE_FILE = join(here, '..', '.size-baseline.json');
let baseline = null;
try {
  baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8')).bytes;
} catch {
  /* no baseline recorded yet */
}

const over = bytes > HARD_LIMIT;
console.log(
  `\n  dist/index.html = ${bytes} bytes (${kib} KiB / ${mib} MiB) — ` +
    (over
      ? `OVER the ${(HARD_LIMIT / 1024 / 1024).toFixed(2)}MiB hard limit`
      : `OK (limit ${(HARD_LIMIT / 1024 / 1024).toFixed(2)}MiB)`),
);

if (baseline !== null) {
  const delta = bytes - baseline;
  console.log(
    `  vs baseline: ${delta >= 0 ? '+' : ''}${(delta / 1024).toFixed(1)} KiB`,
  );
  if (delta > STEP_WARN) {
    console.log(
      `\n  NOTE: grew by more than one chart type's worth (${(STEP_WARN / 1024).toFixed(0)} KiB).\n` +
        `  If intended, update .size-baseline.json in the same commit and say why.\n`,
    );
  }
}

if (over) {
  console.error(
    `\n  BUILD FAILED: bundle exceeds ${(HARD_LIMIT / 1024).toFixed(0)} KiB.\n` +
      `  Every byte is downloaded before a chart appears. Remove weight, or\n` +
      `  raise HARD_LIMIT deliberately with a measurement behind it.\n`,
  );
  process.exit(1);
}
