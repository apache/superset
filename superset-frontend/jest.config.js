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

module.exports = {
  testRegex: '\\/(spec|src|plugins|packages)\\/.*(_spec|\\.test)\\.[jt]sx?$',
  testPathIgnorePatterns: [
    'packages\\/generator-superset\\/.*',
    '/node_modules/',
  ],
  moduleNameMapper: {
    '\\.(css|less|geojson)$': '<rootDir>/spec/__mocks__/mockExportObject.js',
    '\\.(gif|ttf|eot|png|jpg)$': '<rootDir>/spec/__mocks__/mockExportString.js',
    '\\.svg$': '<rootDir>/spec/__mocks__/svgrMock.tsx',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^spec/(.*)$': '<rootDir>/spec/$1',
    // mapping to souce code instead of lib or esm module
    '@superset-ui/(((?!(legacy-preset-chart-deckgl|core/src)).)*)$':
      '<rootDir>/node_modules/@superset-ui/$1/src',
    '@superset-ui/core/src/(.*)$':
      '<rootDir>/node_modules/@superset-ui/core/src/$1',
  },
  testEnvironment: 'jsdom',
  modulePathIgnorePatterns: ['<rootDir>/temporary_superset_ui'],
  setupFilesAfterEnv: ['<rootDir>/spec/helpers/setup.ts'],
  testURL: 'http://localhost',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '{packages,plugins}/**/src/**/*.{js,jsx,ts,tsx}',
    '!**/*.stories.*',
    '!packages/superset-ui-demo/**/*',
  ],
  coverageDirectory: '<rootDir>/coverage/',
  coveragePathIgnorePatterns: [
    'coverage/',
    'node_modules/',
    'public/',
    'tmp/',
    'dist/',
  ],
  coverageReporters: ['lcov', 'json-summary', 'html'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    // ts-jest can't load plugin 'babel-plugin-typescript-to-proptypes'
    'reactify\\.tsx$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  snapshotSerializers: ['@emotion/jest/enzyme-serializer'],
  globals: {
    'ts-jest': {
      babelConfig: true,
      // todo: duo to packages/**/test and plugins/**/test lack of type checking
      // turning off checking in Jest.
      // https://kulshekhar.github.io/ts-jest/docs/getting-started/options/isolatedModules
      isolatedModules: true,
      diagnostics: {
        warnOnly: true,
      },
    },
    __DEV__: true,
    caches: true,
  },
};
