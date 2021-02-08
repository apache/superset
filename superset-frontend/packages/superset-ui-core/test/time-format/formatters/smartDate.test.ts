import TimeFormatter from '@superset-ui/core/src/time-format/TimeFormatter';
import smartDateFormatter from '@superset-ui/core/src/time-format/formatters/smartDate';

describe('smartDateFormatter', () => {
  it('is a function', () => {
    expect(smartDateFormatter).toBeInstanceOf(TimeFormatter);
  });

  it('shows only year when 1st day of the year', () => {
    expect(smartDateFormatter(new Date('2020-01-01'))).toBe('2020');
  });

  it('shows only month when 1st of month', () => {
    expect(smartDateFormatter(new Date('2020-03-01'))).toBe('March');
  });

  it('does not show day of week when it is Sunday', () => {
    expect(smartDateFormatter(new Date('2020-03-15'))).toBe('Mar 15');
  });

  it('shows weekday when it is not Sunday (and no ms/sec/min/hr)', () => {
    expect(smartDateFormatter(new Date('2020-03-03'))).toBe('Tue 03');
  });
});
