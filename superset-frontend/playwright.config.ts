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

  // Conditionally ignore experimental tests based on env var
  // When INCLUDE_EXPERIMENTAL=true, experimental tests are included
  // Otherwise, they are excluded (default for required tests)
  testIgnore: process.env.INCLUDE_EXPERIMENTAL
    ? undefined
    : '**/experimental/**',

  // Global setup - authenticate once before all tests
  globalSetup: './playwright/global-setup.ts',

  // Timeout settings
  timeout: 30000,
  expect: { timeout: 8000 },

  // Parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,

  // Retry logic - 2 retries in CI, 0 locally
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration - multiple reporters for better visibility
  reporter: process.env.CI
    ? [
        ['github'], // GitHub Actions annotations
        ['list'], // Detailed output with summary table
        ['html', { outputFolder: 'playwright-report', open: 'never' }], // Interactive report
        ['json', { outputFile: 'test-results/results.json' }], // Machine-readable
      ]
    : [
        ['list'], // Shows summary table locally
        ['html', { outputFolder: 'playwright-report', open: 'on-failure' }], // Auto-open on failure
      ],

  // Global test setup
  use: {
    // Use environment variable for base URL in CI, default to localhost:8088 for local
    // Normalize to always end with '/' to prevent URL resolution issues with APP_PREFIX
    baseURL: (() => {
      const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
      return url.endsWith('/') ? url : `${url}/`;
    })(),

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
      // Default project - uses global authentication for speed
      // E2E tests login once via global-setup.ts and reuse auth state
      // Explicitly ignore auth tests (they run in chromium-unauth project)
      // Also respect the global experimental testIgnore setting
      name: 'chromium',
      testIgnore: [
        '**/tests/auth/**/*.spec.ts',
        ...(process.env.INCLUDE_EXPERIMENTAL ? [] : ['**/experimental/**']),
      ],
      use: {
        browserName: 'chromium',
        testIdAttribute: 'data-test',
        // Reuse authentication state from global setup (fast E2E tests)
        storageState: 'playwright/.auth/user.json',
      },
    },
    {
      // Separate project for unauthenticated tests (login, signup, etc.)
      // These tests use beforeEach for per-test navigation - no global auth
      // This hybrid approach: simple auth tests, fast E2E tests
      name: 'chromium-unauth',
      testMatch: '**/tests/auth/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        testIdAttribute: 'data-test',
        // No storageState = clean browser with no cached cookies
      },
    },
  ],

  // Web server setup - disabled in CI (Flask started separately in workflow)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'curl -f http://localhost:8088/health',
        url: 'http://localhost:8088/health',
        reuseExistingServer: true,
        timeout: 5000,
      },
});
