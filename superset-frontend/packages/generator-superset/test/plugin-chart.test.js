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

/* eslint-env node */
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');

describe('generator-superset:plugin-chart', () => {
  let dir;

  beforeAll(() => {
    dir = process.cwd();

    return helpers
      .run(path.join(__dirname, '../generators/plugin-chart'))
      .withPrompts({ packageName: 'cold-map', description: 'Cold Map' })
      .withOptions({ skipInstall: true });
  });

  /*
   * Change working directory back to original working directory
   * after the test has completed.
   * yeoman tests switch to tmp directory and write files there.
   * Usually this is fine for solo package.
   * However, for a monorepo like this one,
   * it made jest confuses with current directory
   * (being in tmp directory instead of superset-ui root)
   * and interferes with other tests in sibling packages
   * that are run after the yeoman tests.
   */
  afterAll(() => {
    process.chdir(dir);
  });

  it('creates files', () => {
    assert.file([
      'package.json',
      'README.md',
      'src/plugin/buildQuery.ts',
      'src/plugin/controlPanel.ts',
      'src/plugin/index.ts',
      'src/plugin/transformProps.ts',
      'src/ColdMap.tsx',
      'src/index.ts',
      'test/index.test.ts',
      'test/plugin/buildQuery.test.ts',
      'test/plugin/transformProps.test.ts',
      'types/external.d.ts',
      'src/images/thumbnail.png',
    ]);
  });
});
