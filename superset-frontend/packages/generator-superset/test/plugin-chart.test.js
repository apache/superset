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

import { dirname, join } from 'path';
import helpers, { result } from 'yeoman-test';
import { copySync } from 'fs-extra/esm';
import { fileURLToPath } from 'url';
import pluginChartModule from '../generators/plugin-chart';

test('generator-superset:plugin-chart:creates files', async () => {
  await helpers
    .run(pluginChartModule)
    .onTargetDirectory(dir => {
      // `dir` is the path to the new temporary directory
      const generatorDirname = dirname(fileURLToPath(import.meta.url));
      copySync(
        join(generatorDirname, '../generators/plugin-chart/templates'),
        join(dir, 'unknown/templates'),
      );
    })
    .withPrompts({
      packageName: 'cold-map',
      description: 'Cold Map',
      componentType: 'function',
      chartType: 'regular',
    })
    .withOptions({ skipInstall: true });

  result.assertFile([
    '.gitignore',
    'babel.config.js',
    'jest.config.js',
    'package.json',
    'README.md',
    'src/plugin/buildQuery.ts',
    'src/plugin/controlPanel.ts',
    'src/plugin/index.ts',
    'src/plugin/transformProps.ts',
    'src/ColdMap.tsx',
    'src/index.ts',
    'test/index.test.ts',
    'test/__mocks__/mockExportString.js',
    'test/plugin/buildQuery.test.ts',
    'test/plugin/transformProps.test.ts',
    'types/external.d.ts',
    'src/images/thumbnail.png',
  ]);
});
