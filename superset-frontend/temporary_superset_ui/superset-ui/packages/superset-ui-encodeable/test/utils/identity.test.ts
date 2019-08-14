import identity from '../../src/utils/identity';

describe('identity(value)', () => {
  it('returns value', () => {
    ['a', 1, null, undefined, { b: 2 }, ['d']].forEach(x => {
      expect(identity(x)).toBe(x);
    });
  });
});
