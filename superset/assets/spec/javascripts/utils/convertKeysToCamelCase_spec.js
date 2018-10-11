import convertKeysToCamelCase from '../../../src/utils/convertKeysToCamelCase';

describe('convertKeysToCamelCase(object)', () => {
  test('returns undefined for undefined input', () => {
    expect(convertKeysToCamelCase(undefined)).toBeUndefined();
  });
  test('returns null for null input', () => {
    expect(convertKeysToCamelCase(null)).toBeNull();
  });
  test('returns a new object that has all keys in camelCase', () => {
    const input = {
      is_happy: true,
      'is-angry': false,
      isHungry: false,
    };
    expect(convertKeysToCamelCase(input)).toEqual({
      isHappy: true,
      isAngry: false,
      isHungry: false,
    });
  });
  test('throws error if input is not a plain object', () => {
    expect(() => { convertKeysToCamelCase({}); }).not.toThrowError();
    expect(() => { convertKeysToCamelCase(''); }).toThrowError();
    expect(() => { convertKeysToCamelCase(new Map()); }).toThrowError();
  });
});
