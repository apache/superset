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
import getBootstrapData from './getBootstrapData';
import { DEFAULT_BOOTSTRAP_DATA, rtlLanguages } from 'src/constants';
import {
  getBootstrapLocale,
  getDirectionFromLocale,
  getLanguageCodeFromLocale,
} from './localeUtils';

jest.mock('./getBootstrapData');
const mockGetBootstrapData = getBootstrapData as jest.MockedFunction<
  typeof getBootstrapData
>;

test('getLanguageCodeFromLocale strips region suffix', () => {
  expect(getLanguageCodeFromLocale('ar-SA')).toBe('ar');
  expect(getLanguageCodeFromLocale('ar_SA')).toBe('ar');
  expect(getLanguageCodeFromLocale('en')).toBe('en');
});

test('getDirectionFromLocale returns rtl for underscore locales', () => {
  expect(getDirectionFromLocale('ar_SA')).toBe('rtl');
  expect(getDirectionFromLocale('fa_IR')).toBe('rtl');
});

test('getDirectionFromLocale returns ltr for LTR locales', () => {
  expect(getDirectionFromLocale('en')).toBe('ltr');
  expect(getDirectionFromLocale('it')).toBe('ltr');
});

test.each(rtlLanguages)(
  'getDirectionFromLocale returns rtl for %s',
  languageCode => {
    expect(getDirectionFromLocale(languageCode)).toBe('rtl');
    expect(getDirectionFromLocale(`${languageCode}-XX`)).toBe('rtl');
    expect(getDirectionFromLocale(`${languageCode}_XX`)).toBe('rtl');
  },
);

test('getBootstrapLocale prefers navbar locale over common locale', () => {
  mockGetBootstrapData.mockReturnValue({
    ...DEFAULT_BOOTSTRAP_DATA,
    common: {
      ...DEFAULT_BOOTSTRAP_DATA.common,
      menu_data: {
        navbar_right: { locale: 'ar' },
      },
    },
  } as unknown as ReturnType<typeof getBootstrapData>);

  expect(getBootstrapLocale()).toBe('ar');
});

test('getBootstrapLocale falls back to common locale', () => {
  mockGetBootstrapData.mockReturnValue({
    ...DEFAULT_BOOTSTRAP_DATA,
    common: {
      ...DEFAULT_BOOTSTRAP_DATA.common,
      locale: 'fa',
      menu_data: {},
    },
  } as unknown as ReturnType<typeof getBootstrapData>);

  expect(getBootstrapLocale()).toBe('fa');
});

test('getBootstrapLocale defaults to en', () => {
  mockGetBootstrapData.mockReturnValue({
    ...DEFAULT_BOOTSTRAP_DATA,
    common: {
      ...DEFAULT_BOOTSTRAP_DATA.common,
      locale: undefined,
      menu_data: {},
    },
  } as unknown as ReturnType<typeof getBootstrapData>);

  expect(getBootstrapLocale()).toBe('en');
});
