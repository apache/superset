import Translator from '../src/Translator';
import languagePackZh from './languagePacks/zh';

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
      expect(translator.translateWithNumber('fish', 'fishes', 1)).toEqual('fish');
    });
    it('uses 0 as default value', () => {
      expect(translator.translateWithNumber('box', 'boxes')).toEqual('boxes');
    });
    it('translates simple text', () => {
      expect(translator.translateWithNumber('second', 'seconds', 1)).toEqual('秒');
    });
    it('translates template text with an argument', () => {
      expect(translator.translateWithNumber('Copy of %s', 'Copies of %s', 12, 12)).toEqual(
        '12 的副本本本',
      );
    });
    it('translates template text with multiple arguments', () => {
      expect(translator.translateWithNumber('%d glass %s', '%d glasses %s', 3, 3, 'abc')).toEqual(
        '3 glasses abc',
      );
    });
  });
});
