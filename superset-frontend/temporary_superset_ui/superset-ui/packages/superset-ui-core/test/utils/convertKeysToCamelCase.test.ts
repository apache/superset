import { convertKeysToCamelCase } from '@superset-ui/core/src';

describe('convertKeysToCamelCase(object)', () => {
  it('returns undefined for undefined input', () => {
    expect(convertKeysToCamelCase(undefined)).toBeUndefined();
  });
  it('returns null for null input', () => {
    expect(convertKeysToCamelCase(null)).toBeNull();
  });
  it('returns a new object that has all keys in camelCase', () => {
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
  it('throws error if input is not a plain object', () => {
    expect(() => {
      convertKeysToCamelCase({});
    }).not.toThrow();
    expect(() => {
      convertKeysToCamelCase('');
    }).toThrow();
    expect(() => {
      convertKeysToCamelCase(new Map());
    }).toThrow();
  });
});
