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
import { waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ReactNode } from 'react';
import configureStore from 'redux-mock-store';
import { DAYJS_LOCALE_MAPPING, LOCALE_MAPPING, useLocale } from './useLocale';

// jest.mock is hoisted before variable declarations, so jest.fn() must be
// called directly inside the factory. The mock reference is obtained via
// require() after all mocks are set up.
jest.mock('@superset-ui/core/utils/dates', () => ({
  extendedDayjs: { locale: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockDayjsLocale = require('@superset-ui/core/utils/dates').extendedDayjs
  .locale as jest.Mock;

// Mock dayjs locale side-effect imports
jest.mock('dayjs/locale/en', () => ({}), { virtual: true });
jest.mock('dayjs/locale/fr', () => ({}), { virtual: true });
jest.mock('dayjs/locale/es', () => ({}), { virtual: true });
jest.mock('dayjs/locale/it', () => ({}), { virtual: true });
jest.mock('dayjs/locale/zh-cn', () => ({}), { virtual: true });
jest.mock('dayjs/locale/zh-tw', () => ({}), { virtual: true });
jest.mock('dayjs/locale/ja', () => ({}), { virtual: true });
jest.mock('dayjs/locale/de', () => ({}), { virtual: true });
jest.mock('dayjs/locale/pt', () => ({}), { virtual: true });
jest.mock('dayjs/locale/pt-br', () => ({}), { virtual: true });
jest.mock('dayjs/locale/ru', () => ({}), { virtual: true });
jest.mock('dayjs/locale/ko', () => ({}), { virtual: true });
jest.mock('dayjs/locale/sk', () => ({}), { virtual: true });
jest.mock('dayjs/locale/sl', () => ({}), { virtual: true });
jest.mock('dayjs/locale/nl', () => ({}), { virtual: true });

// Mock antd locale modules — __esModule: true ensures locale.default resolves correctly
// under Jest's CommonJS/ESM interop
jest.mock(
  'antd/locale/en_US',
  () => ({ __esModule: true, default: { locale: 'en' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/fr_FR',
  () => ({ __esModule: true, default: { locale: 'fr' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/es_ES',
  () => ({ __esModule: true, default: { locale: 'es' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/it_IT',
  () => ({ __esModule: true, default: { locale: 'it' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/zh_CN',
  () => ({ __esModule: true, default: { locale: 'zh' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/zh_TW',
  () => ({ __esModule: true, default: { locale: 'zh_TW' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/ja_JP',
  () => ({ __esModule: true, default: { locale: 'ja' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/de_DE',
  () => ({ __esModule: true, default: { locale: 'de' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/pt_PT',
  () => ({ __esModule: true, default: { locale: 'pt' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/pt_BR',
  () => ({ __esModule: true, default: { locale: 'pt_BR' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/ru_RU',
  () => ({ __esModule: true, default: { locale: 'ru' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/ko_KR',
  () => ({ __esModule: true, default: { locale: 'ko' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/sk_SK',
  () => ({ __esModule: true, default: { locale: 'sk' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/sl_SI',
  () => ({ __esModule: true, default: { locale: 'sl' } }),
  { virtual: true },
);
jest.mock(
  'antd/locale/nl_NL',
  () => ({ __esModule: true, default: { locale: 'nl' } }),
  { virtual: true },
);

const mockStore = configureStore([]);

function createWrapper(locale: string) {
  const store = mockStore({ common: { locale } });
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

// ── LOCALE_MAPPING ──────────────────────────────────────────────────────────

test('LOCALE_MAPPING contains zh_TW entry', () => {
  expect(LOCALE_MAPPING).toHaveProperty('zh_TW');
});

test('LOCALE_MAPPING contains zh entry', () => {
  expect(LOCALE_MAPPING).toHaveProperty('zh');
});

test('LOCALE_MAPPING contains pt_BR entry', () => {
  expect(LOCALE_MAPPING).toHaveProperty('pt_BR');
});

test('LOCALE_MAPPING zh_TW is a callable that returns a Promise', () => {
  const result = LOCALE_MAPPING.zh_TW();
  expect(result).toBeInstanceOf(Promise);
});

// ── DAYJS_LOCALE_MAPPING ────────────────────────────────────────────────────

test('DAYJS_LOCALE_MAPPING maps zh_TW to zh-tw', () => {
  expect(DAYJS_LOCALE_MAPPING.zh_TW).toBe('zh-tw');
});

test('DAYJS_LOCALE_MAPPING maps zh to zh-cn', () => {
  expect(DAYJS_LOCALE_MAPPING.zh).toBe('zh-cn');
});

test('DAYJS_LOCALE_MAPPING maps pt_BR to pt-br', () => {
  expect(DAYJS_LOCALE_MAPPING.pt_BR).toBe('pt-br');
});

// ── useLocale hook ──────────────────────────────────────────────────────────

test('useLocale returns initial null before locale resolves', () => {
  const { result } = renderHook(() => useLocale(), {
    wrapper: createWrapper('zh_TW'),
  });
  expect(result.current).toBeNull();
});

test('useLocale returns antd zh_TW locale for zh_TW', async () => {
  const { result } = renderHook(() => useLocale(), {
    wrapper: createWrapper('zh_TW'),
  });

  await waitFor(() => {
    expect(result.current).toEqual({ locale: 'zh_TW' });
  });
});

test('useLocale calls dayjs.locale with zh-tw for zh_TW', async () => {
  renderHook(() => useLocale(), { wrapper: createWrapper('zh_TW') });

  await waitFor(() => {
    expect(mockDayjsLocale).toHaveBeenCalledWith('zh-tw');
  });
});

test('useLocale calls dayjs.locale with zh-cn for zh', async () => {
  renderHook(() => useLocale(), { wrapper: createWrapper('zh') });

  await waitFor(() => {
    expect(mockDayjsLocale).toHaveBeenCalledWith('zh-cn');
  });
});

test('useLocale calls dayjs.locale with pt-br for pt_BR', async () => {
  renderHook(() => useLocale(), { wrapper: createWrapper('pt_BR') });

  await waitFor(() => {
    expect(mockDayjsLocale).toHaveBeenCalledWith('pt-br');
  });
});

test('useLocale passes locale code directly to dayjs for locales without a mapping', async () => {
  renderHook(() => useLocale(), { wrapper: createWrapper('fr') });

  await waitFor(() => {
    expect(mockDayjsLocale).toHaveBeenCalledWith('fr');
  });
});

test('useLocale returns undefined for unsupported locale', async () => {
  const { result } = renderHook(() => useLocale(), {
    wrapper: createWrapper('xx'),
  });

  await waitFor(() => {
    expect(result.current).toBeUndefined();
  });
});

test('useLocale does not call dayjs.locale for unsupported locale', async () => {
  const { result } = renderHook(() => useLocale(), {
    wrapper: createWrapper('xx'),
  });

  await waitFor(() => {
    expect(result.current).toBeUndefined();
  });
  expect(mockDayjsLocale).not.toHaveBeenCalled();
});

test('useLocale returns undefined when antd locale import fails', async () => {
  // Temporarily replace the fr entry to simulate a rejected import
  const frSpy = jest
    .spyOn(LOCALE_MAPPING as Record<string, () => Promise<unknown>>, 'fr')
    .mockRejectedValue(new Error('import failed'));

  const { result } = renderHook(() => useLocale(), {
    wrapper: createWrapper('fr'),
  });

  await waitFor(() => {
    expect(result.current).toBeUndefined();
  });
  expect(mockDayjsLocale).not.toHaveBeenCalled();

  frSpy.mockRestore();
});
