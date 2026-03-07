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

import {spawnSync} from 'child_process';

// When launching the docusaurus CLI we want to ensure Node has sufficient
// heap space. In CI we cap at 4GB (4096) to avoid hitting runner limits,
// whereas local development gets 8GB by default. This logic mirrors the
// hardcoded values previously used in package.json scripts.
//
// Usage: `node scripts/docusaurus.mjs <command> [args...]` which is
// equivalent to running `docusaurus <command> [args...]` with the proper
// NODE_OPTIONS value injected.

// Docusaurus Faster: Rspack bundler, SWC transpilation, and other build
// optimizations. Only enabled for local development — CI runners (GitHub
// Actions, Netlify) have ~8GB RAM and these features push memory usage over
// the limit. See https://docusaurus.io/blog/releases/3.6#docusaurus-faster
const isCI = process.env.CI === 'true';

const defaultHeap = isCI ? 4096 : 8192;
if (!process.env.NODE_OPTIONS?.includes('--max-old-space-size')) {
  process.env.NODE_OPTIONS = `--max-old-space-size=${defaultHeap}`;
}

// Forward all arguments to the real docusaurus CLI.  We use `npx` to ensure
// the local copy is executed when the repo is installed via yarn/npm.
const args = process.argv.slice(2);
const result = spawnSync('npx', ['docusaurus', ...args], { stdio: 'inherit' });
process.exit(result.status);
