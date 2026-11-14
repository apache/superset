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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runBuild(args: string[], sharedBuildFails = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'plugin-build-'));
  try {
    const bin = path.join(directory, 'node_modules/.bin');
    const source = path.join(
      directory,
      'node_modules/@superset-ui/plugin-example/src',
    );
    mkdirSync(bin, { recursive: true });
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'index.ts'), 'export {};');
    // Simulate a shared compiler that publishes declarations only on success.
    writeFileSync(
      path.join(bin, 'tsc'),
      sharedBuildFails
        ? '#!/bin/sh\nexit 23\n'
        : '#!/bin/sh\ntouch shared-ready\n',
      { mode: 0o755 },
    );
    // A plugin must not start a reference build while shared outputs are absent.
    writeFileSync(
      path.join(bin, 'lerna'),
      `#!/bin/sh
case "$*" in
  *tsc.sh*)
    touch plugin-started
    test -f shared-ready || exit 42
    ;;
esac
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../../scripts/build.js'), ...args],
      { cwd: directory, encoding: 'utf8' },
    );
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      pluginStarted: existsSync(path.join(directory, 'plugin-started')),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test.each([
  { args: [] },
  { args: ['--skip-lib'] },
  { args: ['--globs', 'plugin-example', '--globs', 'chart-unused'] },
])(
  'finishes shared declarations before parallel plugins with args $args',
  ({ args }) => {
    const result = runBuild(args);
    expect(result).toEqual({
      status: 0,
      output: expect.any(String),
      pluginStarted: true,
    });
  },
);

test('stops before parallel plugins if shared compilation fails', () => {
  const result = runBuild(['--skip-lib'], true);
  expect(result.status).toBe(23);
  expect(result.pluginStarted).toBe(false);
});
