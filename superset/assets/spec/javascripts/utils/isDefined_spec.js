import { it, describe } from 'mocha';
import { expect } from 'chai';
import isDefined from '../../../src/utils/isDefined';

describe('isDefined(value)', () => {
  it('returns true if value is not null and not undefined', () => {
    expect(isDefined(0)).to.equal(true);
    expect(isDefined(1)).to.equal(true);
    expect(isDefined('')).to.equal(true);
    expect(isDefined('a')).to.equal(true);
    expect(isDefined([])).to.equal(true);
    expect(isDefined([0])).to.equal(true);
    expect(isDefined([1])).to.equal(true);
    expect(isDefined({})).to.equal(true);
    expect(isDefined({ a: 1 })).to.equal(true);
    expect(isDefined([{}])).to.equal(true);
  });
  it('returns false otherwise', () => {
    expect(isDefined(null)).to.equal(false);
    expect(isDefined(undefined)).to.equal(false);
  });
});
