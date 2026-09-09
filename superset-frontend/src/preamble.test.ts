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

import type { LanguagePack } from '@apache-superset/core/translation';

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

// --- language pack loading semantics (issues #35330, PR #41780) -----------
// English: nothing is loaded at all. Non-English: the pack is expected to
// already be on window (set by the versioned classic <script> tag spa.html
// emits before the entry bundle), so configuration is synchronous and no
// English flash can occur. The async fetch is a fallback only, and it only
// ever requests the selected locale.

const FAKE_PACK: LanguagePack = {
  domain: 'superset',
  locale_data: {
    superset: {
      '': {
        domain: 'superset',
        lang: 'fr',
        plural_forms: 'nplurals=2; plural=(n > 1);',
      },
    },
  },
};

afterEach(() => {
  delete window.__SUPERSET_LANGUAGE_PACK__;
});

test('configures synchronously from the window pack without fetching', async () => {
  mockGetBootstrapData.mockReturnValue(bootstrapData('fr'));
  window.__SUPERSET_LANGUAGE_PACK__ = FAKE_PACK;
  const fetchSpy = jest.spyOn(global, 'fetch');

  await runPreamble();

  expect(mockConfigure).toHaveBeenCalledWith({ languagePack: FAKE_PACK });
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockDayjsLocale).toHaveBeenCalledWith('fr');
  fetchSpy.mockRestore();
});

test('prefers an operator-supplied bootstrap pack over the window pack', async () => {
  const overridePack = { ...FAKE_PACK, domain: 'override' };
  const data = bootstrapData('fr');
  (data.common as Record<string, unknown>).language_pack = overridePack;
  mockGetBootstrapData.mockReturnValue(data);
  window.__SUPERSET_LANGUAGE_PACK__ = FAKE_PACK;

  await runPreamble();

  expect(mockConfigure).toHaveBeenCalledWith({ languagePack: overridePack });
});

test('loads no language pack at all for English', async () => {
  mockGetBootstrapData.mockReturnValue(bootstrapData('en'));
  const fetchSpy = jest.spyOn(global, 'fetch');

  await runPreamble();

  expect(fetchSpy).not.toHaveBeenCalled();
  // The translator is configured bare (identity translations), never with
  // a pack: English pays zero payload.
  expect(mockConfigure).toHaveBeenCalledWith();
  fetchSpy.mockRestore();
});

test('fallback fetch requests only the selected locale and blocks until configured', async () => {
  mockGetBootstrapData.mockReturnValue(bootstrapData('fr'));
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(FAKE_PACK),
  } as unknown as Response);

  await runPreamble();

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(mockMakeUrl).toHaveBeenCalledWith('/language_pack/fr/');
  // configure() resolves before initPreamble() does, so nothing renders
  // untranslated even on the fallback path.
  expect(mockConfigure).toHaveBeenCalledWith({ languagePack: FAKE_PACK });
  expect(window.__SUPERSET_LANGUAGE_PACK__).toEqual(FAKE_PACK);
  fetchSpy.mockRestore();
});
