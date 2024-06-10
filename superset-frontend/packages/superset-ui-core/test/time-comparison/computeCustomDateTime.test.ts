import { computeCustomDateTime } from '@superset-ui/core';

const TODAY = '2024-06-03';

// Mock Date to always return 2024-06-03
beforeEach(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date(TODAY).getTime());
});

afterEach(() => {
  jest.useRealTimers();
});

test('should return the current date for "now"', () => {
  expect(computeCustomDateTime('now', 'day', 0)).toEqual(new Date(TODAY));
});

test('should return the current date for "today"', () => {
  expect(computeCustomDateTime('today', 'day', 0)).toEqual(new Date(TODAY));
});

test('should return the date for "2024-06-03" with grain "day" and grainValue 2', () => {
  expect(computeCustomDateTime(TODAY, 'day', 2)).toEqual(
    new Date('2024-06-05T00:00:00Z'),
  );
});

test('should return the date for "2024-06-03" with grain "week" and grainValue 1', () => {
  expect(computeCustomDateTime(TODAY, 'week', 1)).toEqual(
    new Date('2024-06-10T00:00:00Z'),
  );
});

test('should return the date for "2024-06-03" with grain "month" and grainValue 1', () => {
  expect(computeCustomDateTime(TODAY, 'month', 1)).toEqual(
    new Date('2024-07-03T00:00:00Z'),
  );
});

test('should return the date for "2024-06-03" with grain "quarter" and grainValue 1', () => {
  expect(computeCustomDateTime(TODAY, 'quarter', 1)).toEqual(
    new Date('2024-09-03T00:00:00Z'),
  );
});

test('should return the date for "2024-06-03" with grain "year" and grainValue 1', () => {
  expect(computeCustomDateTime(TODAY, 'year', 1)).toEqual(
    new Date('2025-06-03T00:00:00Z'),
  );
});

test('should return null for an invalid date', () => {
  expect(computeCustomDateTime('invalid', 'day', 1)).toBeNull();
});

test('should return the date for "2024-06-03" with an invalid grain', () => {
  expect(computeCustomDateTime(TODAY, 'invalid', 1)).toEqual(
    new Date('2024-06-03T00:00:00Z'),
  );
});
