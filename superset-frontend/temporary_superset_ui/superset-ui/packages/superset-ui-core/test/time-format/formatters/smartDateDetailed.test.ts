import TimeFormatter from '@superset-ui/core/src/time-format/TimeFormatter';
import smartDateDetailedFormatter from '@superset-ui/core/src/time-format/formatters/smartDateDetailed';

describe('smartDateDetailedFormatter', () => {
  const formatter = smartDateDetailedFormatter;

  it('is a function', () => {
    expect(formatter).toBeInstanceOf(TimeFormatter);
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatter(new Date('2020-01-01 0:00:00'))).toBe('2020');
  });

  it('shows full date when a regular date', () => {
    expect(formatter(new Date('2020-03-01 00:00:00'))).toBe('2020-03-01');
  });

  it('shows full date including time of day without seconds when hour precision', () => {
    expect(formatter(new Date('2020-03-01 13:00:00'))).toBe('2020-03-01 13:00');
  });

  it('shows full date including time of day when minute precision', () => {
    expect(formatter(new Date('2020-03-10 13:10:00'))).toBe('2020-03-10 13:10');
  });

  it('shows full date including time of day when subsecond precision', () => {
    expect(formatter(new Date('2020-03-10 13:10:00.1'))).toBe('2020-03-10 13:10:00.100');
  });
});
