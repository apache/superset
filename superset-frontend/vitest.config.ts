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
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    svgr({
      svgrOptions: {
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
  ],
  test: {
    globals: true,
    env: {
      // Timezone for unit tests
      TZ: 'America/New_York',
      WEBPACK_MODE: 'test',
    },
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    setupFiles: [path.resolve(__dirname, './spec/helpers/setup.ts')],
    include: ['./(spec|src|plugins|packages|tools)/**/*.test.ts?(x)'],
    exclude: [
      './packages/generator-superset',
      './packages/**/esm',
      './packages/**/lib',
      './plugins/**/esm',
      './plugins/**/lib',
    ],
    reporters: ['default'],
    maxWorkers: '80%',
    coverage: {
      enabled: false,
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
    alias: [
      // {
      //   find: new RegExp('\.(css|less|geojson)$'),
      //   replacement: path.resolve(
      //     __dirname,
      //     './spec/__mocks__/mockExportObject.js',
      //   ),
      // },
      // {
      //   find: new RegExp('\.(gif|ttf|eot|png|jpg)$'),
      //   replacement: path.resolve(
      //     __dirname,
      //     './spec/__mocks__/mockExportString.js',
      //   ),
      // },
      {
        find: new RegExp('^src/(.*)$'),
        replacement: path.resolve(__dirname, './src/$1'),
      },
      // Mapping plugins of superset-ui to source code
      {
        find: new RegExp('^@superset-ui/([^/]+)/(.*)$'),
        replacement: path.resolve(
          __dirname,
          './node_modules/@superset-ui/$1/src/$2',
        ),
      },
      {
        find: new RegExp('^@superset-ui/([^/]+)$'),
        replacement: path.resolve(
          __dirname,
          './node_modules/@superset-ui/$1/src',
        ),
      },
      // Mapping @apache-superset/core to local package
      {
        find: new RegExp('^@apache-superset/core$'),
        replacement: path.resolve(__dirname, './packages/superset-core/src'),
      },
      {
        find: new RegExp('^@apache-superset/core/(.*)$'),
        replacement: path.resolve(__dirname, './packages/superset-core/src/$1'),
      },
    ],
  },
});
