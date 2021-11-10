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

module.exports = {
  bail: false,
  collectCoverageFrom: [
    '**/src/**/*.{ts,tsx,js,jsx}',
    '**/test/**/*.{ts,tsx,js,jsx}',
  ],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    'coverage/',
    'node_modules/',
    'public/',
    'esm/',
    'lib/',
    'tmp/',
    'dist/',
  ],
  coverageReporters: ['lcov', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  globals: {
    __DEV__: true,
    caches: true,
  },
  moduleFileExtensions: ['mock.js', 'ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '\\.(css|less|geojson)$': '<rootDir>/test/__mocks__/mockExportObject.js',
    '\\.(gif|ttf|eot|png|jpg)$': '<rootDir>/test/__mocks__/mockExportString.js',
    '\\.svg$': '<rootDir>/test/__mocks__/svgrMock.tsx',
    '@superset-ui/(((?!(legacy-preset-chart-deckgl|core/src)).)*)$':
      '<rootDir>/node_modules/@superset-ui/$1/src',
    '@superset-ui/core/src/(.*)$':
      '<rootDir>/node_modules/@superset-ui/core/src/$1',
  },
  roots: ['<rootDir>/packages', '<rootDir>/plugins'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  testEnvironment: 'jsdom',
  testURL: 'http://localhost',
  timers: 'real',
  verbose: false,
  transformIgnorePatterns: ['node_modules/(?!(vega-lite|lodash-es))'],
  testPathIgnorePatterns: ['packages/generator-superset/generators'],
  projects: [
    '<rootDir>',
    {
      displayName: 'node',
      rootDir: '<rootDir>/packages/generator-superset',
      testMatch: ['<rootDir>/test/**/?(*.)+(spec|test).{js,jsx,ts,tsx}'],
      testEnvironment: 'node',
    },
  ],
  snapshotSerializers: ['@emotion/jest/enzyme-serializer'],
};
