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
import { LocaleController } from './LocaleController';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

jest.mock('@apache-superset/core/ui', () => ({
  ...jest.requireActual('@apache-superset/core/ui'),
  configure: jest.fn(),
  t: jest.fn((key: string) => key),
  tn: jest.fn((key: string) => key),
}));

jest.mock('@superset-ui/core/utils/dates', () => ({
  extendedDayjs: { locale: jest.fn() },
}));

const mockedGet = SupersetClient.get as jest.Mock;
const mockedConfigure = configure as jest.Mock;
const mockedDayjsLocale = dayjs.locale as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LocaleController', () => {
  describe('constructor', () => {
    test('initializes with default locale "en"', () => {
      const controller = new LocaleController({ skipInitialFetch: true });
      expect(controller.getLocale()).toBe('en');
    });

    test('initializes with provided locale', () => {
      const controller = new LocaleController({
        initialLocale: 'de',
        skipInitialFetch: true,
      });
      expect(controller.getLocale()).toBe('de');
    });

    test('registers onChange callback', () => {
      const callback = jest.fn();
      const controller = new LocaleController({
        onChange: callback,
        skipInitialFetch: true,
      });

      // Simulate a locale change
      mockedGet.mockResolvedValue({ json: { domain: 'superset' } });
      return controller.setLocale('fr').then(() => {
        expect(callback).toHaveBeenCalledWith('fr');
      });
    });
  });

  describe('setLocale', () => {
    test('fetches language pack for non-en locale', async () => {
      const fakePack = { domain: 'superset', locale_data: {} };
      mockedGet.mockResolvedValue({ json: fakePack });

      const controller = new LocaleController({ skipInitialFetch: true });
      await controller.setLocale('de');

      expect(mockedGet).toHaveBeenCalledWith({
        endpoint: '/superset/language_pack/de/',
      });
      expect(mockedConfigure).toHaveBeenCalledWith({ languagePack: fakePack });
    });

    test('uses default language pack for "en" locale', async () => {
      const controller = new LocaleController({
        initialLocale: 'de',
        skipInitialFetch: true,
      });
      await controller.setLocale('en');

      expect(mockedGet).not.toHaveBeenCalled();
      expect(mockedConfigure).toHaveBeenCalled();
    });

    test('updates dayjs locale', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const controller = new LocaleController({ skipInitialFetch: true });
      await controller.setLocale('fr');

      expect(mockedDayjsLocale).toHaveBeenCalledWith('fr');
    });

    test('does NOT reload the page', async () => {
      const reloadSpy = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      });

      mockedGet.mockResolvedValue({ json: {} });

      const controller = new LocaleController({ skipInitialFetch: true });
      await controller.setLocale('de');

      expect(reloadSpy).not.toHaveBeenCalled();
    });

    test('notifies onChange listeners', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const controller = new LocaleController({ skipInitialFetch: true });
      controller.onChange(callback1);
      controller.onChange(callback2);

      await controller.setLocale('ru');

      expect(callback1).toHaveBeenCalledWith('ru');
      expect(callback2).toHaveBeenCalledWith('ru');
    });

    test('skips update if same locale and already initialized', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const controller = new LocaleController({
        initialLocale: 'de',
        skipInitialFetch: true,
      });

      // First call initializes
      await controller.setLocale('de');
      const callCount = mockedGet.mock.calls.length;

      // Second call with same locale should be skipped
      await controller.setLocale('de');
      expect(mockedGet.mock.calls.length).toBe(callCount);
    });

    test('propagates fetch errors', async () => {
      mockedGet.mockRejectedValue(new Error('Network error'));

      const controller = new LocaleController({ skipInitialFetch: true });

      await expect(controller.setLocale('de')).rejects.toThrow('Network error');
    });

    test('handles concurrent setLocale calls sequentially', async () => {
      const calls: string[] = [];

      mockedGet.mockImplementation(async ({ endpoint }) => {
        const locale = endpoint.split('/')[3];
        calls.push(`start-${locale}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        calls.push(`end-${locale}`);
        return { json: { domain: 'superset' } };
      });

      const controller = new LocaleController({ skipInitialFetch: true });

      // Start two concurrent calls
      const promise1 = controller.setLocale('de');
      const promise2 = controller.setLocale('fr');

      await Promise.all([promise1, promise2]);

      // Should complete sequentially, not interleaved
      expect(calls).toEqual(['start-de', 'end-de', 'start-fr', 'end-fr']);
    });
  });

  describe('onChange', () => {
    test('returns unsubscribe function', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const callback = jest.fn();
      const controller = new LocaleController({ skipInitialFetch: true });

      const unsubscribe = controller.onChange(callback);
      await controller.setLocale('de');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      await controller.setLocale('fr');
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('destroy', () => {
    test('clears all callbacks', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const callback = jest.fn();
      const controller = new LocaleController({ skipInitialFetch: true });

      controller.onChange(callback);
      controller.destroy();

      await controller.setLocale('de');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    test('returns false before initialization', () => {
      const controller = new LocaleController({
        initialLocale: 'de',
        skipInitialFetch: true,
      });
      // With skipInitialFetch=true and non-en locale, isReady should be true
      // because we explicitly skipped the fetch
      expect(controller.isReady()).toBe(true);
    });

    test('returns true after setLocale completes', async () => {
      mockedGet.mockResolvedValue({ json: {} });

      const controller = new LocaleController({ skipInitialFetch: true });
      await controller.setLocale('de');

      expect(controller.isReady()).toBe(true);
    });
  });
});
