#!/bin/env node

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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* eslint-disable no-console */
/**
 * Build packages/plugins filtered by globs
 */
process.env.PATH = `./node_modules/.bin:${process.env.PATH}`;

const { spawnSync } = require('child_process');
const fastGlob = require('fast-glob');
const { argv } = require('yargs');

const { _: globs } = argv;
const glob = globs.length > 1 ? `{${globs.join(',')}}` : globs[0] || '*';

const BABEL_CONFIG = '--config-file=../../babel.config.js';

// packages that do not need tsc
const META_PACKAGES = new Set(['demo', 'generator-superset']);

function run(cmd, options) {
  console.log(`\n>> ${cmd}\n`);
  const [p, ...args] = cmd.split(' ');
  const runner = spawnSync;
  const { status } = runner(p, args, { stdio: 'inherit', ...options });
  if (status !== 0) {
    process.exit(status);
  }
}

function getPackages(packagePattern, tsOnly = false) {
  let pattern = packagePattern;
  if (pattern === '*' && !tsOnly) {
    return `{@superset-ui/!(${[...META_PACKAGES].join('|')}),@apache-superset/*}`;
  }
  if (!pattern.includes('*')) {
    pattern = `*${pattern}`;
  }

  // Find packages in both @superset-ui and @apache-superset scopes
  const supersetUiPackages = [
    ...new Set(
      fastGlob
        .sync([
          `./node_modules/@superset-ui/${pattern}/src/**/*.${
            tsOnly ? '{ts,tsx}' : '{ts,tsx,js,jsx}'
          }`,
        ])
        .map(x => x.split('/')[3])
        .filter(x => !META_PACKAGES.has(x)),
    ),
  ];

  const apachePackages = [
    ...new Set(
      fastGlob
        .sync([
          `./node_modules/@apache-superset/${pattern}/src/**/*.${
            tsOnly ? '{ts,tsx}' : '{ts,tsx,js,jsx}'
          }`,
        ])
        .map(x => x.split('/')[3]),
    ),
  ];

  const allScopes = [];
  if (supersetUiPackages.length > 0) {
    allScopes.push(
      `@superset-ui/${
        supersetUiPackages.length > 1
          ? `{${supersetUiPackages.join(',')}}`
          : supersetUiPackages[0]
      }`,
    );
  }
  if (apachePackages.length > 0) {
    allScopes.push(
      `@apache-superset/${
        apachePackages.length > 1
          ? `{${apachePackages.join(',')}}`
          : apachePackages[0]
      }`,
    );
  }

  if (allScopes.length === 0) {
    throw new Error('No matching packages');
  }

  return allScopes.length > 1 ? `{${allScopes.join(',')}}` : allScopes[0];
}

let scope = getPackages(glob);

console.log('--- Run babel --------');
const babelCommand = `lerna exec --stream --concurrency 10 --scope ${scope}
        -- babel ${BABEL_CONFIG} src --extensions ".ts,.tsx,.js,.jsx" --copy-files`;
run(`${babelCommand} --out-dir lib`);

console.log('--- Run babel esm ---');
// run again with
run(`${babelCommand} --out-dir esm`, {
  env: { ...process.env, NODE_ENV: 'production', BABEL_OUTPUT: 'esm' },
});

console.log('--- Run tsc ---');
// only run tsc for packages with ts files
scope = getPackages(glob, true);
run(`lerna exec --stream --concurrency 3 --scope ${scope} \
      -- ../../scripts/tsc.sh --build`);
