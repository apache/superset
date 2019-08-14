import { isDefined, isArray, isNotArray } from '../../src/typeGuards/Base';

describe('type guards: Base', () => {
  describe('isArray<T>(maybeArray)', () => {
    it('returns true and converts to type T[] if is array', () => {
      const x: string | string[] = ['abc'];
      if (isArray(x)) {
        // x is now known to be an array
        expect(x[0]).toEqual('abc');
      }
    });
    it('returns false if not', () => {
      expect(isArray('abc')).toBeFalsy();
    });
  });
  describe('isNotArray<T>(maybeArray)', () => {
    it('returns true and converts to type T if not array', () => {
      const x: string | string[] = 'abc';
      if (isNotArray(x)) {
        // x is now known to be a string
        expect(x.startsWith('a')).toBeTruthy();
      }
    });
    it('returns false if is array', () => {
      expect(isNotArray(['def'])).toBeFalsy();
    });
  });
  describe('isDefined<T>(value)', () => {
    it('returns true and converts to type T if value is defined', () => {
      const x: any = 'abc';
      if (isDefined<string>(x)) {
        expect(x.startsWith('a')).toBeTruthy();
      }
    });
    it('returns false if not defined', () => {
      expect(isDefined(null)).toBeFalsy();
      expect(isDefined(undefined)).toBeFalsy();
    });
  });
});
