import Translator from '../src/Translator';
import languagePackZh from './languagePacks/zh.json';

describe('Translator', () => {
  it('exists', () => {
    expect(Translator).toBeDefined();
  });
  describe('new Translator(config)', () => {
    it('initializes when config is not specified', () => {
      expect(new Translator()).toBeInstanceOf(Translator);
    });
    it('initializes when config is an empty object', () => {
      expect(new Translator({})).toBeInstanceOf(Translator);
    });
    it('initializes when config is specified', () => {
      expect(new Translator({
        languagePack: languagePackZh,
      })).toBeInstanceOf(Translator);
    });
  });
  describe('.translate(input, ...args)', () => {
    const translator = new Translator({
      languagePack: languagePackZh,
    });
    it('returns null for null input', () => {
      expect(translator.translate(null)).toBeNull();
    });
    it('returns undefined for undefined input', () => {
      expect(translator.translate(undefined)).toBeUndefined();
    });
    it('translates simple text', () => {
      expect(translator.translate('second')).toEqual('秒');
    });
    it('translates template text with arguments', () => {
      expect(translator.translate('Copy of %s', 1)).toEqual('1 的副本');
    });
  });
});
