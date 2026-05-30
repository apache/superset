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
 * Mobile testing utilities for Jest tests.
 *
 * Note: We mock 'antd' directly rather than '@superset-ui/core/components' because
 * mocking the latter causes circular dependency issues with ActionButton during
 * jest.requireActual evaluation. Since Grid is re-exported from antd, mocking
 * antd at the source works correctly.
 */

/**
 * Standard mobile breakpoint values (below md breakpoint)
 */
export const mobileBreakpoints = {
  xs: true,
  sm: true,
  md: false,
  lg: false,
  xl: false,
  xxl: false,
};

/**
 * Standard desktop breakpoint values (at or above md breakpoint)
 */
export const desktopBreakpoints = {
  xs: true,
  sm: true,
  md: true,
  lg: true,
  xl: true,
  xxl: true,
};

/**
 * Creates a mock for antd Grid.useBreakpoint that returns mobile breakpoints.
 * Use this at the top of test files that need to simulate mobile viewport.
 *
 * @example
 * jest.mock('antd', () => mockAntdWithMobileBreakpoint());
 */
export const mockAntdWithMobileBreakpoint = () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => mobileBreakpoints,
  },
});

/**
 * Creates a mock for antd Grid.useBreakpoint that returns desktop breakpoints.
 * Use this at the top of test files that need to simulate desktop viewport.
 *
 * @example
 * jest.mock('antd', () => mockAntdWithDesktopBreakpoint());
 */
export const mockAntdWithDesktopBreakpoint = () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => desktopBreakpoints,
  },
});

/**
 * Common mobile viewport dimensions for reference
 */
export const mobileViewports = {
  iPhoneX: { width: 375, height: 812 },
  iPhoneSE: { width: 375, height: 667 },
  iPhone12Pro: { width: 390, height: 844 },
  pixel5: { width: 393, height: 851 },
  samsungGalaxyS20: { width: 360, height: 800 },
};

/**
 * Common tablet viewport dimensions for reference
 */
export const tabletViewports = {
  iPadMini: { width: 768, height: 1024 },
  iPadAir: { width: 820, height: 1180 },
  iPadPro11: { width: 834, height: 1194 },
  surfacePro7: { width: 912, height: 1368 },
};

/**
 * Helper to mock sessionStorage for tests
 */
export const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

/**
 * Helper to create a failing sessionStorage mock (simulates privacy mode)
 */
export const mockSessionStorageFailure = () => ({
  getItem: jest.fn(() => {
    throw new Error('Storage access denied');
  }),
  setItem: jest.fn(() => {
    throw new Error('Storage access denied');
  }),
  removeItem: jest.fn(() => {
    throw new Error('Storage access denied');
  }),
  clear: jest.fn(() => {
    throw new Error('Storage access denied');
  }),
  length: 0,
  key: jest.fn(() => null),
});
