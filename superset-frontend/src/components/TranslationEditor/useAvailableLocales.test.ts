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

import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core/connection';
import useAvailableLocales, { resetLocalesCache } from './useAvailableLocales';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('@superset-ui/core/connection', () => ({
  SupersetClient: { get: jest.fn() },
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;
const mockGet = SupersetClient.get as jest.Mock;

const LOCALES_RESPONSE = {
  json: {
    result: {
      locales: [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
      ],
      default_locale: 'en',
    },
  },
};

beforeEach(() => {
  resetLocalesCache();
  jest.clearAllMocks();
});

test('returns empty result when feature flag is off', () => {
  mockIsFeatureEnabled.mockReturnValue(false);

  const { result } = renderHook(() => useAvailableLocales());

  expect(result.current.allLocales).toEqual([]);
  expect(result.current.defaultLocale).toBe('');
  expect(mockGet).not.toHaveBeenCalled();
});

test('fetches and returns locales when feature flag is on', async () => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockGet.mockResolvedValue(LOCALES_RESPONSE);

  const { result } = renderHook(() => useAvailableLocales());

  await waitFor(() => {
    expect(result.current.allLocales).toHaveLength(2);
  });

  expect(result.current.allLocales).toEqual([
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
  ]);
  expect(result.current.defaultLocale).toBe('en');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/localization/available_locales',
  });
});

test('caches result across multiple hook instances', async () => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockGet.mockResolvedValue(LOCALES_RESPONSE);

  const { result: result1 } = renderHook(() => useAvailableLocales());

  await waitFor(() => {
    expect(result1.current.allLocales).toHaveLength(2);
  });

  const { result: result2 } = renderHook(() => useAvailableLocales());

  await waitFor(() => {
    expect(result2.current.allLocales).toHaveLength(2);
  });

  expect(mockGet).toHaveBeenCalledTimes(1);
});
