import { createRelativeDayFormatter } from '@superset-ui/core';

test('createRelativeDayFormatter returns a formatter', () => {
  const formatter = createRelativeDayFormatter();
  expect(formatter).toBeDefined();
  expect(typeof formatter.format).toBe('function');
});

test('formats Day 1 correctly (01/01/2000 00:00 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
  expect(formatter(date)).toBe('Day 1: 12:00am');
});

test('formats Day 4 with time correctly (04/01/2000 18:30 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(2000, 0, 4, 18, 30, 0, 0));
  expect(formatter(date)).toBe('Day 4: 6:30pm');
});

test('formats Day -1 correctly (31/12/1999 11:15 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(1999, 11, 31, 11, 15, 0, 0));
  expect(formatter(date)).toBe('Day -1: 11:15am');
});

test('formats Day -4 correctly (28/12/1999 11:15 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(1999, 11, 28, 11, 15, 0, 0));
  expect(formatter(date)).toBe('Day -4: 11:15am');
});

test('formats Day 2 with midnight correctly (02/01/2000 00:00 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(2000, 0, 2, 0, 0, 0, 0));
  expect(formatter(date)).toBe('Day 2: 12:00am');
});

test('formats Day 1 with noon correctly (01/01/2000 12:00 UTC)', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(2000, 0, 1, 12, 0, 0, 0));
  expect(formatter(date)).toBe('Day 1: 12:00pm');
});

test('formats minutes with leading zeros correctly', () => {
  const formatter = createRelativeDayFormatter();
  const date = new Date(Date.UTC(2000, 0, 1, 14, 5, 0, 0));
  expect(formatter(date)).toBe('Day 1: 2:05pm');
});

test('handles timestamp numbers as input', () => {
  const formatter = createRelativeDayFormatter();
  const timestamp = Date.UTC(2000, 0, 4, 18, 30, 0, 0);
  expect(formatter(timestamp)).toBe('Day 4: 6:30pm');
});
