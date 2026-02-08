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

import { SupersetClient } from '@superset-ui/core';
import { configure } from '@apache-superset/core/ui';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import { applyLocale } from './locale';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

jest.mock('@apache-superset/core/ui', () => ({
  ...jest.requireActual('@apache-superset/core/ui'),
  configure: jest.fn(),
}));

jest.mock('@superset-ui/core/utils/dates', () => ({
  extendedDayjs: { locale: jest.fn() },
}));

const mockedGet = SupersetClient.get as jest.Mock;
const mockedConfigure = configure as jest.Mock;
const mockedDayjsLocale = dayjs.locale as jest.Mock;

const originalLocation = window.location;

beforeEach(() => {
  jest.clearAllMocks();
  // Mock window.location.reload
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, reload: jest.fn() },
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

test('applyLocale fetches language pack and reconfigures translations for non-en locale', async () => {
  const fakePack = { domain: 'superset', locale_data: {} };
  mockedGet.mockResolvedValue({ json: fakePack });

  await applyLocale('de');

  expect(mockedGet).toHaveBeenCalledWith({
    endpoint: '/superset/language_pack/de/',
  });
  expect(mockedConfigure).toHaveBeenCalledWith({ languagePack: fakePack });
});

test('applyLocale resets to default translation for en locale', async () => {
  await applyLocale('en');

  expect(mockedGet).not.toHaveBeenCalled();
  expect(mockedConfigure).toHaveBeenCalledWith();
});

test('applyLocale updates dayjs locale', async () => {
  mockedGet.mockResolvedValue({ json: {} });

  await applyLocale('fr');

  expect(mockedDayjsLocale).toHaveBeenCalledWith('fr');
});

test('applyLocale reloads page to apply server-side content localization', async () => {
  mockedGet.mockResolvedValue({ json: {} });

  await applyLocale('de');

  expect(window.location.reload).toHaveBeenCalled();
});

test('applyLocale propagates fetch errors', async () => {
  mockedGet.mockRejectedValue(new Error('Network error'));

  await expect(applyLocale('de')).rejects.toThrow('Network error');
});
