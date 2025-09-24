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
import './shim';
// eslint-disable-next-line no-restricted-syntax -- whole React import is required for mocking React module in tests.
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import { configure as configureTestingLibrary } from '@testing-library/react';
import { matchers } from '@emotion/jest';

configureTestingLibrary({
  testIdAttribute: 'data-test',
});

document.body.innerHTML = '<div id="app" data-bootstrap=""></div>';
expect.extend(matchers);

// Allow JSX tests to have React import readily available
global.React = React;

// Note: SupersetClient configuration, browser API polyfills, and mocks
// are handled by the shim.tsx import above

// =============================================================================
// BROWSER API POLYFILLS FOR JEST ENVIRONMENT
// =============================================================================
//
// Using 'jest-fixed-jsdom' instead of 'jest-environment-jsdom' to fix missing browser APIs.
//
// ISSUE: npm v11 upgrade caused modern packages to require browser APIs unavailable in Node.js:
// - TextEncoder/TextDecoder (jspdf 3.x), structuredClone (geostyler), matchMedia (Ant Design)
//
// SOLUTION: jest-fixed-jsdom provides comprehensive browser API polyfills while preserving Node.js globals.
// See: https://github.com/mswjs/jest-fixed-jsdom
//
// Configured in jest.config.js → testEnvironment: 'jest-fixed-jsdom'

// =============================================================================
// JEST 30 COMPATIBILITY: ENHANCED CLEANUP FOR TIMER AND ASYNC OPERATION LEAKS
// =============================================================================

let originalTimeout: typeof setTimeout;
let originalClearTimeout: typeof clearTimeout;
let originalInterval: typeof setInterval;
let originalClearInterval: typeof clearInterval;

beforeAll(() => {
  // Store original timer functions
  originalTimeout = global.setTimeout;
  originalClearTimeout = global.clearTimeout;
  originalInterval = global.setInterval;
  originalClearInterval = global.clearInterval;
});

afterEach(() => {
  // Clear all timers after each test to prevent leaks
  jest.clearAllTimers();

  // Ensure all pending async operations are flushed
  jest.runOnlyPendingTimers();

  // Additional cleanup for common leak sources
  if (typeof global.gc === 'function') {
    global.gc();
  }
});

afterAll(() => {
  // Restore original timer functions
  global.setTimeout = originalTimeout;
  global.clearTimeout = originalClearTimeout;
  global.setInterval = originalInterval;
  global.clearInterval = originalClearInterval;
});
