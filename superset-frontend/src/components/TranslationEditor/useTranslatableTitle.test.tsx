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

import { renderHook, act } from '@testing-library/react-hooks';
import { isFeatureEnabled } from '@superset-ui/core';
import type { Translations } from 'src/types/Localization';
import useTranslatableTitle, {
  type UseTranslatableTitleParams,
} from './useTranslatableTitle';
import { resetLocalesCache } from './useAvailableLocales';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('@superset-ui/core/connection', () => ({
  SupersetClient: { get: jest.fn() },
}));

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => 'en'),
}));

jest.mock('./useAvailableLocales', () => {
  const original = jest.requireActual('./useAvailableLocales');
  return {
    ...original,
    __esModule: true,
    default: jest.fn(() => ({
      allLocales: [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
      ],
      defaultLocale: 'en',
    })),
  };
});

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const TRANSLATIONS: Translations = {
  slice_name: { de: 'Verkaufs-Diagramm' },
};

function createParams(
  overrides: Partial<UseTranslatableTitleParams> = {},
): UseTranslatableTitleParams {
  return {
    title: 'Sales Chart',
    translations: TRANSLATIONS,
    fieldName: 'slice_name',
    onSaveTitle: jest.fn(),
    onTranslationsChange: jest.fn(),
    fieldLabel: 'Chart Name',
    ...overrides,
  };
}

beforeEach(() => {
  resetLocalesCache();
  jest.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(true);
});

test('returns title as displayTitle when activeLocale is DEFAULT', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  expect(result.current.displayTitle).toBe('Sales Chart');
  expect(result.current.activeLocale).toBe('default');
  expect(result.current.isLocaleMode).toBe(false);
});

test('returns translation value when activeLocale is a specific locale', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  act(() => {
    result.current.setActiveLocale('de');
  });

  expect(result.current.displayTitle).toBe('Verkaufs-Diagramm');
  expect(result.current.isLocaleMode).toBe(true);
});

test('handleSave routes to onSaveTitle in DEFAULT mode', () => {
  const onSaveTitle = jest.fn();
  const params = createParams({ onSaveTitle });
  const { result } = renderHook(() => useTranslatableTitle(params));

  act(() => {
    result.current.handleSave('New Title');
  });

  expect(onSaveTitle).toHaveBeenCalledWith('New Title');
});

test('handleSave routes to onTranslationsChange in locale mode', () => {
  const onTranslationsChange = jest.fn();
  const params = createParams({ onTranslationsChange });
  const { result } = renderHook(() => useTranslatableTitle(params));

  act(() => {
    result.current.setActiveLocale('de');
  });

  act(() => {
    result.current.handleSave('Neuer Titel');
  });

  expect(onTranslationsChange).toHaveBeenCalledWith({
    slice_name: { de: 'Neuer Titel' },
  });
});

test('localeSwitcher is null when feature flag is off', () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  expect(result.current.localeSwitcher).toBeNull();
  expect(result.current.showLocale).toBe(false);
});

test('placeholder shows translation prompt in locale mode', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  act(() => {
    result.current.setActiveLocale('de');
  });

  expect(result.current.placeholder).toBe('Translation for DE');
});

test('placeholder is empty in DEFAULT mode', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  expect(result.current.placeholder).toBe('');
});

test('returns empty string displayTitle for locale without translation', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  act(() => {
    result.current.setActiveLocale('fr');
  });

  expect(result.current.displayTitle).toBe('');
});

test('localeSwitcher is not null when feature flag on and locales available', () => {
  const params = createParams();
  const { result } = renderHook(() => useTranslatableTitle(params));

  expect(result.current.localeSwitcher).not.toBeNull();
  expect(result.current.showLocale).toBe(true);
});

test('localeSwitcher is null when translations prop is undefined', () => {
  const params = createParams({ translations: undefined });
  const { result } = renderHook(() => useTranslatableTitle(params));

  expect(result.current.localeSwitcher).toBeNull();
  expect(result.current.showLocale).toBe(false);
});
