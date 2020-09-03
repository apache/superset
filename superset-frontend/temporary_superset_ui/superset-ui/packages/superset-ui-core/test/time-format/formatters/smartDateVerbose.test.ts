import TimeFormatter from '@superset-ui/core/src/time-format/TimeFormatter';
import smartDateVerboseFormatter from '@superset-ui/core/src/time-format/formatters/smartDateVerbose';

describe('smartDateVerboseFormatter', () => {
  const formatter = smartDateVerboseFormatter;

  it('is a function', () => {
    expect(formatter).toBeInstanceOf(TimeFormatter);
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatter(new Date('2020-01-01'))).toBe('2020');
  });

  it('shows month and year when 1st of month', () => {
    expect(formatter(new Date('2020-03-01'))).toBe('Mar 2020');
  });

  it('shows weekday when any day of the month', () => {
    expect(formatter(new Date('2020-03-03'))).toBe('Tue Mar 3');
    expect(formatter(new Date('2020-03-15'))).toBe('Sun Mar 15');
  });
});
