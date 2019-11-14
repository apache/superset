import { isDefined, isArray, isNotArray, isEveryElementDefined } from '../../src/typeGuards/Base';

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
  describe('isEveryElementDefined<T>(array)', () => {
    it('returns true and remove undefined from possible return type', () => {
      expect(isEveryElementDefined(['a', 'b'])).toBeTruthy();
      expect(isEveryElementDefined([])).toBeTruthy();
      const array: (string | undefined)[] = ['a', 'b'];
      if (isEveryElementDefined(array)) {
        expect(array.every(a => a.length === 1)).toBeTruthy();
      }
    });
    it('returns false otherwise', () => {
      expect(isEveryElementDefined([undefined])).toBeFalsy();
      expect(isEveryElementDefined([undefined, 'a'])).toBeFalsy();
    });
  });
});
