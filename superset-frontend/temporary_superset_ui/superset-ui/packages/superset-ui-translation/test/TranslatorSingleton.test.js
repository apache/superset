/* eslint no-console: 0 */
import mockConsole from 'jest-mock-console';
import Translator from '../src/Translator';
import { configure, t, tn } from '../src/TranslatorSingleton';
import languagePackZh from './languagePacks/zh.json';

describe('TranslatorSingleton', () => {
  describe('before configure()', () => {
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
          languagePack: languagePackZh,
        });
        expect(tn('ox', 'oxen', 2)).toEqual('oxen');
      });
    });
  });
});
