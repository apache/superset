import parseDiscreteDomain from '../../../src/parsers/domain/parseDiscreteDomain';

describe('parseDiscreteDomain()', () => {
  it('parses every element to string', () => {
    expect(
      parseDiscreteDomain([1560384000000, 'abc', false, true, 0, 1, null, undefined]),
    ).toEqual(['1560384000000', 'abc', 'false', 'true', '0', '1', 'null', 'undefined']);
  });
});
