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
import { spawnSync } from 'node:child_process';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn(() => ({ status: 0 })),
}));

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  globSync: jest.fn(() => ['node_modules/@superset-ui/core/src/index.ts']),
}));

jest.mock('yargs', () => () => ({ parse: () => ({}) }));
jest.mock('yargs/helpers', () => ({
  hideBin: (args: string[]) => args.slice(2),
}));

test('builds both module formats with clean scope and extension arguments', () => {
  const originalPath = process.env.PATH;
  try {
    require('../../scripts/build.js');
  } finally {
    process.env.PATH = originalPath;
  }

  expect(spawnSync).toHaveBeenCalledTimes(3);
  const babelArgs = [
    'exec',
    '--stream',
    '--concurrency',
    '10',
    '--scope',
    '{@superset-ui/!(demo|generator-superset),@apache-superset/*}',
    '--',
    'babel',
    '--config-file=../../babel.config.js',
    'src',
    '--extensions',
    '.ts,.tsx,.js,.jsx',
    '--copy-files',
    '--out-dir',
  ];
  const { calls } = jest.mocked(spawnSync).mock;
  expect(calls.map(([program, args]) => ({ program, args }))).toEqual([
    { program: 'lerna', args: [...babelArgs, 'lib'] },
    { program: 'lerna', args: [...babelArgs, 'esm'] },
    {
      program: 'lerna',
      args: [
        'exec',
        '--stream',
        '--concurrency',
        '3',
        '--scope',
        '{@superset-ui/core,@apache-superset/core}',
        '--',
        '../../scripts/tsc.sh',
        '--build',
      ],
    },
  ]);
  expect(calls[1][2]?.env?.NODE_ENV).toBe('production');
  expect(calls[1][2]?.env?.BABEL_OUTPUT).toBe('esm');
});
