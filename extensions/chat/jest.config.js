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
const path = require('path');

// When run as a standalone package (`cd extensions/chat && npm test`), modules
// resolve from this folder's own node_modules. When run from the superset-frontend
// workspace (CI, dev convenience), resolve ts-jest there too.
const tsJest = (() => {
  try {
    require.resolve('ts-jest');
    return 'ts-jest';
  } catch {
    return path.resolve(
      __dirname,
      '..',
      '..',
      'superset-frontend',
      'node_modules',
      'ts-jest',
    );
  }
})();

module.exports = {
  testEnvironment: 'jsdom',
  rootDir: __dirname,
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // When running from the extension folder without node_modules installed,
  // resolve react / react-dom from the superset-frontend workspace.
  modulePaths: [path.resolve(__dirname, '..', '..', 'superset-frontend', 'node_modules')],
  moduleNameMapper: {
    '^@apache-superset/core$': '<rootDir>/src/__tests__/sdkMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [tsJest, { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
