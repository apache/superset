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

import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import { theme } from './colors';

jest.mock('@superset-ui/core', () => ({
  getCategoricalSchemeRegistry: jest.fn(),
}));

const mockGetRegistry = getCategoricalSchemeRegistry as jest.Mock;

const supersetScheme = { id: 'supersetColors', colors: ['#111', '#222'] };
const airbnbScheme = { id: 'airbnb', colors: ['#333', '#444'] };

beforeEach(() => {
  jest.clearAllMocks();
});

test('getCategoricalSchemeNames returns an empty array when there is no registry', () => {
  mockGetRegistry.mockReturnValue(null);
  expect(theme.getCategoricalSchemeNames()).toEqual([]);
});

test('getCategoricalSchemeNames returns registered names sorted alphabetically', () => {
  mockGetRegistry.mockReturnValue({
    keys: () => ['supersetColors', 'airbnb'],
    get: jest.fn(),
  });
  expect(theme.getCategoricalSchemeNames()).toEqual([
    'airbnb',
    'supersetColors',
  ]);
});

test('getSchemeColors returns null when there is no registry', () => {
  mockGetRegistry.mockReturnValue(null);
  expect(theme.getSchemeColors('airbnb')).toBeNull();
});

test('getSchemeColors returns null when the scheme is not found', () => {
  mockGetRegistry.mockReturnValue({ keys: () => [], get: () => undefined });
  expect(theme.getSchemeColors('unknown')).toBeNull();
});

test('getSchemeColors returns the colors for a registered scheme', () => {
  mockGetRegistry.mockReturnValue({
    keys: () => ['airbnb'],
    get: (name: string) => (name === 'airbnb' ? airbnbScheme : undefined),
  });
  expect(theme.getSchemeColors('airbnb')).toEqual(airbnbScheme.colors);
});

test('getCategoricalSchemes returns full scheme metadata sorted by name', () => {
  mockGetRegistry.mockReturnValue({
    keys: () => ['supersetColors', 'airbnb'],
    get: (name: string) => {
      if (name === 'supersetColors') return supersetScheme;
      if (name === 'airbnb') return airbnbScheme;
      return undefined;
    },
  });
  expect(theme.getCategoricalSchemes()).toEqual([airbnbScheme, supersetScheme]);
});

test('getCategoricalSchemes filters out names the registry cannot resolve', () => {
  mockGetRegistry.mockReturnValue({
    keys: () => ['airbnb', 'missing'],
    get: (name: string) => (name === 'airbnb' ? airbnbScheme : undefined),
  });
  expect(theme.getCategoricalSchemes()).toEqual([airbnbScheme]);
});
