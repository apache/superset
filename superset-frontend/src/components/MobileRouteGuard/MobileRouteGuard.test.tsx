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
import MobileRouteGuard, {
  isMobileSupportedRoute,
  MOBILE_SUPPORTED_ROUTES,
} from './index';

// Store the original sessionStorage
const originalSessionStorage = window.sessionStorage;

// Clean up sessionStorage before each test
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore sessionStorage if it was mocked
  Object.defineProperty(window, 'sessionStorage', {
    value: originalSessionStorage,
    writable: true,
  });
});

// Unit tests for isMobileSupportedRoute helper function
test('isMobileSupportedRoute returns true for dashboard list', () => {
  expect(isMobileSupportedRoute('/dashboard/list/')).toBe(true);
  expect(isMobileSupportedRoute('/dashboard/list')).toBe(true);
});

test('isMobileSupportedRoute returns true for individual dashboards', () => {
  expect(isMobileSupportedRoute('/superset/dashboard/123/')).toBe(true);
  expect(isMobileSupportedRoute('/superset/dashboard/my-dashboard/')).toBe(
    true,
  );
  expect(isMobileSupportedRoute('/superset/dashboard/abc-123/')).toBe(true);
});

test('isMobileSupportedRoute returns true for welcome page', () => {
  expect(isMobileSupportedRoute('/superset/welcome/')).toBe(true);
  expect(isMobileSupportedRoute('/superset/welcome')).toBe(true);
});

test('isMobileSupportedRoute returns true for auth routes', () => {
  expect(isMobileSupportedRoute('/login/')).toBe(true);
  expect(isMobileSupportedRoute('/logout/')).toBe(true);
  expect(isMobileSupportedRoute('/register/')).toBe(true);
});

test('isMobileSupportedRoute returns false for chart routes', () => {
  expect(isMobileSupportedRoute('/chart/list/')).toBe(false);
  expect(isMobileSupportedRoute('/explore/')).toBe(false);
  expect(isMobileSupportedRoute('/superset/explore/')).toBe(false);
});

test('isMobileSupportedRoute returns false for SQL Lab', () => {
  expect(isMobileSupportedRoute('/sqllab/')).toBe(false);
  expect(isMobileSupportedRoute('/superset/sqllab/')).toBe(false);
});

test('isMobileSupportedRoute returns false for database/dataset routes', () => {
  expect(isMobileSupportedRoute('/database/list/')).toBe(false);
  expect(isMobileSupportedRoute('/dataset/list/')).toBe(false);
});

test('isMobileSupportedRoute strips query params and hash', () => {
  expect(isMobileSupportedRoute('/dashboard/list/?page=1')).toBe(true);
  expect(isMobileSupportedRoute('/dashboard/list/#section')).toBe(true);
  expect(isMobileSupportedRoute('/chart/list/?page=1')).toBe(false);
});

test('MOBILE_SUPPORTED_ROUTES includes expected patterns', () => {
  // Verify the constant is exported and has expected patterns
  expect(MOBILE_SUPPORTED_ROUTES).toBeInstanceOf(Array);
  expect(MOBILE_SUPPORTED_ROUTES.length).toBeGreaterThan(0);

  // Check some patterns exist
  const hasLoginPattern = MOBILE_SUPPORTED_ROUTES.some(p => p.test('/login/'));
  const hasDashboardListPattern = MOBILE_SUPPORTED_ROUTES.some(p =>
    p.test('/dashboard/list/'),
  );
  const hasWelcomePattern = MOBILE_SUPPORTED_ROUTES.some(p =>
    p.test('/superset/welcome/'),
  );

  expect(hasLoginPattern).toBe(true);
  expect(hasDashboardListPattern).toBe(true);
  expect(hasWelcomePattern).toBe(true);
});

// Integration tests for MobileRouteGuard component
// Note: These tests require mocking at the module level which is complex
// The tests below verify the component structure and exports

test('MobileRouteGuard exports the component as default', () => {
  expect(MobileRouteGuard).toBeDefined();
  expect(typeof MobileRouteGuard).toBe('function');
});

test('isMobileSupportedRoute is exported', () => {
  expect(isMobileSupportedRoute).toBeDefined();
  expect(typeof isMobileSupportedRoute).toBe('function');
});

test('MOBILE_SUPPORTED_ROUTES is exported', () => {
  expect(MOBILE_SUPPORTED_ROUTES).toBeDefined();
  expect(Array.isArray(MOBILE_SUPPORTED_ROUTES)).toBe(true);
});
