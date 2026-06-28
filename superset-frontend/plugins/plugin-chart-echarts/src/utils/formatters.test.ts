import { getSmartDateFormatter } from './formatters';
import { TimeGranularity } from '@superset-ui/core';

test('getSmartDateFormatter preserves minutes for MINUTE grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.MINUTE);
  const date = new Date('2024-01-15T10:35:00Z');
  const result = formatter(date);
  // Should show time with minutes, not collapsed to top of hour
  expect(result).not.toBe(formatter(new Date('2024-01-15T10:00:00Z')));
});

test('getSmartDateFormatter preserves minutes for FIFTEEN_MINUTES grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.FIFTEEN_MINUTES);
  const date1 = new Date('2024-01-15T10:15:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  // These should format differently, not both show "10 AM"
  expect(formatter(date1)).not.toBe(formatter(date2));
});

test('getSmartDateFormatter collapses to hour for HOUR grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.HOUR);
  const date1 = new Date('2024-01-15T10:00:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  // Both within the same hour should format the same
  expect(formatter(date1)).toBe(formatter(date2));
});