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
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'cypress';

export default defineConfig({
  chromeWebSecurity: false,
  defaultCommandTimeout: 8000,
  numTestsKeptInMemory: 0,
  experimentalFetchPolyfill: true,
  requestTimeout: 10000,
  video: false,
  videoUploadOnPasses: false,
  viewportWidth: 1280,
  viewportHeight: 1024,
  projectId: 'ukwxzo',
  retries: {
    runMode: 2,
    openMode: 0,
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // eslint-disable-next-line global-require,import/extensions
      return require('./cypress/plugins/index.js')(on, config);
    },
    baseUrl: 'http://localhost:8088',
    excludeSpecPattern: ['**/*.applitools.test.ts'],
    specPattern: ['cypress/e2e/**/*.{js,jsx,ts,tsx}'],
  },
});
