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

const mockConfigure = jest.fn();
const mockInitFeatureFlags = jest.fn();
const mockMakeApi = jest.fn(() => jest.fn());
const mockSetupClient = jest.fn();
const mockSetupColors = jest.fn();
const mockSetupDashboardComponents = jest.fn();
const mockSetupFormatters = jest.fn();
const mockGetBootstrapData = jest.fn();
const mockApplicationRoot = jest.fn(() => '/');
const mockMakeUrl = jest.fn((url: string) => url);
const mockDayjsLocale = jest.fn();

jest.mock('@apache-superset/core/translation', () => ({
  configure: mockConfigure,
}));
jest.mock('@apache-superset/core/utils', () => ({
  logging: {
    warn: jest.fn(),
  },
}));
jest.mock('@superset-ui/core', () => ({
  initFeatureFlags: mockInitFeatureFlags,
  makeApi: mockMakeApi,
}));
jest.mock('@superset-ui/core/utils/dates', () => ({
  extendedDayjs: {
    locale: mockDayjsLocale,
  },
}));
jest.mock('./setup/setupClient', () => ({
  __esModule: true,
  default: mockSetupClient,
}));
jest.mock('./setup/setupColors', () => ({
  __esModule: true,
  default: mockSetupColors,
}));
jest.mock('./setup/setupDashboardComponents', () => ({
  __esModule: true,
  default: mockSetupDashboardComponents,
}));
jest.mock('./setup/setupFormatters', () => ({
  __esModule: true,
  default: mockSetupFormatters,
}));
jest.mock('./utils/getBootstrapData', () => ({
  __esModule: true,
  applicationRoot: mockApplicationRoot,
  default: mockGetBootstrapData,
}));
jest.mock('./utils/pathUtils', () => ({
  makeUrl: mockMakeUrl,
}));
jest.mock('./hooks/useLocale', () => ({}));

const bootstrapData = (locale?: string) => ({
  common: {
    d3_format: {},
    d3_time_format: {},
    extra_categorical_color_schemes: [],
    extra_sequential_color_schemes: [],
    feature_flags: {},
    locale,
  },
  user: {
    isActive: false,
  },
});

async function runPreamble() {
  const { default: initPreamble } = await import('./preamble');
  await initPreamble();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

test('passes bootstrap locale to setupFormatters', async () => {
  mockGetBootstrapData.mockReturnValue(bootstrapData('pt_BR'));

  await runPreamble();

  expect(mockSetupFormatters).toHaveBeenCalledWith({}, {}, 'pt_BR');
});

test('falls back to en when passing locale to setupFormatters', async () => {
  mockGetBootstrapData.mockReturnValue(bootstrapData());

  await runPreamble();

  expect(mockSetupFormatters).toHaveBeenCalledWith({}, {}, 'en');
});
