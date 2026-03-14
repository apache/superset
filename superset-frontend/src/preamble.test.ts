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

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  initFeatureFlags: jest.fn(),
  makeApi: jest.fn(() => jest.fn(() => Promise.resolve({}))),
}));

jest.mock('@apache-superset/core/translation', () => ({
  configure: jest.fn(),
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      feature_flags: { EMBEDDED_SUPERSET: true },
      d3_format: {},
      d3_time_format: {},
      locale: 'fr',
    },
    user: { isActive: false },
  })),
  applicationRoot: jest.fn(() => '/'),
}));

jest.mock('src/setup/setupClient', () => jest.fn());
jest.mock('src/setup/setupColors', () => jest.fn());
jest.mock('src/setup/setupFormatters', () => jest.fn());
jest.mock('src/setup/setupDashboardComponents', () => jest.fn());
jest.mock('src/hooks/useLocale', () => ({}));

test('initFeatureFlags is called before language pack fetch', async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  global.fetch = fetchMock;

  try {
    const initPreamble = (await import('./preamble')).default;
    await initPreamble();

    expect(initFeatureFlags).toHaveBeenCalledWith({ EMBEDDED_SUPERSET: true });
    expect(fetchMock).toHaveBeenCalled();

    const flagsOrder = (initFeatureFlags as jest.Mock).mock
      .invocationCallOrder[0];
    const fetchOrder = fetchMock.mock.invocationCallOrder[0];
    expect(flagsOrder).toBeLessThan(fetchOrder);
  } finally {
    global.fetch = originalFetch;
  }
});
