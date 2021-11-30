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

/* eslint no-console: 0 */
import mockConsole from 'jest-mock-console';
import Translator from '@superset-ui/core/src/translation/Translator';
import {
  configure,
  resetTranslation,
  t,
  tn,
} from '@superset-ui/core/src/translation/TranslatorSingleton';

import languagePackEn from './languagePacks/en';
import languagePackZh from './languagePacks/zh';

describe('TranslatorSingleton', () => {
  describe('before configure()', () => {
    beforeAll(() => {
      resetTranslation();
    });

    describe('t()', () => {
      it('returns untranslated input and issues a warning', () => {
        const restoreConsole = mockConsole();
        expect(t('second')).toEqual('second');
        expect(console.warn).toHaveBeenCalled();
        restoreConsole();
      });
    });
    describe('tn()', () => {
      it('returns untranslated input and issues a warning', () => {
        const restoreConsole = mockConsole();
        expect(tn('ox', 'oxen', 2)).toEqual('oxen');
        expect(console.warn).toHaveBeenCalled();
        restoreConsole();
      });
    });
  });
  describe('after configure()', () => {
    describe('configure()', () => {
      it('creates and returns a translator', () => {
        expect(configure()).toBeInstanceOf(Translator);
      });
    });
    describe('t()', () => {
      it('after configure() returns translated text', () => {
        configure({
          languagePack: languagePackZh,
        });
        expect(t('second')).toEqual('秒');
      });
    });
    describe('tn()', () => {
      it('after configure() returns translated text with singular/plural', () => {
        configure({
          languagePack: languagePackEn,
        });
        expect(tn('ox', 'oxen', 2)).toEqual('oxen');
      });
    });
  });
});
