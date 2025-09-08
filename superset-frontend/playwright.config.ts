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

/// <reference types="node" />

// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './playwright/tests',

  // Timeout settings
  timeout: 30000,
  expect: { timeout: 8000 },

  // Parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // Retry logic - 2 retries in CI, 0 locally
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'list',

  // Global test setup
  use: {
    baseURL: 'http://localhost:8088',

    // Browser settings
    headless: !!process.env.CI,

    viewport: { width: 1280, height: 1024 },

    // Screenshots and videos on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Trace collection for debugging
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        testIdAttribute: 'data-test',
      },
    },
  ],

  // Web server setup - assume Superset is already running
  webServer: {
    command: 'echo "Assuming Superset is running on localhost:8088"',
    url: 'http://localhost:8088/health',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
