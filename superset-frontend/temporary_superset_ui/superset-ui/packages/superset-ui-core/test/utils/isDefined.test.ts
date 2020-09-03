import { isDefined } from '@superset-ui/core/src';

describe('isDefined(value)', () => {
  it('returns true if value is not null and not undefined', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined(1)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined('a')).toBe(true);
    expect(isDefined([])).toBe(true);
    expect(isDefined([0])).toBe(true);
    expect(isDefined([1])).toBe(true);
    expect(isDefined({})).toBe(true);
    expect(isDefined({ a: 1 })).toBe(true);
    expect(isDefined([{}])).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });
});
