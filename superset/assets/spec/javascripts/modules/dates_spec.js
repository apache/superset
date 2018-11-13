import {
  tickMultiFormat,
  formatDate,
  formatDateVerbose,
  fDuration,
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
 } from '../../../src/modules/dates';

describe('tickMultiFormat', () => {
  it('is a function', () => {
    expect(typeof tickMultiFormat).toBe('function');
  });
});

describe('formatDate', () => {
  it('is a function', () => {
    expect(typeof formatDate).toBe('function');
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatDate(new Date('2020-01-01'))).toBe('2020');
  });

  it('shows only month when 1st of month', () => {
    expect(formatDate(new Date('2020-03-01'))).toBe('March');
  });

  it('does not show day of week when it is Sunday', () => {
    expect(formatDate(new Date('2020-03-15'))).toBe('Mar 15');
  });

  it('shows weekday when it is not Sunday (and no ms/sec/min/hr)', () => {
    expect(formatDate(new Date('2020-03-03'))).toBe('Tue 03');
  });
});

describe('formatDateVerbose', () => {
  it('is a function', () => {
    expect(typeof formatDateVerbose).toBe('function');
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatDateVerbose(new Date('2020-01-01'))).toBe('2020');
  });

  it('shows month and year when 1st of month', () => {
    expect(formatDateVerbose(new Date('2020-03-01'))).toBe('Mar 2020');
  });

  it('shows weekday when any day of the month', () => {
    expect(formatDateVerbose(new Date('2020-03-03'))).toBe('Tue Mar 3');
    expect(formatDateVerbose(new Date('2020-03-15'))).toBe('Sun Mar 15');
  });
});

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
