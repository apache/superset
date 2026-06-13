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
import Translator from './Translator';
import logging from '../utils/logging';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

test('addTranslation adds a key-value translation', () => {
  const translator = new Translator();
  translator.addTranslation('hello', ['Hello World']);
  expect(translator.translate('hello')).toBe('Hello World');
});

test('addTranslations adds multiple translations from an object', () => {
  const translator = new Translator();
  translator.addTranslations({
    'key one': ['value one'],
    'key two': ['value two'],
  });
  expect(translator.translate('key one')).toBe('value one');
  expect(translator.translate('key two')).toBe('value two');
});

test('addTranslations warns on null input', () => {
  const translator = new Translator();
  translator.addTranslations(null as any);
  expect(warnSpy).toHaveBeenCalledWith('Invalid translations');
});

test('addTranslations warns on array input', () => {
  const translator = new Translator();
  translator.addTranslations(['value'] as any);
  expect(warnSpy).toHaveBeenCalledWith('Invalid translations');
});

test('addLocaleData adds translations for the current locale', () => {
  const translator = new Translator();
  translator.addLocaleData({ en: { greeting: ['Hello!'] } });
  expect(translator.translate('greeting')).toBe('Hello!');
});

test('addLocaleData falls back to English when current locale has no data', () => {
  const translator = new Translator({
    languagePack: {
      domain: 'superset',
      locale_data: {
        superset: {
          '': {
            domain: 'superset',
            lang: 'fr',
            plural_forms: 'nplurals=2; plural=(n != 1)',
          },
        },
      },
    },
  });
  translator.addLocaleData({ en: { bonjour: ['Hello from en!'] } });
  expect(translator.translate('bonjour')).toBe('Hello from en!');
});

test('addLocaleData warns when locale data has no matching locale', () => {
  const translator = new Translator();
  translator.addLocaleData({} as any);
  expect(warnSpy).toHaveBeenCalledWith('Invalid locale data');
});

test('translate returns the input key when Jed throws', () => {
  const translator = new Translator();
  (translator as any).i18n = {
    translate: () => {
      throw new Error('jed error');
    },
  };
  expect(translator.translate('error key')).toBe('error key');
});

test('translateWithNumber returns a string when translating with number as first arg', () => {
  const translator = new Translator();
  translator.addTranslation('%(num)d item', ['%(num)d item', '%(num)d items']);
  const result = translator.translateWithNumber(
    '%(num)d item',
    1,
    '%(num)d item',
    '%(num)d items',
  );
  expect(typeof result).toBe('string');
});

test('translateWithNumber returns a string when translating with plural string as first arg', () => {
  const translator = new Translator();
  translator.addTranslation('%(num)d item', ['%(num)d item', '%(num)d items']);
  const result = translator.translateWithNumber(
    '%(num)d item',
    '%(num)d item',
    2,
  );
  expect(typeof result).toBe('string');
});

test('translateWithNumber returns the key when Jed throws', () => {
  const translator = new Translator();
  (translator as any).i18n = {
    translate: () => {
      throw new Error('jed error');
    },
  };
  expect(translator.translateWithNumber('plural key', 1)).toBe('plural key');
});
