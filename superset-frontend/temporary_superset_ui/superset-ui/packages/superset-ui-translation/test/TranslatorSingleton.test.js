import Translator from '../src/Translator';
import { configure, t } from '../src/TranslatorSingleton';
import languagePackZh from './languagePacks/zh.json';

describe('TranslatorSingleton', () => {
  describe('before configure()', () => {
    describe('t()', () => {
      it('throws error', () => {
        expect(() => t('second')).toThrow();
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
  });
});
