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

const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');

describe('generator-superset:package', () => {
  let dir;

  beforeAll(() => {
    dir = process.cwd();
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

  describe('typescript', () => {
    beforeAll(() =>
      helpers
        .run(path.join(__dirname, '../generators/package'))
        .withPrompts({ name: 'my-package', language: 'typescript' })
        .withOptions({ skipInstall: true }),
    );

    it('creates files', () => {
      assert.file(['package.json', 'README.md', 'src/index.ts', 'test/index.test.ts']);
    });
  });

  describe('javascript', () => {
    beforeAll(() =>
      helpers
        .run(path.join(__dirname, '../generators/package'))
        .withPrompts({ name: 'my-package', language: 'javascript' })
        .withOptions({ skipInstall: true }),
    );

    it('creates files', () => {
      assert.file(['package.json', 'README.md', 'src/index.js', 'test/index.test.js']);
    });
  });
});
