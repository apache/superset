/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import dateFilterComparator from '../../src/utils/dateFilterComparator';

test('returns 0 when filter date equals cell date', () => {
  const filterDate = new Date(2003, 9, 8); // Oct 8, 2003 local
  const cellDate = new Date('2003-10-08T12:00:00Z'); // Oct 8, 2003 UTC

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});

test('returns -1 when cell date is before filter date', () => {
  const filterDate = new Date(2003, 9, 10); // Oct 10, 2003
  const cellDate = new Date('2003-10-08T12:00:00Z'); // Oct 8, 2003

  expect(dateFilterComparator(filterDate, cellDate)).toBe(-1);
});

test('returns 1 when cell date is after filter date', () => {
  const filterDate = new Date(2003, 9, 8); // Oct 8, 2003
  const cellDate = new Date('2003-10-10T12:00:00Z'); // Oct 10, 2003

  expect(dateFilterComparator(filterDate, cellDate)).toBe(1);
});

test('returns -1 when cell value is null', () => {
  const filterDate = new Date(2003, 9, 8);

  expect(dateFilterComparator(filterDate, null as unknown as Date)).toBe(-1);
});

test('returns -1 when cell value is undefined', () => {
  const filterDate = new Date(2003, 9, 8);

  expect(dateFilterComparator(filterDate, undefined as unknown as Date)).toBe(
    -1,
  );
});

test('returns -1 when cell value is an invalid date string', () => {
  const filterDate = new Date(2003, 9, 8);
  const cellDate = new Date('invalid-date');

  expect(dateFilterComparator(filterDate, cellDate)).toBe(-1);
});

test('handles year boundary - cell in previous year', () => {
  const filterDate = new Date(2024, 0, 1); // Jan 1, 2024
  const cellDate = new Date('2023-12-31T12:00:00Z'); // Dec 31, 2023

  expect(dateFilterComparator(filterDate, cellDate)).toBe(-1);
});

test('handles year boundary - cell in next year', () => {
  const filterDate = new Date(2023, 11, 31); // Dec 31, 2023
  const cellDate = new Date('2024-01-01T12:00:00Z'); // Jan 1, 2024

  expect(dateFilterComparator(filterDate, cellDate)).toBe(1);
});

test('handles month boundary - cell in previous month', () => {
  const filterDate = new Date(2003, 9, 1); // Oct 1, 2003
  const cellDate = new Date('2003-09-30T12:00:00Z'); // Sep 30, 2003

  expect(dateFilterComparator(filterDate, cellDate)).toBe(-1);
});

test('handles month boundary - cell in next month', () => {
  const filterDate = new Date(2003, 8, 30); // Sep 30, 2003
  const cellDate = new Date('2003-10-01T12:00:00Z'); // Oct 1, 2003

  expect(dateFilterComparator(filterDate, cellDate)).toBe(1);
});

test('matches UTC midnight timestamp', () => {
  const filterDate = new Date(2003, 9, 8); // Oct 8, 2003
  const cellDate = new Date('2003-10-08T00:00:00Z'); // Oct 8, 2003 00:00 UTC

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});

test('matches UTC end-of-day timestamp', () => {
  const filterDate = new Date(2003, 9, 8); // Oct 8, 2003
  const cellDate = new Date('2003-10-08T23:59:59Z'); // Oct 8, 2003 23:59 UTC

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});

test('correctly compares dates from ISO string cell values', () => {
  const filterDate = new Date(2003, 9, 8);
  const cellDate = new Date('2003-10-08');

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});

test('handles cell value passed as timestamp number', () => {
  const filterDate = new Date(2003, 9, 8);
  // Oct 8, 2003 12:00:00 UTC as timestamp
  const cellDate = new Date(Date.UTC(2003, 9, 8, 12, 0, 0));

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});

test('compares only date components, ignoring time', () => {
  const filterDate = new Date(2003, 9, 8, 0, 0, 0); // Oct 8 at midnight local
  const cellDate = new Date('2003-10-08T18:30:45Z'); // Oct 8 at 6:30pm UTC

  expect(dateFilterComparator(filterDate, cellDate)).toBe(0);
});
