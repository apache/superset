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
 * Playwright config for real-browser layout tests that render components
 * directly from Storybook, rather than the full running application.
 *
 * These verify CSS/flexbox layout behavior (e.g. overlap, truncation) that
 * jsdom cannot compute, without requiring the Flask/DB backend that the main
 * playwright.config.ts targets. Run via:
 *   npm run playwright:storybook
 */

/// <reference types="node" />

// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

const storybookURL = process.env.STORYBOOK_URL || 'http://localhost:6006';

export default defineConfig({
  testDir: '.',

  timeout: 30000,
  expect: { timeout: 8000 },

  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,

  reporter: [['list']],

  use: {
    baseURL: storybookURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'storybook',
      use: {
        browserName: 'chromium',
        testIdAttribute: 'data-test',
      },
    },
  ],

  webServer: {
    command: 'npm run storybook',
    url: storybookURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
