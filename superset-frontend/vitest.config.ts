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

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: {
      // Timezone for unit tests
      TZ: 'America/New_York',
      WEBPACK_MODE: 'test',
    },
    environment: 'jsdom',
    include: ['./(spec|src|plugins|packages|tools)/**/*.test.ts'],
    exclude: [
      './packages/generator-superset',
      './packages/**/esm',
      './packages/**/lib',
      './plugins/**/esm',
      './plugins/**/lib',
    ],
    reporters: ['default'],
    coverage: {
      enabled: true,
      clean: true,
      reportsDirectory: './coverage',
      reporter: ['lcov', 'json-summary', 'html', 'text'],
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        '{packages,plugins}/**/src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        '**/*.stories.*',
        'coverage/',
        'node_modules/',
        'public/',
        'tmp/',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '\.(css|less|geojson)$': path.resolve(
        __dirname,
        './spec/__mocks__/mockExportObject.js',
      ),
      '\.(gif|ttf|eot|png|jpg)$': path.resolve(
        __dirname,
        './spec/__mocks__/mockExportString.js',
      ),
      '\.svg$': path.resolve(__dirname, './spec/__mocks__/svgrMock.tsx'),
      src: path.resolve(__dirname, './src'),
      // Mapping plugins of superset-ui to source code
      '@superset-ui': path.resolve(__dirname, './node_modules/@superset-ui'),
      // Mapping @apache-superset/core to local package
      '@apache-superset/core': path.resolve(
        __dirname,
        './node_modules/superset-core',
      ),
    },
  },
});
