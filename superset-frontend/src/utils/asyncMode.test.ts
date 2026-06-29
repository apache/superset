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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { getAsyncModeOverride, resolveAsyncMode } from './asyncMode';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockFeatureEnabled = isFeatureEnabled as jest.Mock;
const mockBootstrap = getBootstrapData as jest.Mock;

const setDefault = (value: boolean | undefined) =>
  mockBootstrap.mockReturnValue({
    common: { conf: { GLOBAL_ASYNC_QUERIES_DEFAULT: value } },
  });

afterEach(() => jest.clearAllMocks());

test('never async when the feature flag is off', () => {
  mockFeatureEnabled.mockImplementation(
    f => f !== FeatureFlag.GlobalAsyncQueries,
  );
  setDefault(true);
  expect(resolveAsyncMode()).toBe(false);
  expect(resolveAsyncMode('force_on')).toBe(false);
});

test('falls back to the deployment default when no override', () => {
  mockFeatureEnabled.mockImplementation(
    f => f === FeatureFlag.GlobalAsyncQueries,
  );
  setDefault(true);
  expect(resolveAsyncMode()).toBe(true);
  expect(resolveAsyncMode('default')).toBe(true);
  setDefault(false);
  expect(resolveAsyncMode()).toBe(false);
});

test('defaults to async when the deployment default is unset', () => {
  mockFeatureEnabled.mockImplementation(
    f => f === FeatureFlag.GlobalAsyncQueries,
  );
  setDefault(undefined);
  expect(resolveAsyncMode()).toBe(true);
});

test('reads the per-dashboard override off the dashboard info store', () => {
  const seed = (dashboardInfo: object) =>
    useDashboardInfoStore.setState({
      dashboardInfo: dashboardInfo as DashboardInfo,
    });
  try {
    seed({ metadata: { async_mode: 'force_off' } });
    expect(getAsyncModeOverride()).toBe('force_off');
    // Outside a dashboard, or with no override set, resolution falls back to
    // the deployment default.
    seed({});
    expect(getAsyncModeOverride()).toBeUndefined();
    seed({ metadata: {} });
    expect(getAsyncModeOverride()).toBeUndefined();
  } finally {
    useDashboardInfoStore.setState(useDashboardInfoStore.getInitialState());
  }
});

test('per-dashboard override wins over the default', () => {
  mockFeatureEnabled.mockImplementation(
    f => f === FeatureFlag.GlobalAsyncQueries,
  );
  setDefault(false);
  expect(resolveAsyncMode('force_on')).toBe(true);
  setDefault(true);
  expect(resolveAsyncMode('force_off')).toBe(false);
});
