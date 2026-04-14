import { getIntlDurationFormatter } from '@superset-ui/core/number-format/utils//getIntlDurationFormatter';

test('getIntlDurationFormatter creates formatter with fallback locale when passed locale is invalid', () => {
  const formatter = getIntlDurationFormatter('invalid-locale-xyz');
  expect(formatter).toBeInstanceOf(Intl.DurationFormat);
  expect(formatter.format({ seconds: 60 })).toBe('60 sec');
});

test('getIntlDurationFormatter creates formatter with custom options', () => {
  const formatter = getIntlDurationFormatter('en', { style: 'digital' });
  expect(formatter).toBeInstanceOf(Intl.DurationFormat);
  expect(formatter.format({ minutes: 5, seconds: 30 })).toContain(':');
});
