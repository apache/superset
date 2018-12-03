import { isTruthy, optionFromValue, prepareCopyToClipboardTabularData } from '../../../src/utils/common';

describe('utils/common', () => {
  describe('isTruthy', () => {
    it('evals false-looking strings properly', () => {
      expect(isTruthy('f')).toBe(false);
      expect(isTruthy('false')).toBe(false);
      expect(isTruthy('no')).toBe(false);
      expect(isTruthy('n')).toBe(false);
      expect(isTruthy('F')).toBe(false);
      expect(isTruthy('False')).toBe(false);
      expect(isTruthy('NO')).toBe(false);
      expect(isTruthy('N')).toBe(false);
    });
    it('evals true-looking strings properly', () => {
      expect(isTruthy('t')).toBe(true);
      expect(isTruthy('true')).toBe(true);
      expect(isTruthy('yes')).toBe(true);
      expect(isTruthy('y')).toBe(true);
      expect(isTruthy('Y')).toBe(true);
      expect(isTruthy('True')).toBe(true);
      expect(isTruthy('Yes')).toBe(true);
      expect(isTruthy('YES')).toBe(true);
    });
    it('evals bools properly', () => {
      expect(isTruthy(false)).toBe(false);
      expect(isTruthy(true)).toBe(true);
    });
    it('evals ints properly', () => {
      expect(isTruthy(0)).toBe(false);
      expect(isTruthy(1)).toBe(true);
    });
    it('evals constants properly', () => {
      expect(isTruthy(null)).toBe(false);
      expect(isTruthy(undefined)).toBe(false);
    });
    it('string auto is false', () => {
      expect(isTruthy('false')).toBe(false);
    });
  });
  describe('optionFromValue', () => {
    it('converts values as expected', () => {
      expect(optionFromValue(false)).toEqual({ value: false, label: '<false>' });
      expect(optionFromValue(true)).toEqual({ value: true, label: '<true>' });
      expect(optionFromValue(null)).toEqual({ value: '<NULL>', label: '<NULL>' });
      expect(optionFromValue('')).toEqual({ value: '', label: '<empty string>' });
      expect(optionFromValue('foo')).toEqual({ value: 'foo', label: 'foo' });
      expect(optionFromValue(5)).toEqual({ value: 5, label: '5' });
    });
  });
  describe('prepareCopyToClipboardTabularData', () => {
    it('converts empty array', () => {
      const array = [];
      expect(prepareCopyToClipboardTabularData(array)).toEqual('');
    });
    it('converts non empty array', () => {
      const array = [
          { column1: 'lorem', column2: 'ipsum' },
          { column1: 'dolor', column2: 'sit', column3: 'amet' },
      ];
      expect(prepareCopyToClipboardTabularData(array)).toEqual('lorem\tipsum\ndolor\tsit\tamet\n');
    });
  });
});
