import {
  formatPersianDate,
  getCurrentPersianDate,
  gregorianToPersian,
  isValidPersianDate,
  persianToGregorian,
} from 'src/utils/persianCalendar';

test('gregorianToPersian converts known Nowruz date', () => {
  const result = gregorianToPersian(2023, 3, 21);
  expect(result.year).toBe(1402);
  expect(result.month).toBe(1);
  expect(result.day).toBe(1);
  expect(result.monthName.length).toBeGreaterThan(0);
  expect(result.weekday.length).toBeGreaterThan(0);
});

test('persianToGregorian returns matching Gregorian date', () => {
  const result = persianToGregorian(1402, 1, 1);
  expect(result.year).toBe(2023);
  expect(result.month).toBe(3);
  expect(result.day).toBe(21);
});

test('round trip conversion preserves original date', () => {
  const original = { year: 2024, month: 12, day: 31 };
  const persian = gregorianToPersian(original.year, original.month, original.day);
  const convertedBack = persianToGregorian(persian.year, persian.month, persian.day);
  expect(convertedBack).toEqual(original);
});

test('formatPersianDate and getCurrentPersianDate expose consistent values', () => {
  const today = getCurrentPersianDate();
  const formatted = formatPersianDate(today.year, today.month, today.day);
  expect(formatted).toMatch(/\d{4}\/\d{2}\/\d{2}/);
});

test('isValidPersianDate guards invalid ranges', () => {
  expect(isValidPersianDate(1402, 13, 1)).toBe(false);
  expect(isValidPersianDate(1402, 1, 32)).toBe(false);
  expect(isValidPersianDate(1402, 1, 1)).toBe(true);
});
