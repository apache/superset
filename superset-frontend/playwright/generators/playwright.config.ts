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

/**
 * Playwright config for documentation generators (screenshots, etc.)
 *
 * Separate from the main test config so generators are never picked up
 * by CI test sweeps. Run via:
 *   npm run docs:screenshots
 */

/// <reference types="node" />

import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

const serverURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
const baseURL = serverURL.endsWith('/') ? serverURL : `${serverURL}/`;

export default defineConfig({
  testDir: '.',

  globalSetup: '../global-setup.ts',

  timeout: 90000,
  expect: { timeout: 30000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [['list']],

  use: {
    baseURL,

    headless: true,
    viewport: { width: 1280, height: 1024 },

    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'docs-generators',
      use: {
        browserName: 'chromium',
        testIdAttribute: 'data-test',
        storageState: path.resolve(__dirname, '../.auth/user.json'),
      },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: `curl -f ${serverURL}/health`,
        url: `${serverURL}/health`,
        reuseExistingServer: true,
        timeout: 5000,
      },
});
