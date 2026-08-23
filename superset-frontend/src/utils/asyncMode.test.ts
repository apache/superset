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
import { resolveAsyncMode } from './asyncMode';

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

test('per-dashboard override wins over the default', () => {
  mockFeatureEnabled.mockImplementation(
    f => f === FeatureFlag.GlobalAsyncQueries,
  );
  setDefault(false);
  expect(resolveAsyncMode('force_on')).toBe(true);
  setDefault(true);
  expect(resolveAsyncMode('force_off')).toBe(false);
});
