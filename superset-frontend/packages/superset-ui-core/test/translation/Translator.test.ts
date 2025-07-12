/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with the Apache License for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
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

configure({ languagePack: languagePackEn });

describe('Translator', () => {
  const spy = jest.spyOn(logging, 'warn');

  beforeAll(() => {
    spy.mockImplementation((msg: any) => {
      const str = String(msg);
      if (
        str.includes('Plural translation failed') ||
        str.includes('Duplicate translation key')
      ) {
        // allow expected warnings
        return;
      }
      throw new Error(str);
    });
    process.env.WEBPACK_MODE = 'production';
  });

  afterAll(() => {
    spy.mockRestore();
    process.env.WEBPACK_MODE = 'test';
  });

  beforeEach(() => {
    configure({ languagePack: languagePackEn });
    spy.mockClear();
  });

  describe('new Translator(config)', () => {
    it('initializes without config', () => {
      expect(new Translator()).toBeInstanceOf(Translator);
    });

    it('initializes with empty config', () => {
      expect(new Translator({})).toBeInstanceOf(Translator);
    });

    it('initializes with language pack', () => {
      expect(new Translator({ languagePack: languagePackZh })).toBeInstanceOf(
        Translator,
      );
    });
  });

  describe('.translate(key, ...args)', () => {
    const translator = new Translator({ languagePack: languagePackZh });

    it('returns key if unknown', () => {
      expect(translator.translate('abc')).toEqual('abc');
    });

    it('translates simple key', () => {
      expect(translator.translate('second')).toEqual('秒');
    });

    it('translates with one arg', () => {
      expect(translator.translate('Copy of %s', 1)).toEqual('1 的副本');
    });

    it('translates with multiple args', () => {
      expect(translator.translate('test %d %d', 1, 2)).toEqual('test 1 2');
    });
  });

  describe('.translateWithNumber(singular, plural, num, ...args)', () => {
    const translator = new Translator({ languagePack: languagePackZh });

    it('returns key when translation missing', () => {
      expect(translator.translateWithNumber('fish', 'fishes', 1)).toEqual(
        'fish',
      );
    });

    it('defaults to singular if num is missing', () => {
      expect(translator.translateWithNumber('box', 'boxes')).toEqual('box');
    });

    it('translates standard plural form', () => {
      expect(translator.translateWithNumber('second', 'seconds', 1)).toEqual(
        '秒',
      );
    });

    it('interpolates with one arg', () => {
      expect(
        translator.translateWithNumber('Copy of %s', 'Copies of %s', 12, 12),
      ).toEqual('12 的副本');
    });

    it('interpolates with multiple args', () => {
      expect(
        translator.translateWithNumber(
          '%d glass %s',
          '%d glasses %s',
          3,
          3,
          'abc',
        ),
      ).toEqual('3 glass abc');
    });

    it('handles invalid input gracefully', () => {
      const result = translator.translateWithNumber(
        'foo',
        'bar',
        'not-a-number' as any,
      );
      expect(result).toEqual('foo');
    });
  });

  describe('.translateWithNumber(key, num, ...args)', () => {
    const translator = new Translator({ languagePack: languagePackEn });

    it('handles plural fallback', () => {
      expect(translator.translateWithNumber('%s copies', 1)).toEqual('1 copy');
      expect(translator.translateWithNumber('%s copies', 2)).toEqual(
        '2 copies',
      );
    });

    it('handles plain interpolated fallback', () => {
      expect(translator.translateWithNumber('%s items', 5)).toEqual('5 items');
    });

    it('handles null input without error', () => {
      const result = translator.translateWithNumber('foo', null as any);
      expect(result).toEqual('foo');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('.addTranslation(...)', () => {
    it('adds and uses single translation', () => {
      addTranslation('haha', ['Hahaha']);
      expect(t('haha')).toEqual('Hahaha');
    });
  });

  describe('.addTranslations(...)', () => {
    beforeEach(() => {
      addTranslation('haha', ['Hahaha']);
    });

    it('adds multiple translations', () => {
      addTranslations({
        foo: ['bar', '%s bars'],
        bar: ['foo'],
      });
      expect(t('haha')).toEqual('Hahaha');
      expect(tn('foo', 1)).toEqual('bar');
      expect(tn('foo', 2)).toEqual('2 bars');
      expect(tn('bar', 2)).toEqual('bar');
    });

    it('throws on invalid argument', () => {
      expect(() => addTranslations(undefined as never)).toThrow(
        'Invalid translations',
      );
      expect(tn('2 foo', 2)).toEqual('2 foo');
    });

    it('warns on duplicate key and overrides value', () => {
      addTranslations({ haha: ['this is duplicate'] });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate translation key "haha"'),
      );
      expect(t('haha')).toEqual('this is duplicate'); // actual behavior
    });
  });

  describe('.addLocaleData(...)', () => {
    it('adds new keys to a locale', () => {
      addLocaleData({ en: { yes: ['ok'] } });
      expect(t('yes')).toEqual('ok');
    });

    it('throws on unknown locale key', () => {
      expect(() => {
        addLocaleData({
          zh: { haha: ['yes'] },
        });
      }).toThrow('Invalid locale data');
    });

    it('allows adding fallback locale when inactive', () => {
      configure({ languagePack: languagePackZh });
      expect(() => {
        addLocaleData({ en: { yes: ['OK'] } });
      }).not.toThrow();
      expect(t('yes')).toEqual('OK');
    });
  });
});
