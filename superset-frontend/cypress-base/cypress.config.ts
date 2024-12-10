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
import eyesPlugin from '@applitools/eyes-cypress';

const { verifyDownloadTasks } = require('cy-verify-downloads');

export default eyesPlugin(
  defineConfig({
    chromeWebSecurity: false,
    defaultCommandTimeout: 8000,
    numTestsKeptInMemory: 0,
    experimentalFetchPolyfill: true,
    experimentalMemoryManagement: true,
    requestTimeout: 10000,
    video: false,
    viewportWidth: 1280,
    viewportHeight: 1024,
    projectId: 'ud5x2f',
    retries: {
      runMode: 2,
      openMode: 0,
    },
    e2e: {
      // We've imported your old cypress plugins here.
      // You may want to clean this up later by importing these.
      setupNodeEvents(on, config) {
        // ECONNRESET on Chrome/Chromium 117.0.5851.0 when using Cypress <12.15.0
        // Check https://github.com/cypress-io/cypress/issues/27804 for context
        // TODO: This workaround should be removed when upgrading Cypress
        on('before:browser:launch', (browser, launchOptions) => {
          if (browser.name === 'chrome' && browser.isHeadless) {
            // eslint-disable-next-line no-param-reassign
            launchOptions.args = launchOptions.args.map(arg => {
              if (arg === '--headless') {
                return '--headless=new';
              }

              return arg;
            });

            launchOptions.args.push(
              ...['--disable-dev-shm-usage', '--disable-gpu'],
            );
          }
          return launchOptions;
        });
        // eslint-disable-next-line global-require
        require('@cypress/code-coverage/task')(on, config);
        on('task', verifyDownloadTasks);
        // eslint-disable-next-line global-require,import/extensions
        return config;
      },
      baseUrl: 'http://localhost:8088',
      excludeSpecPattern: [],
      specPattern: [
        'cypress/e2e/**/*.{js,jsx,ts,tsx}',
        'cypress/applitools/**/*.{js,jsx,ts,tsx}',
      ],
    },
  }),
);
