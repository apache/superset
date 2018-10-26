import Translator from '../src/Translator';
import { configure, t, tn } from '../src/TranslatorSingleton';
import languagePackZh from './languagePacks/zh.json';

describe('TranslatorSingleton', () => {
  describe('before configure()', () => {
    describe('t()', () => {
      it('throws error', () => {
        expect(() => t('second')).toThrow();
      });
    });
    describe('tn()', () => {
      it('throws error', () => {
        expect(() => tn('ox', 'oxen', 2)).toThrow();
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
