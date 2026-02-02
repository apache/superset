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
import { initFeatureFlags } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  initFeatureFlags: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockInitFeatureFlags = initFeatureFlags as jest.MockedFunction<
  typeof initFeatureFlags
>;
const mockGetBootstrapData = getBootstrapData as jest.MockedFunction<
  typeof getBootstrapData
>;

beforeEach(() => {
  jest.resetModules();
  mockInitFeatureFlags.mockClear();
  mockGetBootstrapData.mockClear();
});

test('initEmbedded initializes feature flags on import', async () => {
  const mockBootstrapData = {
    common: {
      feature_flags: {
        EMBEDDED_SUPERSET: true,
        ENABLE_JAVASCRIPT_CONTROLS: false,
      },
    },
  };

  mockGetBootstrapData.mockReturnValue(mockBootstrapData as any);

  // Import the module - this triggers the initialization
  const { bootstrapData } = await import('./initEmbedded');

  expect(mockGetBootstrapData).toHaveBeenCalledTimes(1);
  expect(mockInitFeatureFlags).toHaveBeenCalledTimes(1);
  expect(mockInitFeatureFlags).toHaveBeenCalledWith({
    EMBEDDED_SUPERSET: true,
    ENABLE_JAVASCRIPT_CONTROLS: false,
  });
  expect(bootstrapData).toBe(mockBootstrapData);
});

test('initEmbedded handles empty feature flags', async () => {
  const mockBootstrapData = {
    common: {
      feature_flags: {},
    },
  };

  mockGetBootstrapData.mockReturnValue(mockBootstrapData as any);

  const { bootstrapData } = await import('./initEmbedded');

  expect(mockInitFeatureFlags).toHaveBeenCalledWith({});
  expect(bootstrapData).toBe(mockBootstrapData);
});

test('initEmbedded handles undefined feature flags', async () => {
  const mockBootstrapData = {
    common: {},
  };

  mockGetBootstrapData.mockReturnValue(mockBootstrapData as any);

  const { bootstrapData } = await import('./initEmbedded');

  expect(mockInitFeatureFlags).toHaveBeenCalledWith(undefined);
  expect(bootstrapData).toBe(mockBootstrapData);
});
