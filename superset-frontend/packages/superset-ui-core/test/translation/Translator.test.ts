/*
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

import {
  logging,
  configure,
  t,
  tn,
  addLocaleData,
  addTranslation,
  addTranslations,
} from '@superset-ui/core';
import Translator from '../../src/translation/Translator';
import languagePackZh from './languagePacks/zh';
import languagePackEn from './languagePacks/en';

configure({
  languagePack: languagePackEn,
});

describe('Translator', () => {
  const spy = jest.spyOn(logging, 'warn');

  beforeAll(() => {
    spy.mockImplementation((info: any) => {
      throw new Error(info);
    });
    process.env.WEBPACK_MODE = 'production';
  });

  afterAll(() => {
    spy.mockRestore();
    process.env.WEBPACK_MODE = 'test';
  });

  describe('new Translator(config)', () => {
    it('initializes when config is not specified', () => {
      expect(new Translator()).toBeInstanceOf(Translator);
    });
    it('initializes when config is an empty object', () => {
      expect(new Translator({})).toBeInstanceOf(Translator);
    });
    it('initializes when config is specified', () => {
      expect(
        new Translator({
          languagePack: languagePackZh,
        }),
      ).toBeInstanceOf(Translator);
    });
  });
  describe('.translate(input, ...args)', () => {
    const translator = new Translator({
      languagePack: languagePackZh,
    });
    it('returns original text for unknown text', () => {
      expect(translator.translate('abc')).toEqual('abc');
    });
    it('translates simple text', () => {
      expect(translator.translate('second')).toEqual('秒');
    });
    it('translates template text with an argument', () => {
      expect(translator.translate('Copy of %s', 1)).toEqual('1 的副本');
      expect(translator.translate('Copy of %s', 2)).toEqual('2 的副本');
    });
    it('translates template text with multiple arguments', () => {
      expect(translator.translate('test %d %d', 1, 2)).toEqual('test 1 2');
    });
  });
  describe('.translateWithNumber(singular, plural, num, ...args)', () => {
    const translator = new Translator({
      languagePack: languagePackZh,
    });
    it('returns original text for unknown text', () => {
      expect(translator.translateWithNumber('fish', 'fishes', 1)).toEqual(
        'fish',
      );
    });
    it('uses 0 as default value', () => {
      expect(translator.translateWithNumber('box', 'boxes')).toEqual('boxes');
    });
    it('translates simple text', () => {
      expect(translator.translateWithNumber('second', 'seconds', 1)).toEqual(
        '秒',
      );
    });
    it('translates template text with an argument', () => {
      expect(
        translator.translateWithNumber('Copy of %s', 'Copies of %s', 12, 12),
      ).toEqual('12 的副本');
    });
    it('translates template text with multiple arguments', () => {
      expect(
        translator.translateWithNumber(
          '%d glass %s',
          '%d glasses %s',
          3,
          3,
          'abc',
        ),
      ).toEqual('3 glasses abc');
    });
  });
  describe('.translateWithNumber(key, num, ...args)', () => {
    const translator = new Translator({
      languagePack: languagePackEn,
    });
    it('translates template text with an argument', () => {
      expect(translator.translateWithNumber('%s copies', 1)).toEqual('1 copy');
      expect(translator.translateWithNumber('%s copies', 2)).toEqual(
        '2 copies',
      );
    });
  });

  // Extending language pack
  describe('.addTranslation(...)', () => {
    it('can add new translation', () => {
      addTranslation('haha', ['Hahaha']);
      expect(t('haha')).toEqual('Hahaha');
    });
  });

  describe('.addTranslations(...)', () => {
    it('can add new translations', () => {
      addTranslations({
        foo: ['bar', '%s bars'],
        bar: ['foo'],
      });
      // previous translation still exists
      expect(t('haha')).toEqual('Hahaha');
      // new translations work as expected
      expect(tn('foo', 1)).toEqual('bar');
      expect(tn('foo', 2)).toEqual('2 bars');
      expect(tn('bar', 2)).toEqual('bar');
    });
    it('throw warning on invalid arguments', () => {
      expect(() => addTranslations(undefined as never)).toThrow(
        'Invalid translations',
      );
      expect(tn('bar', '2 foo', 2)).toEqual('2 foo');
    });
    it('throw warning on duplicates', () => {
      expect(() => {
        addTranslations({
          haha: ['this is duplicate'],
        });
      }).toThrow('Duplicate translation key "haha"');
      expect(t('haha')).toEqual('Hahaha');
    });
  });

  describe('.addLocaleData(...)', () => {
    it('can add new translations for language', () => {
      addLocaleData({
        en: {
          yes: ['ok'],
        },
      });
      expect(t('yes')).toEqual('ok');
    });
    it('throw on unknown locale', () => {
      expect(() => {
        addLocaleData({
          zh: {
            haha: ['yes'],
          },
        });
      }).toThrow('Invalid locale data');
    });
    it('missing locale falls back to English', () => {
      configure({
        languagePack: languagePackZh,
      });
      // expect and error because zh is not current locale
      expect(() => {
        addLocaleData({
          en: {
            yes: ['OK'],
          },
        });
      }).not.toThrow();
      expect(t('yes')).toEqual('OK');
    });
  });
});
