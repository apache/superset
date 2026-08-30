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

import { fileURLToPath } from 'node:url';
import { main } from './internal/bundle-size-summary';

const __filename = fileURLToPath(import.meta.url);

if (__filename === process.argv[1]) {
  main();
}
