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
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    // The runtime implementation is injected by the Superset host via module
    // federation; tests use a controllable in-memory mock.
    '^@apache-superset/core$': '<rootDir>/test/coreMock.tsx',
    // @ant-design/icons requires ESM paths from @ant-design/colors that
    // jest cannot parse; point them at the CJS build.
    '^@ant-design/colors/es/(.*)$': '@ant-design/colors/lib/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    // Transpile-only: full type-checking runs separately via `npm run type`
    // (checking antd v6's types per worker exhausts the heap).
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.test.json', isolatedModules: true },
    ],
  },
};
