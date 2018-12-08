import {
  fDuration,
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
} from '../../../src/modules/dates';

describe('fDuration', () => {
  it('is a function', () => {
    expect(typeof fDuration).toBe('function');
  });

  it('returns a string', () => {
    expect(typeof fDuration(new Date(), new Date())).toBe('string');
  });

  it('returns the expected output', () => {
    const output = fDuration('1496293608897', '1496293623406');
    expect(output).toBe('00:00:14.50');
  });
});

describe('now', () => {
  it('is a function', () => {
    expect(typeof now).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof now()).toBe('number');
  });
});

describe('epochTimeXHoursAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXHoursAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXHoursAgo(1)).toBe('number');
  });
});

describe('epochTimeXDaysAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXDaysAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXDaysAgo(1)).toBe('number');
  });
});

describe('epochTimeXYearsAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXYearsAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXYearsAgo(1)).toBe('number');
  });
});
