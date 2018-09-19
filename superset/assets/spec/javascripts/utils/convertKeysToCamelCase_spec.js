import { it, describe } from 'mocha';
import { expect } from 'chai';
import convertKeysToCamelCase from '../../../src/utils/convertKeysToCamelCase';

describe.only('convertKeysToCamelCase(object)', () => {
  it('returns undefined for undefined input', () => {
    expect(convertKeysToCamelCase(undefined)).to.equal(undefined);
  });
  it('returns null for null input', () => {
    expect(convertKeysToCamelCase(null)).to.equal(null);
  });
  it('returns a new object that has all keys in camelCase', () => {
    const input = {
      is_happy: true,
      'is-angry': false,
      isHungry: false,
    };
    expect(convertKeysToCamelCase(input)).to.deep.equal({
      isHappy: true,
      isAngry: false,
      isHungry: false,
    });
  });
  it('throws error if input is not a plain object', () => {
    expect(() => { convertKeysToCamelCase({}); }).to.not.throw();
    expect(() => { convertKeysToCamelCase(''); }).to.throw();
    expect(() => { convertKeysToCamelCase(new Map()); }).to.throw();
  });
});
