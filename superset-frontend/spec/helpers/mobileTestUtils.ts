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
 *
 * Note: FeatureFlag is imported from the '@superset-ui/core/utils' submodule
 * rather than the '@superset-ui/core' package root. The package root barrel
 * transitively pulls in the theme module, which imports 'antd'. Consuming
 * test files call `jest.mock('antd', () => mockAntdWithDesktopBreakpoint())`
 * before importing this file, so if loading this file triggered an 'antd'
 * require before `mockAntdWithDesktopBreakpoint` were defined, the mock
 * factory would throw.
 */

import { FeatureFlag } from '@superset-ui/core/utils';

/**
 * Standard mobile breakpoint values (below md breakpoint)
 */
export const mobileBreakpoints = {
  xs: true,
  sm: false,
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
 * Mocks window.matchMedia to simulate a narrow mobile viewport (375px wide
 * by default) for the useIsMobile hook. A `max-width: Npx` query only
 * matches when the simulated viewport width is at or below N, mirroring
 * real browser media-query evaluation; queries for narrower breakpoints
 * than the simulated viewport correctly report no match, instead of every
 * `max-width` query matching regardless of its threshold.
 * Returns a cleanup function restoring the previous matchMedia. Mobile
 * behavior requires BOTH this AND the MOBILE_CONSUMPTION_MODE flag (see
 * enableMobileConsumptionFlag).
 */
export const mockMobileMatchMedia = (viewportWidth = 375) => {
  const previous = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => {
      const maxWidthMatch = query.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
      const matches = maxWidthMatch
        ? viewportWidth <= Number(maxWidthMatch[1])
        : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    }),
  });
  return () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: previous,
    });
  };
};

/**
 * Enables the MOBILE_CONSUMPTION_MODE feature flag on window.featureFlags.
 * Mobile behavior requires BOTH a small viewport (mockMobileMatchMedia)
 * AND this flag; call this in beforeAll/beforeEach of mobile test suites.
 * Returns a cleanup function restoring the previous flags.
 */
export const enableMobileConsumptionFlag = () => {
  const previous = window.featureFlags;
  window.featureFlags = {
    ...window.featureFlags,
    [FeatureFlag.MobileConsumptionMode]: true,
  };
  return () => {
    window.featureFlags = previous;
  };
};

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
